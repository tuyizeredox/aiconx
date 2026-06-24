import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import PostCard from "@/components/shared/PostCard";
import ProductCard from "@/components/shared/ProductCard";
import StoriesRow from "@/components/stories/StoriesRow";
import { PostSkeleton, ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Flame, TrendingUp, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecommendedSection from "@/components/home/RecommendedSection";
import SuggestedUsers from "@/components/home/SuggestedUsers";
import { postsAPI, productsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("for_you");
  const { user: currentUser } = useAuth();
  const loadMoreRef = useRef(null);

  const { 
    data: postsData, 
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["posts", activeTab, currentUser?.username],
    queryFn: ({ pageParam = 1 }) => {
      const params = { limit: 10, page: pageParam };
      if (currentUser?.username) {
        params.user_username = currentUser.username;
      }

      if (activeTab === "trending") {
        params.sort = "-likes_count";
      } else if (activeTab === "following" && currentUser?.username) {
        params.following_only = true;
        params.sort = "-created_at";
      } else {
        params.sort = "-created_at";
      }
      return postsAPI.list(params);
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.data && lastPage.data.length === 10) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const posts = postsData?.pages.flatMap(page => page.data) || [];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: trendingProductsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ["trendingProducts"],
    queryFn: () => productsAPI.list({ status: "active", sort: "-sales_count", limit: 8 }),
  });
  const trendingProducts = trendingProductsResponse?.data || [];

  const tabs = [
    { id: "for_you", label: t("home.forYou"), icon: Sparkles },
    { id: "trending", label: t("home.trending"), icon: Flame },
    { id: "following", label: t("home.following"), icon: TrendingUp },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-0 lg:py-6">
      {/* Stories Row */}
      <StoriesRow currentUser={currentUser} />

      {/* Feed Tabs */}
      <div className="flex items-center gap-1 py-3 border-b border-slate-100 dark:border-slate-700 mb-4 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "text-white dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-slate-900 dark:bg-white rounded-full -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Recommended for You */}
          {activeTab === "for_you" && <RecommendedSection currentUser={currentUser} />}

          {/* Trending Products Section */}
          {trendingProducts.length > 0 && activeTab === "trending" && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  {t("home.trending")}
                </h2>
                <Link to={createPageUrl("Marketplace")} className="text-xs text-orange-600 font-medium flex items-center gap-0.5">
                  {t("home.seeAll")} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
                <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                  {productsLoading
                    ? Array(4).fill(0).map((_, i) => (
                        <div key={`trending-skeleton-${i}`} className="w-44 shrink-0"><ProductSkeleton /></div>
                      ))
: trendingProducts.slice(0, 8).map((product, idx) => (
                         <div key={product._id || product.id || `trending-${idx}`} className="w-44 shrink-0">
                           <ProductCard product={product} compact currentUser={currentUser} />
                         </div>
                       ))}
                </div>
              </div>
            </div>
          )}

          {/* Posts Feed */}
          <div className="space-y-4">
            {postsLoading ? (
              Array(3).fill(0).map((_, i) => <PostSkeleton key={`post-skeleton-${i}`} />)
            ) : posts.length === 0 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <EmptyState
                  icon={TrendingUp}
                  title={activeTab === "following" ? t("home.noFollowingTitle") : t("home.feedEmptyTitle")}
                  description={
                    activeTab === "following" 
                      ? t("home.noFollowingDesc")
                      : t("home.feedEmptyDesc")
                  }
                  action={
                    <div className="flex gap-3">
                      {activeTab === "following" ? (
                        <Link to={createPageUrl("Explore")}>
                          <Button className="bg-orange-600 hover:bg-orange-700">{t("home.findPeopleToFollow")}</Button>
                        </Link>
                      ) : (
                        <>
                          <Link to={createPageUrl("CreatePost")}>
                            <Button className="bg-orange-600 hover:bg-orange-700">{t("home.createPost")}</Button>
                          </Link>
                          <Link to={createPageUrl("Explore")}>
                            <Button variant="outline">{t("home.explore")}</Button>
                          </Link>
                        </>
                      )}
                    </div>
                  }
                />
                
                {activeTab === "following" && (
                  <div className="max-w-md mx-auto">
                    <SuggestedUsers currentUser={currentUser} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {posts.map((post, idx) => (
                  <PostCard 
                    key={post.id || post._id || `home-post-${idx}`} 
                    post={post} 
                    currentUser={currentUser} 
                  />
                ))}
                
                {/* Infinite Scroll Trigger */}
                <div 
                  ref={loadMoreRef} 
                  className="py-8 flex justify-center"
                >
                  {isFetchingNextPage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium">{t("home.loadingMore")}</p>
                    </div>
                  ) : hasNextPage ? (
                    <p className="text-xs text-slate-300 dark:text-slate-600">{t("home.scrollForMore")}</p>
                  ) : (
                    <p className="text-xs text-slate-300 dark:text-slate-600 italic">{t("home.endOfFeed")}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}