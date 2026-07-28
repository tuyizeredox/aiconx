import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Search, SlidersHorizontal, X, ShoppingBag, Store, MapPin, Loader2, PackageSearch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import ShopHeaderBar from "@/components/shop/ShopHeaderBar";
import MarketplaceFilters, { CATEGORY_KEYS } from "@/components/marketplace/MarketplaceFilters";
import ActiveFilterChips from "@/components/marketplace/ActiveFilterChips";
import StoreStrip from "@/components/marketplace/StoreStrip";
import { productsAPI, storesAPI } from "@/api/apiClient";
import { createPageUrl } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import useGeolocation from "@/hooks/useGeolocation";

const PAGE_SIZE = 24;
const DEFAULT_SORT = "-created_at";
const DEFAULT_RADIUS_KM = 10;

// Filter state lives in the URL so a filtered marketplace is shareable, and so
// back/forward moves between searches instead of leaving the page. Location is
// deliberately *not* in the URL — coordinates go stale and a shared link
// shouldn't trigger a permission prompt on someone else's device.
const PARAM = {
  search: "q",
  category: "category",
  sort: "sort",
  minPrice: "min",
  maxPrice: "max",
  rating: "rating",
  inStock: "stock",
  onSale: "sale",
};

export default function Marketplace() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const values = useMemo(() => ({
    search: searchParams.get(PARAM.search) || "",
    category: searchParams.get(PARAM.category) || "",
    sort: searchParams.get(PARAM.sort) || DEFAULT_SORT,
    minPrice: searchParams.get(PARAM.minPrice) || "",
    maxPrice: searchParams.get(PARAM.maxPrice) || "",
    rating: searchParams.get(PARAM.rating) || "",
    inStock: searchParams.get(PARAM.inStock) === "1",
    onSale: searchParams.get(PARAM.onSale) === "1",
  }), [searchParams]);

  const updateValues = useCallback((patch) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        const param = PARAM[key];
        if (!param) return;
        if (value === "" || value === false || value === null || value === undefined) {
          next.delete(param);
        } else {
          next.set(param, value === true ? "1" : String(value));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // ---- Search box: typed locally, pushed to the URL on a debounce so every
  // keystroke doesn't become a history entry or a request.
  const [searchInput, setSearchInput] = useState(values.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== values.search) updateValues({ search: searchInput });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, values.search, updateValues]);

  // Keeps the box in sync when the search is cleared from somewhere else
  // (a chip, "clear all", or the browser's back button).
  useEffect(() => { setSearchInput(values.search); }, [values.search]);

  // ---- Near me
  const { coords, status: geoStatus, request: requestLocation, reset: resetLocation } = useGeolocation();
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);

  const handleNearbyToggle = useCallback((on) => {
    setNearbyEnabled(on);
    if (on) {
      if (!coords) requestLocation();
    } else if (["denied", "error", "unavailable"].includes(geoStatus)) {
      // Clear the failed attempt so flipping it back on retries cleanly.
      resetLocation();
    }
  }, [coords, geoStatus, requestLocation, resetLocation]);

  const nearbyActive = nearbyEnabled && !!coords;

  const { data: nearbyResponse, isFetching: nearbyFetching } = useQuery({
    queryKey: ["nearbyStores", coords?.lat, coords?.lng, radius],
    queryFn: () => storesAPI.nearby({ lat: coords.lat, lng: coords.lng, radius_km: radius, limit: 200 }),
    enabled: nearbyActive,
    staleTime: 60_000,
  });

  const nearbyStores = useMemo(
    () => (Array.isArray(nearbyResponse?.data) ? nearbyResponse.data : []),
    [nearbyResponse]
  );

  // Products are held back until the nearby lookup resolves, otherwise the grid
  // would flash the whole platform before narrowing to the shopper's area.
  const nearbyResolved = !!nearbyResponse;
  const storeIdsParam = nearbyActive && nearbyResolved
    ? nearbyStores.map(s => s.id || s._id).filter(Boolean).join(",")
    : undefined;

  const queryFilters = useMemo(() => ({
    status: "active",
    sort: values.sort,
    search: values.search || undefined,
    category: values.category || undefined,
    min_price: values.minPrice || undefined,
    max_price: values.maxPrice || undefined,
    min_rating: values.rating || undefined,
    in_stock: values.inStock ? "true" : undefined,
    on_sale: values.onSale ? "true" : undefined,
    store_ids: storeIdsParam,
  }), [values, storeIdsParam]);

  const resultsEnabled = !nearbyActive || nearbyResolved;

  const {
    data: productPages,
    isLoading: productsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["marketplaceProducts", queryFilters],
    queryFn: ({ pageParam }) => productsAPI.list({ ...queryFilters, limit: PAGE_SIZE, skip: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + (page?.data?.length || 0), 0);
      return loaded < (lastPage?.total || 0) ? loaded : undefined;
    },
    enabled: resultsEnabled,
    staleTime: 30_000,
  });

  const products = useMemo(
    () => (productPages?.pages || []).flatMap(page => page?.data || []),
    [productPages]
  );
  const totalResults = productPages?.pages?.[0]?.total ?? 0;

  const { data: facets } = useQuery({
    queryKey: ["marketplaceFacets", queryFilters],
    queryFn: () => productsAPI.facets(queryFilters),
    enabled: resultsEnabled,
    staleTime: 30_000,
  });

  const { data: featuredResponse, isLoading: featuredLoading } = useQuery({
    queryKey: ["featuredStores"],
    queryFn: () => storesAPI.list({ status: "active", sort: "-follower_count", limit: 10 }),
    enabled: !nearbyActive,
    staleTime: 5 * 60_000,
  });
  const featuredStores = Array.isArray(featuredResponse?.data) ? featuredResponse.data : [];

  // ---- Infinite scroll: the sentinel below the grid pulls the next page in
  // as it comes into view; the button underneath keeps it operable without it.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchNextPage(); },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (values.category) count++;
    if (values.minPrice || values.maxPrice) count++;
    if (values.rating) count++;
    if (values.inStock) count++;
    if (values.onSale) count++;
    if (nearbyEnabled) count++;
    return count;
  }, [values, nearbyEnabled]);

  const clearAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setNearbyEnabled(false);
    setRadius(DEFAULT_RADIUS_KM);
  }, [setSearchParams]);

  const nearby = {
    enabled: nearbyEnabled,
    // Enabled but not yet located (or denied) must not claim to be filtering —
    // only a resolved position actually narrows the results.
    active: nearbyActive,
    status: geoStatus,
    radius,
    storeCount: nearbyStores.length,
    isLoading: nearbyFetching,
    onToggle: handleNearbyToggle,
    onRadiusChange: setRadius,
    onRetry: requestLocation,
  };

  const filterPanel = (
    <MarketplaceFilters
      values={values}
      onChange={updateValues}
      onClear={clearAll}
      facets={facets}
      activeCount={activeCount}
      nearby={nearby}
    />
  );

  const showSkeletons = productsLoading || !resultsEnabled;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ShopHeaderBar backTo={createPageUrl("Home")} backLabel={t("nav.home")} />

      {/* Hero + primary search */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 text-white">
        {/* Photo sits under a gradient wash rather than behind plain text —
            the wash is what keeps the headline and search box readable no
            matter how busy the image is at a given viewport width. */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-orange-700/85 via-orange-600/70 to-amber-500/60"
          aria-hidden="true"
        />
        {/* Softens the seam into the category rail below. */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent" aria-hidden="true" />

        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-1.5 drop-shadow-sm">{t("shop.heroTitle")}</h1>
          <p className="text-white/90 text-sm sm:text-base mb-5 max-w-xl">{t("shop.heroSubtitle")}</p>

          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("shop.searchPlaceholder")}
              aria-label={t("shop.searchPlaceholder")}
              className="pl-11 pr-11 h-12 rounded-2xl bg-white dark:bg-slate-900 border-0 text-slate-900 dark:text-white shadow-lg text-sm"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                aria-label={t("shop.clearSearch")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4 text-xs sm:text-sm">
            <span className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5 font-medium">
              <ShoppingBag className="w-3.5 h-3.5" />
              {t("shop.productsCount", { count: totalResults })}
            </span>
            <span className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5 font-medium">
              <Store className="w-3.5 h-3.5" />
              {t("shop.storesCount", { count: nearbyActive ? nearbyStores.length : featuredStores.length })}
            </span>
            {nearbyActive && (
              <span className="flex items-center gap-1.5 bg-white/25 rounded-full px-3 py-1.5 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                {t("shop.withinKm", { km: radius })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Category quick-pills */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar py-3">
            <button
              onClick={() => updateValues({ category: "" })}
              className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-colors ${
                !values.category
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t("shop.allCategories")}
            </button>
            {CATEGORY_KEYS.map(key => (
              <button
                key={key}
                onClick={() => updateValues({ category: values.category === key ? "" : key })}
                className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-colors ${
                  values.category === key
                    ? "bg-orange-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t(`shop.category_${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-6">
        <StoreStrip
          stores={nearbyActive ? nearbyStores : featuredStores}
          isLoading={nearbyActive ? nearbyFetching && !nearbyResolved : featuredLoading}
          nearbyMode={nearbyActive}
        />

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* Desktop filter column */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-4 py-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {filterPanel}
            </div>
          </aside>

          <main className="min-w-0">
            {/* Toolbar */}
            <div className="sticky top-14 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltersOpen(true)}
                  className="lg:hidden h-9 rounded-xl gap-1.5 shrink-0 bg-white dark:bg-slate-900"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {t("shop.filters")}
                  {activeCount > 0 && (
                    <span className="text-[10px] font-black text-white bg-orange-600 rounded-full px-1.5">{activeCount}</span>
                  )}
                </Button>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex-1 min-w-0 truncate">
                  {showSkeletons
                    ? t("shop.loadingResults")
                    : t("shop.resultsCount", { count: totalResults })}
                </p>

                <Select value={values.sort} onValueChange={(v) => updateValues({ sort: v })}>
                  <SelectTrigger className="w-[140px] sm:w-[170px] h-9 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 shrink-0">
                    <SelectValue placeholder={t("shop.sortBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-created_at">{t("shop.newest")}</SelectItem>
                    <SelectItem value="-sales_count">{t("shop.bestSelling")}</SelectItem>
                    <SelectItem value="price">{t("shop.priceLowHigh")}</SelectItem>
                    <SelectItem value="-price">{t("shop.priceHighLow")}</SelectItem>
                    <SelectItem value="-rating_avg">{t("shop.topRated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4">
              <ActiveFilterChips
                values={values}
                onChange={updateValues}
                onClear={clearAll}
                nearby={nearby}
              />
            </div>

            {/* Results */}
            {showSkeletons ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {Array(8).fill(0).map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 sm:py-24 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <PackageSearch className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-base font-bold text-slate-700 dark:text-slate-200">{t("shop.noResultsTitle")}</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto px-4">
                  {nearbyActive ? t("shop.noResultsNearby", { km: radius }) : t("shop.noResultsDesc")}
                </p>
                {(activeCount > 0 || values.search) && (
                  <Button onClick={clearAll} variant="outline" className="mt-5 rounded-xl gap-1.5">
                    <X className="w-3.5 h-3.5" /> {t("shop.clearAll")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                  {products.map((product, idx) => (
                    <ProductCard
                      key={product.id || product._id || `product-${idx}`}
                      product={product}
                      currentUser={currentUser}
                    />
                  ))}
                </div>

                <div ref={sentinelRef} className="h-px" aria-hidden="true" />

                {hasNextPage && (
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      variant="outline"
                      className="rounded-xl h-10 px-6 gap-2 bg-white dark:bg-slate-900"
                    >
                      {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t("shop.loadMore")}
                    </Button>
                  </div>
                )}

                {!hasNextPage && products.length > PAGE_SIZE && (
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-8">
                    {t("shop.endOfResults")}
                  </p>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <SheetTitle className="text-base">{t("shop.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">
            {filterPanel}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <Button
              onClick={() => setFiltersOpen(false)}
              className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              {showSkeletons ? t("shop.filters") : t("shop.showResults", { count: totalResults })}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
