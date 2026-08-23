import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, UserPlus } from "lucide-react";

import PostCard from "@/components/shared/PostCard";
import StoriesRow from "@/components/stories/StoriesRow";
import { PostSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import FeedSearchBar from "@/components/home/FeedSearchBar";
import CategoryRow, { FEED_CHIPS } from "@/components/home/CategoryRow";
import NearbyProducts from "@/components/home/NearbyProducts";
import BusinessProductPost from "@/components/home/BusinessProductPost";
import CategoryProductGrid from "@/components/home/CategoryProductGrid";
import RecommendedSection from "@/components/home/RecommendedSection";
import SuggestedUsers from "@/components/home/SuggestedUsers";

import { postsAPI, productsAPI, storesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import useGeolocation from "@/hooks/useGeolocation";
import { createPageUrl } from "@/lib/utils";
import { rankProducts } from "@/lib/personalization";

const POSTS_PER_PAGE = 10;

/**
 * Home — the shoppable discovery feed.
 *
 * This is the first thing anyone sees, signed in or not, so it answers one
 * question immediately: "is there something here I want?". Everything on the
 * screen is either content to discover or a product to buy; the wallet,
 * affiliate dashboard, store admin and settings all live behind the menu and
 * the Profile tab, because none of them are why someone opens the app.
 *
 * The feed mixes three kinds of thing, in one column:
 *   - creator posts, whose tagged products open with "Shop this look"
 *   - shops posting what just arrived
 *   - rails of products: near you, and picked for you
 *
 * Tapping a category swaps the whole feed for a product grid — someone who
 * taps "Beauty" has stopped browsing and started looking.
 */
export default function Home() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [chip, setChip] = useState(FEED_CHIPS[0]);
  const loadMoreRef = useRef(null);
  const geo = useGeolocation();

  const isSocialFeed = chip.kind === "feed";
  const followingOnly = chip.id === "following";

  /* ---------------------------------------------------------------- posts */

  const {
    data: postsData,
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", chip.id, currentUser?.username],
    queryFn: ({ pageParam = 1 }) => {
      const params = { limit: POSTS_PER_PAGE, page: pageParam, sort: "-created_at" };
      if (currentUser?.username) params.user_username = currentUser.username;
      if (followingOnly && currentUser?.username) params.following_only = true;
      return postsAPI.list(params);
    },
    getNextPageParam: (lastPage) =>
      lastPage.data?.length === POSTS_PER_PAGE ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: isSocialFeed,
  });

  const posts = useMemo(
    () => postsData?.pages.flatMap((page) => page.data) || [],
    [postsData]
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "800px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  /* ------------------------------------------------- shops & new arrivals */

  // Shops earn a place in the feed by having posted something recently, so
  // this is one query for what's new rather than a query per shop.
  const { data: arrivalsRes } = useQuery({
    queryKey: ["feedNewArrivals"],
    queryFn: () => productsAPI.list({ status: "active", sort: "-created_at", limit: 60 }),
    staleTime: 5 * 60 * 1000,
    enabled: isSocialFeed,
  });

  const { data: storesRes } = useQuery({
    queryKey: ["feedStores"],
    queryFn: () => storesAPI.list({ limit: 100, sort: "-follower_count" }),
    staleTime: 10 * 60 * 1000,
    enabled: isSocialFeed,
  });

  const storeById = useMemo(() => {
    const map = new Map();
    (storesRes?.data || []).forEach((s) => map.set(String(s.id || s._id), s));
    return map;
  }, [storesRes]);

  // Nearby shops are resolved once here and shared: the rail, the business
  // cards and the category grid all read distances off the same lookup, so a
  // shopper is only ever asked for their location once.
  const { data: nearbyRes } = useQuery({
    queryKey: ["nearbyStores", geo.coords?.lat, geo.coords?.lng, 15],
    queryFn: () => storesAPI.nearby({ lat: geo.coords.lat, lng: geo.coords.lng, radius_km: 15, limit: 60 }),
    enabled: !!geo.coords,
    staleTime: 5 * 60 * 1000,
  });

  const distanceByStore = useMemo(() => {
    const map = new Map();
    (nearbyRes?.data || []).forEach((s) => map.set(String(s.id || s._id), s.distance_km));
    return map;
  }, [nearbyRes]);

  const businessPosts = useMemo(() => {
    const ranked = rankProducts(arrivalsRes?.data || []);
    const byStore = new Map();
    ranked.forEach((p) => {
      const key = String(p.store_id || "");
      if (!key) return;
      if (!byStore.has(key)) byStore.set(key, []);
      byStore.get(key).push(p);
    });
    return [...byStore.entries()].map(([storeId, products]) => ({
      storeId,
      store: storeById.get(storeId),
      storeName: products[0]?.store_name,
      products,
      distanceKm: distanceByStore.get(storeId) ?? null,
    }));
  }, [arrivalsRes, storeById, distanceByStore]);

  /* ------------------------------------------------------------- assembly */

  // Interleaving is positional rather than random so the feed doesn't reshuffle
  // under the shopper on every render: a nearby rail early (it is the most
  // location-specific thing we can offer), then shops and picks spaced far
  // enough apart that the column still reads as content, not as a catalogue.
  const feedNodes = useMemo(() => {
    const nodes = [];
    let businessIndex = 0;

    posts.forEach((post, i) => {
      nodes.push({ key: "post-" + (post.id || post._id || i), type: "post", post });

      if (i === 1) {
        nodes.push({ key: "nearby", type: "nearby" });
      } else if (i > 1 && (i - 2) % 4 === 0 && businessIndex < businessPosts.length) {
        const business = businessPosts[businessIndex++];
        nodes.push({ key: "business-" + business.storeId, type: "business", business });
      } else if (i > 3 && (i - 4) % 6 === 0) {
        nodes.push({ key: "recommended-" + i, type: "recommended" });
      } else if (i === 8 && currentUser) {
        nodes.push({ key: "suggested", type: "suggested" });
      }
    });

    return nodes;
  }, [posts, businessPosts, currentUser]);

  /* --------------------------------------------------------------- render */

  const renderSocialFeed = () => {
    if (postsLoading) {
      return (
        <div className="space-y-4">
          <RecommendedSection currentUser={currentUser} />
          {Array(2).fill(0).map((_, i) => <PostSkeleton key={"post-sk-" + i} />)}
        </div>
      );
    }

    // An empty feed still has products to show — a first-time shopper should
    // never land on a blank screen just because nobody they follow has posted.
    if (posts.length === 0) {
      return (
        <div className="space-y-8">
          <RecommendedSection currentUser={currentUser} />
          <NearbyProducts geo={geo} />
          {businessPosts.slice(0, 3).map((b) => (
            <BusinessProductPost
              key={b.storeId}
              store={b.store}
              storeName={b.storeName}
              products={b.products}
              distanceKm={b.distanceKm}
            />
          ))}
          <EmptyState
            icon={followingOnly ? UserPlus : Sparkles}
            title={followingOnly ? t("home.noFollowingTitle") : t("home.feedEmptyTitle")}
            description={followingOnly ? t("home.noFollowingDesc") : t("home.feedEmptyDesc")}
            action={
              <Link to={createPageUrl("Explore")}>
                <Button className="rounded-full h-11 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                  {t("home.explore")}
                </Button>
              </Link>
            }
          />
          {followingOnly && currentUser && <SuggestedUsers currentUser={currentUser} />}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {feedNodes.map((node) => {
          switch (node.type) {
            case "post":
              return (
                <PostCard
                  key={node.key}
                  post={node.post}
                  currentUser={currentUser}
                  feedPosts={posts}
                />
              );
            case "nearby":
              return <NearbyProducts key={node.key} geo={geo} />;
            case "business":
              return (
                <BusinessProductPost
                  key={node.key}
                  store={node.business.store}
                  storeName={node.business.storeName}
                  products={node.business.products}
                  distanceKm={node.business.distanceKm}
                />
              );
            case "recommended":
              return <RecommendedSection key={node.key} currentUser={currentUser} />;
            case "suggested":
              return <SuggestedUsers key={node.key} currentUser={currentUser} />;
            default:
              return null;
          }
        })}

        <div ref={loadMoreRef} className="py-6 flex justify-center">
          {isFetchingNextPage ? (
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          ) : !hasNextPage ? (
            <p className="text-xs text-slate-300 dark:text-slate-600">{t("home.endOfFeed")}</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Search and categories travel with the feed: the two things a shopper
          reaches for mid-scroll are "find something else" and "show me that
          category", and neither should cost a scroll back to the top.

          --app-bar-offset is published by Layout as its top bar hides and
          reveals on scroll, so this block rides with it as one header rather
          than hovering over a gap. */}
      <div
        className="sticky z-30 px-4 pt-2 pb-2.5 bg-slate-50/90 dark:bg-[#0a0a0c]/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70 transition-[top] duration-300 ease-out"
        style={{ top: "calc(env(safe-area-inset-top) + var(--app-bar-offset, 3.5rem))" }}
      >
        <FeedSearchBar />
        <div className="mt-2.5">
          <CategoryRow active={chip} onChange={setChip} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-6">
        {isSocialFeed && <StoriesRow currentUser={currentUser} />}

        {chip.kind === "nearby" ? (
          <NearbyProducts geo={geo} variant="grid" limit={30} />
        ) : chip.kind === "category" ? (
          <CategoryProductGrid chip={chip} distanceByStore={distanceByStore} />
        ) : (
          renderSocialFeed()
        )}
      </div>
    </div>
  );
}
