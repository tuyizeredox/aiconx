import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { productsAPI, storesAPI, reviewsAPI, postsAPI } from "@/api/apiClient";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import Logo from "@/components/layout/Logo";
import LanguagePicker from "@/components/layout/LanguagePicker";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, ShoppingBag, Star, Bell, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Seo from "@/components/shared/Seo";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import TrendingProducts from "@/components/landing/TrendingProducts";
import CommunitySection from "@/components/landing/CommunitySection";
import CategoryPills from "@/components/landing/CategoryPills";
import EmptyState from "@/components/landing/EmptyState";
import SellBanner from "@/components/landing/SellBanner";
import MobileTabBar from "@/components/landing/MobileTabBar";
import SiteFooter from "@/components/landing/SiteFooter";
import { authLink, productPath } from "@/components/landing/authLink";

// The landing page is a shop window, not the full catalogue — dumping every
// product makes it endless to scroll on mobile. Products are revealed a page at
// a time instead, which also keeps guests off /marketplace (that one is auth-gated).
const CATALOGUE_PAGE_SIZE = 10;

export default function LandingPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("-sales_count");
  const [visibleCount, setVisibleCount] = useState(CATALOGUE_PAGE_SIZE);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  // Auto-hide the mobile top bar on scroll-down and reveal it on scroll-up,
  // matching the native app feel used across the rest of the product (see Layout.jsx).
  useEffect(() => {
    if (isMobile === false) return;
    lastScrollYRef.current = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollYRef.current;
        if (currentY < 60) {
          setTopBarHidden(false);
        } else if (delta > 8) {
          setTopBarHidden(true);
        } else if (delta < -8) {
          setTopBarHidden(false);
        }
        lastScrollYRef.current = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Smooth-scroll for the in-page nav anchors (#trending, #stores, #community, #sell).
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["landingProducts", category, sort],
    queryFn: async () => {
      const filters = { status: "active", sort, limit: 24 };
      if (category !== "all") filters.category = category;
      const res = await productsAPI.list(filters);
      return res.data || [];
    },
  });

  const { data: trendingProducts = [], isLoading: trendingLoading } = useQuery({
    queryKey: ["landingTrending"],
    queryFn: async () => {
      const res = await productsAPI.list({ status: "active", sort: "-sales_count", limit: 4 });
      return res.data || [];
    },
  });

  const { data: storesResponse = {}, isLoading: storesLoading } = useQuery({
    queryKey: ["landingFeaturedStores"],
    queryFn: async () => storesAPI.list({ status: "active", sort: "-follower_count", limit: 5 }),
  });

  const { data: platformStats = { postsTotal: 0, productsTotal: 0, storesTotal: 0, reviewsTotal: 0 } } = useQuery({
    queryKey: ["landingStats"],
    queryFn: async () => {
      const [postsRes, productsRes, storesRes, reviewsRes] = await Promise.all([
        postsAPI.list({ visibility: "public", limit: 1 }),
        productsAPI.list({ status: "active", limit: 1 }),
        storesAPI.list({ status: "active", limit: 1 }),
        reviewsAPI.list({ limit: 1 }),
      ]);
      return {
        postsTotal: postsRes.total || 0,
        productsTotal: productsRes.total || 0,
        storesTotal: storesRes.total || 0,
        reviewsTotal: reviewsRes.pagination?.total || 0,
      };
    },
  });

  const stores = Array.isArray(storesResponse?.data) ? storesResponse.data : [];

  const filtered = search
    ? products.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
    : products;

  // Collapse back to the first page whenever the result set changes underneath,
  // otherwise a narrow search inherits however far the previous one was expanded.
  useEffect(() => {
    setVisibleCount(CATALOGUE_PAGE_SIZE);
  }, [search, category, sort]);

  const visibleProducts = filtered.slice(0, visibleCount);
  const remainingCount = filtered.length - visibleProducts.length;

  const avgRating = useMemo(() => {
    const rated = products.filter(p => p.rating_count > 0);
    const totalCount = rated.reduce((sum, p) => sum + p.rating_count, 0);
    if (totalCount === 0) return 0;
    const weighted = rated.reduce((sum, p) => sum + p.rating_avg * p.rating_count, 0);
    return weighted / totalCount;
  }, [products]);

  const scrollToCatalogue = () => {
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") scrollToCatalogue();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
      <Seo
        path="/"
        title="Social Commerce & AI-Powered Shopping"
        description="Post your lifestyle, follow creators, join communities and shop what you discover — Aicon X is the social network where shopping happens."
      />

      {/* Navbar — compact + auto-hiding on mobile scroll, full nav on desktop */}
      <header
        className={`sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-out ${
          topBarHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 lg:h-16 flex items-center gap-4">
          <Logo size="sm" showText />

          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {/* #feed and #community are gone with the feed/activity sections. */}
            <a href="#trending" className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
              {t("landing.nav.shop")}
            </a>
            <a href="#stores" className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
              {t("landing.nav.stores")}
            </a>
            <a href="#catalogue" className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
              {t("shop.products")}
            </a>
            <a href="#sell" className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
              {t("landing.nav.sell")}
            </a>
          </nav>

          <div className="hidden md:block relative flex-1 max-w-md mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t("landing.nav.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          {/* Desktop action cluster */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 ml-auto">
            <Link
              to="/login"
              state={{ from: "/notifications" }}
              className="flex w-9 h-9 rounded-full items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              state={{ from: "/wishlist" }}
              className="flex w-9 h-9 rounded-full items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="w-4 h-4" />
            </Link>
            <LanguagePicker compact />
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white">
                {t("common.login")}
              </Button>
            </Link>
            <Link {...authLink("/mystore")}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md shadow-orange-500/20">
                {t("landing.nav.createStore")}
              </Button>
            </Link>
          </div>

          {/* Mobile action cluster — everything else lives in the bottom tab bar */}
          <div className="flex lg:hidden items-center gap-1 shrink-0 ml-auto">
            <LanguagePicker compact />
            <button
              onClick={scrollToCatalogue}
              aria-label={t("shop.searchProducts")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* The MobileTabBar clearance now lives on SiteFooter, which is the last thing on the page. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8 sm:space-y-14 pb-8 lg:pb-6">

        <Hero
          stats={{
            postsTotal: platformStats.postsTotal,
            productsTotal: platformStats.productsTotal,
            storesTotal: platformStats.storesTotal,
            reviewsTotal: platformStats.reviewsTotal,
          }}
          avgRating={avgRating}
        />

        <HowItWorks />

        <TrendingProducts products={trendingProducts} isLoading={trendingLoading} />

        <CommunitySection stores={stores} storesLoading={storesLoading} />

        <div className="sticky top-14 lg:static z-30 -mx-4 px-4 py-2.5 lg:mx-0 lg:px-0 lg:py-0 bg-white/95 dark:bg-slate-950/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-b border-slate-100 dark:border-slate-800 lg:border-0">
          <CategoryPills value={category} onChange={setCategory} />
        </div>

        {/* Full Products Catalogue */}
        <div id="catalogue" className="scroll-mt-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("shop.products")}</h2>
            {/* "0 products" reads as a dead catalogue, so the count only appears once there is one. */}
            {filtered.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>{filtered.length} {t("shop.products").toLowerCase()}</span>
              </div>
            )}
          </div>

          {/* Search & Sort */}
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
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-44 h-10 rounded-xl">
                <SelectValue placeholder={t("shop.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-sales_count">{t("shop.bestSelling")}</SelectItem>
                <SelectItem value="-created_at">{t("shop.newest")}</SelectItem>
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
              : visibleProducts.map((product, idx) => {
                const productId = product?.id || product?._id;
                const discount = product.compare_at_price
                  ? Math.round((1 - product.price / product.compare_at_price) * 100)
                  : 0;
                return (
                  // Public route — no sign-up wall between a guest and a product page.
                  <Link key={productId || idx} to={productPath(productId)}>
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
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">{product.store_name || t("profile.store")}</p>
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

          {remainingCount > 0 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + CATALOGUE_PAGE_SIZE)}
                className="h-11 px-6 font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-orange-400 hover:text-orange-600 active:scale-[0.98] transition-transform"
              >
                {t("landing.catalogue.showMore", { count: remainingCount })}
              </Button>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            search ? (
              <div className="text-center py-16 text-slate-400">{t("shop.noProducts")}</div>
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title={t("landing.catalogue.emptyTitle")}
                description={t("landing.catalogue.emptyDesc")}
                cta={t("landing.catalogue.emptyCta")}
                to={authLink("/mystore")}
              />
            )
          )}
        </div>

        <SellBanner />

      </div>

      <SiteFooter />

      <MobileTabBar />
    </div>
  );
}
