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

  // Outline pills that fill in with the brand colour when selected — one
  // selection style for "all" and for a named category.
  const pillClass = (active) => `shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
    active
      ? "bg-orange-600 border-orange-600 text-white"
      : "bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-700 text-slate-600 dark:text-ink-300 hover:border-slate-300 dark:hover:border-ink-600 hover:bg-slate-50 dark:hover:bg-ink-800"
  }`;

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
    <div className="min-h-screen bg-slate-50 dark:bg-ink-900">
      <ShopHeaderBar backTo={createPageUrl("Home")} backLabel={t("nav.home")} />

      {/* Page header — title, search and categories share one clean surface
          instead of a photo hero, so the results start higher on the page. */}
      <div className="bg-white dark:bg-ink-900 border-b border-slate-200/70 dark:border-ink-800/70">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-7">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10">
            <div className="min-w-0 lg:flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                {t("shop.heroTitle")}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-ink-400">{t("shop.heroSubtitle")}</p>
            </div>

            <div className="relative w-full lg:w-[420px] lg:shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("shop.searchPlaceholder")}
                aria-label={t("shop.searchPlaceholder")}
                className="pl-10 pr-10 h-11 rounded-xl bg-slate-50 dark:bg-ink-800/60 border-slate-200 dark:border-ink-700 text-slate-900 dark:text-white shadow-none text-sm focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:border-orange-400"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  aria-label={t("shop.clearSearch")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-ink-200 hover:bg-slate-200/70 dark:hover:bg-ink-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* What's in the catalogue, as quiet meta rather than badges. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-xs sm:text-[13px] text-slate-500 dark:text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-slate-400 dark:text-ink-500" />
              {t("shop.productsCount", { count: totalResults })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400 dark:text-ink-500" />
              {t("shop.storesCount", { count: nearbyActive ? nearbyStores.length : featuredStores.length })}
            </span>
            {nearbyActive && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
                <MapPin className="w-3.5 h-3.5" />
                {t("shop.withinKm", { km: radius })}
              </span>
            )}
          </div>

          {/* Category quick-pills */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-3 sm:-mx-6 px-3 sm:px-6 mt-4 pb-3">
            <button onClick={() => updateValues({ category: "" })} className={pillClass(!values.category)}>
              {t("shop.allCategories")}
            </button>
            {CATEGORY_KEYS.map(key => (
              <button
                key={key}
                onClick={() => updateValues({ category: values.category === key ? "" : key })}
                className={pillClass(values.category === key)}
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
            <div className="sticky top-20 bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 px-4 py-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {filterPanel}
            </div>
          </aside>

          <main className="min-w-0">
            {/* Toolbar */}
            <div className="sticky top-14 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 bg-slate-50/90 dark:bg-ink-900/90 backdrop-blur-md mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltersOpen(true)}
                  className="lg:hidden h-9 rounded-xl gap-1.5 shrink-0 bg-white dark:bg-ink-900"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {t("shop.filters")}
                  {activeCount > 0 && (
                    <span className="text-[10px] font-black text-white bg-orange-600 rounded-full px-1.5">{activeCount}</span>
                  )}
                </Button>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-ink-400 flex-1 min-w-0 truncate">
                  {showSkeletons
                    ? t("shop.loadingResults")
                    : t("shop.resultsCount", { count: totalResults })}
                </p>

                <Select value={values.sort} onValueChange={(v) => updateValues({ sort: v })}>
                  <SelectTrigger className="w-[140px] sm:w-[170px] h-9 rounded-xl text-xs sm:text-sm bg-white dark:bg-ink-900 shrink-0">
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
              <div className="text-center py-16 sm:py-24 bg-white dark:bg-ink-900 rounded-2xl border border-dashed border-slate-200 dark:border-ink-800">
                <PackageSearch className="w-12 h-12 text-slate-200 dark:text-ink-700 mx-auto mb-4" />
                <p className="text-base font-bold text-slate-700 dark:text-ink-200">{t("shop.noResultsTitle")}</p>
                <p className="text-sm text-slate-400 dark:text-ink-500 mt-1 max-w-sm mx-auto px-4">
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
                      className="rounded-xl h-10 px-6 gap-2 bg-white dark:bg-ink-900"
                    >
                      {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t("shop.loadMore")}
                    </Button>
                  </div>
                )}

                {!hasNextPage && products.length > PAGE_SIZE && (
                  <p className="text-center text-xs text-slate-400 dark:text-ink-500 pt-8">
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
          <SheetHeader className="px-4 py-3 border-b border-slate-100 dark:border-ink-800 shrink-0">
            <SheetTitle className="text-base">{t("shop.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">
            {filterPanel}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-ink-800 shrink-0">
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
