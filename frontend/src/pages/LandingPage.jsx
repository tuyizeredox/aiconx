import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { productsAPI, storesAPI, storiesAPI } from "@/api/apiClient";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/layout/Logo";
import LanguagePicker from "@/components/layout/LanguagePicker";
import { ProductSkeleton, StoreSkeleton } from "@/components/shared/LoadingSkeleton";
import { Search, ShoppingBag, Star, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import StoryViewer from "@/components/stories/StoryViewer";

export default function LandingPage() {
  const { t } = useTranslation();
  const [storesOpen, setStoresOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("-created_date");
  const [viewerIndex, setViewerIndex] = useState(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["landingProducts", category, sort],
    queryFn: async () => {
      const filters = { status: "active", sort, limit: 24 };
      if (category !== "all") filters.category = category;
      const res = await productsAPI.list(filters);
      return res.data || [];
    },
  });

  const { data: storesResponse = {}, isLoading: storesLoading } = useQuery({
    queryKey: ["landingFeaturedStores"],
    queryFn: async () => {
      const res = await storesAPI.list({ status: "active", sort: "-follower_count", limit: 6 });
      return res;
    },
  });

  const { data: storiesRaw = [] } = useQuery({
    queryKey: ["landingStories"],
    queryFn: async () => {
      const res = await storiesAPI.list({ is_active: true, limit: 20 });
      return res.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const now = Date.now();
  const activeStories = storiesRaw.filter((story) => {
    if (story.expires_at) return new Date(story.expires_at).getTime() > now;
    const created = story.created_at || story.created_date;
    if (created) return now - new Date(created).getTime() < 24 * 60 * 60 * 1000;
    return false;
  });

  const uniqueStories = activeStories.reduce((acc, story) => {
    if (!acc.find(s => s.author_username === story.author_username)) acc.push(story);
    return acc;
  }, []);

  const stores = Array.isArray(storesResponse?.data) ? storesResponse.data : [];

  const filtered = search
    ? products.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">

      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Logo size="sm" showText />

          {uniqueStories.length > 0 && (
            <div className="flex-1 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-3 w-max px-2">
                {uniqueStories.map((story, idx) => (
                  <button
                    key={story.id || story._id || story.author_username}
                    onClick={() => setViewerIndex(idx)}
                    className="flex flex-col items-center gap-1 shrink-0 focus:outline-none"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 p-[2px]">
                      <div className="w-full h-full rounded-full bg-white dark:bg-slate-950 p-[2px]">
                        <div
                          className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden"
                          style={{ background: story.author_avatar ? undefined : (story.bg_color || "#6366f1") }}
                        >
                          {story.author_avatar ? (
                            <img src={story.author_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            story.author_name?.[0]?.toUpperCase() || story.author_username?.[0]?.toUpperCase() || "U"
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[36px]">
                      {story.author_name?.split(" ")[0] || story.author_username}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <LanguagePicker compact />
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white">
                {t("common.login")}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md shadow-orange-500/20">
                {t("common.register")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Products Catalogue */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("shop.products")}</h2>
              {(stores.length > 0 || storesLoading) && (
                <button
                  onClick={() => setStoresOpen(o => !o)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
                >
                  {t("shop.stores")}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${storesOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShoppingBag className="w-4 h-4" />
              <span>{products.length} {t("shop.products").toLowerCase()}</span>
            </div>
          </div>

          {/* Stores carousel — shown only when toggled open */}
          {storesOpen && (
            <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar mb-4">
              <div className="flex gap-3" style={{ width: "max-content" }}>
                {storesLoading
                  ? Array(6).fill(0).map((_, i) => <StoreSkeleton key={`ls-${i}`} />)
                  : stores.map((store, idx) => (
                    <Link
                      key={store.id || store._id || `ls-store-${idx}`}
                      to="/register"
                      className="w-24 shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 text-center hover:shadow-md transition-shadow"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-100 to-orange-100 dark:from-orange-900 dark:to-orange-900 flex items-center justify-center mx-auto mb-1.5 text-sm overflow-hidden">
                        {store.logo_url ? (
                          <img src={store.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          store.name?.[0]?.toUpperCase()
                        )}
                      </div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{store.name}</h3>
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        {store.is_verified && <span className="text-orange-500 text-[10px]">✓</span>}
                        <span className="text-[10px] text-slate-400">{store.product_count || 0}</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("shop.searchProducts")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40 h-10 rounded-xl">
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
              <SelectTrigger className="w-44 h-10 rounded-xl">
                <SelectValue placeholder={t("shop.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-created_date">{t("shop.newest")}</SelectItem>
                <SelectItem value="-sales_count">{t("shop.bestSelling")}</SelectItem>
                <SelectItem value="price">{t("shop.priceLowHigh")}</SelectItem>
                <SelectItem value="-price">{t("shop.priceHighLow")}</SelectItem>
                <SelectItem value="-rating_avg">{t("shop.topRated")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4">
            {isLoading
              ? Array(15).fill(0).map((_, i) => <ProductSkeleton key={`lp-sk-${i}`} />)
              : filtered.map((product, idx) => {
                const productId = product?.id || product?._id;
                const discount = product.compare_at_price
                  ? Math.round((1 - product.price / product.compare_at_price) * 100)
                  : 0;
                return (
                  <Link key={productId || idx} to="/register">
                    <motion.div
                      whileHover={{ y: -4 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-slate-950 transition-all duration-300 group"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
                          alt={product.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {discount > 0 && (
                          <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                            -{discount}%
                          </div>
                        )}
                        {product.status === "sold_out" && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-sm uppercase tracking-wider">{t("product.outOfStock")}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">{product.store_name || "Store"}</p>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">{product.title}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-base font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.price)}</span>
                          {product.compare_at_price > 0 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{formatCurrency(product.compare_at_price)}</span>
                          )}
                        </div>
                        {product.rating_avg > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{product.rating_avg?.toFixed(1)}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">({product.rating_count})</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
          </div>

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">{t("shop.noProducts")}</div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {viewerIndex !== null && (
          <StoryViewer
            stories={uniqueStories}
            startIndex={viewerIndex}
            guestMode={true}
            onClose={() => setViewerIndex(null)}
            onNext={() => {
              if (viewerIndex < uniqueStories.length - 1) setViewerIndex(i => i + 1);
              else setViewerIndex(null);
            }}
            onPrev={() => {
              if (viewerIndex > 0) setViewerIndex(i => i - 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
