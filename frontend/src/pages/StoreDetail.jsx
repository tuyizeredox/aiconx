import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import {
  ArrowLeft, Users, Package, CheckCircle, MessageCircle, UserPlus, UserCheck,
  Search, Share2, TrendingUp, X, SlidersHorizontal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StoreReviewSection from "@/components/store/StoreReviewSection";
import StarRating from "@/components/reviews/StarRating";
import { storesAPI, productsAPI, reviewsAPI, followsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

export default function StoreDetail() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("id");
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState("-created_at");

  const isValidId = !!storeId && storeId !== "undefined" && storeId !== "null" && storeId.length >= 8;

  const { data: store, error: storeError, isLoading: storeLoading } = useQuery({
    queryKey: ["storeDetail", storeId],
    queryFn: async () => {
      if (!isValidId) throw new Error("Invalid Store ID");
      return storesAPI.get(storeId);
    },
    enabled: isValidId,
    retry: false,
  });

  const { data: followStatus = { is_following: false, is_followed_by: false } } = useQuery({
    queryKey: ["followStatus", currentUser?.username, storeId],
    queryFn: async () => {
      if (!currentUser?.username || !storeId) return { is_following: false, is_followed_by: false };
      const res = await followsAPI.check({
        follower_username: currentUser.username,
        target_id: storeId,
        follow_type: 'store'
      });
      return {
        is_following: !!res.is_following,
        is_followed_by: !!res.is_followed_by
      };
    },
    enabled: !!currentUser?.username && !!storeId && isValidId,
  });

  const isFollowing = followStatus.is_following;
  const isFollowedBy = followStatus.is_followed_by;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error("Please login to follow");
      const followingUsername = store.owner_username || store.name?.toLowerCase().replace(/\s+/g, '_');
      if (isFollowing) {
        await followsAPI.unfollow({
          follower_username: currentUser.username,
          following_username: followingUsername,
          target_id: storeId,
          follow_type: 'store'
        });
      } else {
        await followsAPI.follow(followingUsername, 'store', storeId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followStatus", currentUser?.username, storeId] });
      queryClient.invalidateQueries({ queryKey: ["storeDetail", storeId] });
      toast.success(isFollowing ? t("storeDetail.unfollowedStore") : t("storeDetail.followingStore"));
    },
    onError: (error) => {
      toast.error(error.message || t("errors.somethingWrong"));
    }
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["storeProducts", storeId, category, sort],
    queryFn: async () => {
      if (!isValidId) return { list: [], total: 0 };
      const filters = { store_id: storeId, status: "active", sort, limit: 50 };
      if (category !== "all") filters.category = category;
      const res = await productsAPI.list(filters);
      const list = res.data || (Array.isArray(res) ? res : []);
      return { list, total: typeof res.total === "number" ? res.total : list.length };
    },
    enabled: isValidId,
    retry: false,
  });

  const products = productsData?.list || [];
  const storeProductsTotal = store?.product_count ?? productsData?.total ?? products.length;
  const filteredProducts = search
    ? products.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
    : products;

  const hasActiveFilters = !!search || category !== "all" || sort !== "-created_at";
  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setSort("-created_at");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: store?.name, url });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("storeDetail.linkCopied"));
    } catch {
      toast.error(t("errors.somethingWrong"));
    }
  };

  const { data: storeReviewsData } = useQuery({
    queryKey: ["storeReviews", storeId],
    queryFn: async () => {
      if (!isValidId) return [];
      const res = await reviewsAPI.list({ store_id: storeId, sort: "-created_at", limit: 100 });
      return res.data || res || [];
    },
    enabled: isValidId,
    retry: false,
  });

  const storeReviews = Array.isArray(storeReviewsData) ? storeReviewsData : (storeReviewsData?.data || []);

  const isLoading = storeLoading || productsLoading;

  // Early return if no storeId - MUST BE AFTER ALL HOOKS
  if (!isValidId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <ArrowLeft className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("storeDetail.invalidStore")}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{t("storeDetail.invalidStoreDesc")}</p>
        <Link to={createPageUrl("Marketplace")}>
          <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("storeDetail.backToMarketplace")}</Button>
        </Link>
      </div>
    );
  }

  // Handle 404 or other errors
  if (storeError) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("storeDetail.storeNotFound")}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{storeError.status === 404 ? t("storeDetail.storeMovedOrDeleted") : t("storeDetail.storeLoadError")}</p>
        <Link to={createPageUrl("Marketplace")}>
          <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl">{t("storeDetail.backToMarketplace")}</Button>
        </Link>
      </div>
    );
  }

  if (storeLoading && !store) return <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">{t("common.loading")}</div>;

  const avgRating = storeReviews.length > 0
    ? storeReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / storeReviews.length
    : (store?.rating_avg || 0);

  if (!store && !storeLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">{t("storeDetail.storeNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      <Link to={createPageUrl("Marketplace")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("storeDetail.marketplace")}
      </Link>

      {/* Store Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-6 shadow-sm">
        <div className="h-36 lg:h-56 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 relative">
          {store.banner_url && <img src={store.banner_url} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
          <button
            onClick={handleShare}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            aria-label={t("storeDetail.shareStore")}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 lg:p-6 -mt-12 relative">
          <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-700 shadow-xl border-4 border-white dark:border-slate-700 flex items-center justify-center text-2xl font-bold overflow-hidden">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="bg-gradient-to-br from-orange-400 to-orange-500 w-full h-full flex items-center justify-center text-white">
                {store.name?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{store.name}</h1>
              {store.is_verified && (
                <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />{t("common.verified")}</Badge>
              )}
              {store.category && (
                <Badge variant="outline" className="border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium capitalize">
                  {store.category}
                </Badge>
              )}
            </div>
            {store.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-2xl leading-relaxed">{store.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <Package className="w-3.5 h-3.5 text-orange-500" /> {t("storeDetail.productsCount", { count: storeProductsTotal })}
              </span>
              <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <Users className="w-3.5 h-3.5 text-orange-500" /> {t("storeDetail.followersCount", { count: store.follower_count || 0 })}
              </span>
              {store.total_sales > 0 && (
                <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-500" /> {t("storeDetail.salesCount", { count: store.total_sales })}
                </span>
              )}
              {avgRating > 0 && (
                <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-full px-3 py-1.5">
                  <StarRating value={Math.round(avgRating)} readonly size={4} />
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-400 dark:text-slate-500">{t("storeDetail.reviewsCount", { count: storeReviews.length })}</span>
                </span>
              )}
            </div>
            {currentUser && currentUser.username !== store.owner_username && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  className={`rounded-xl gap-2 font-semibold transition-all ${
                    isFollowing
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                      : "bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-100"
                  }`}
                  size="sm"
                  variant={isFollowing ? "secondary" : "default"}
                >
                  {isFollowing ? (
                    <><UserCheck className="w-4 h-4" /> {t("profile.following")}</>
                  ) : isFollowedBy ? (
                    <><UserPlus className="w-4 h-4" /> {t("profile.followBack")}</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> {t("storeDetail.followStore")}</>
                  )}
                </Button>

                <Link to={createPageUrl("Chat") + `?to=${store.owner_username}`}>
                  <Button variant="outline" className="rounded-xl gap-2 border-slate-200 dark:border-slate-600" size="sm">
                    <MessageCircle className="w-4 h-4" /> {t("storeDetail.chatWithVendor")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {t("storeDetail.allProducts")}
          {!isLoading && (
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
              {filteredProducts.length}
            </span>
          )}
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> {t("storeDetail.clearFilters")}
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t("storeDetail.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <SelectValue placeholder={t("shop.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("shop.allCategories")}</SelectItem>
            <SelectItem value="fashion">{t("shop.categoryFashion")}</SelectItem>
            <SelectItem value="electronics">{t("shop.categoryElectronics")}</SelectItem>
            <SelectItem value="home">{t("shop.categoryHome")}</SelectItem>
            <SelectItem value="beauty">{t("shop.categoryBeauty")}</SelectItem>
            <SelectItem value="sports">{t("shop.categorySports")}</SelectItem>
            <SelectItem value="art">{t("shop.categoryArt")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl">
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {isLoading
          ? Array(8).fill(0).map((_, i) => <ProductSkeleton key={`p-skeleton-${i}`} />)
          : filteredProducts.map((p, idx) => <ProductCard key={p.id || p._id || `p-${idx}`} product={p} />)}
      </div>
      {!isLoading && products.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">{t("storeDetail.noProductsYet")}</div>
      )}
      {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 dark:text-slate-500 mb-3">{t("storeDetail.noResultsFilter")}</p>
          <button onClick={clearFilters} className="text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300">
            {t("storeDetail.clearFilters")}
          </button>
        </div>
      )}

      <StoreReviewSection store={store} currentUser={currentUser} />
    </div>
  );
}
