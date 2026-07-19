import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import AvatarImg from "@/components/shared/AvatarImg";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Search, TrendingUp, Sparkles, X, User, Store, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { productsAPI, communitiesAPI, usersAPI, storesAPI, followsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "all", tKey: "explore.cat.all", emoji: "✨" },
  { id: "fashion", tKey: "explore.cat.fashion", emoji: "👗" },
  { id: "electronics", tKey: "explore.cat.electronics", emoji: "📱" },
  { id: "home", tKey: "explore.cat.home", emoji: "🏠" },
  { id: "beauty", tKey: "explore.cat.beauty", emoji: "💄" },
  { id: "sports", tKey: "explore.cat.sports", emoji: "⚽" },
  { id: "food", tKey: "explore.cat.food", emoji: "🍕" },
  { id: "art", tKey: "explore.cat.art", emoji: "🎨" },
  { id: "books", tKey: "explore.cat.books", emoji: "📚" },
  { id: "handmade", tKey: "explore.cat.handmade", emoji: "🧶" },
];

export default function Explore() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [category, setCategory] = useState("all");
  const tab = searchParams.get("tab");

  // Deep link support for #hashtag / @mention links landing here from posts
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearch(urlSearch);
  }, [searchParams]);
  const debouncedSearch = useDebounce(search, 500);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [localFollowedUsers, setLocalFollowedUsers] = useState(new Set());

  const { data: productsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ["exploreProducts", category, debouncedSearch],
    queryFn: () => {
      const filters = { status: "active", sort: "-created_at", limit: 50 };
      if (category !== "all") filters.category = category;
      if (debouncedSearch) filters.search = debouncedSearch;
      return productsAPI.list(filters);
    },
  });
  const products = productsResponse?.data || [];

  const { data: communitiesResponse, isLoading: communitiesLoading } = useQuery({
    queryKey: ["exploreCommunities", debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch) {
        const res = await communitiesAPI.list({ search: debouncedSearch, limit: 10 });
        return res.data || res.communities || [];
      }
      const res = await communitiesAPI.list({ sort: "-member_count", limit: 6 });
      return res.data || res.communities || [];
    },
  });
  const communities = Array.isArray(communitiesResponse) ? communitiesResponse : [];

  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ["exploreUsers", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      return usersAPI.search(debouncedSearch);
    },
    enabled: !!debouncedSearch,
  });
  const users = Array.isArray(usersResponse) ? usersResponse : usersResponse?.data || [];

  // Fetch suggested users and stores when tab=suggestions
  const { data: suggestedUsersResponse, isLoading: suggestedLoading } = useQuery({
    queryKey: ["suggestedUsersFull"],
    queryFn: () => usersAPI.getSuggested({ limit: 20 }),
    enabled: tab === "suggestions" && !!currentUser?.username,
  });

  const { data: suggestedStoresResponse } = useQuery({
    queryKey: ["suggestedStoresFull"],
    queryFn: () => storesAPI.list({ limit: 20, sort: "-follower_count" }),
    enabled: tab === "suggestions" && !!currentUser?.username,
  });

  const suggestedUsers = (suggestedUsersResponse?.users || [])
    .filter(user => user.username !== currentUser?.username);

  const suggestedStores = (suggestedStoresResponse?.data || [])
    .filter(store => store.owner_username !== currentUser?.username);

  // Check follow status for suggestions
  const { data: followStatuses, refetch: refetchFollowStatuses } = useQuery({
    queryKey: ["exploreFollowStatuses", currentUser?.username],
    queryFn: async () => {
      const statuses = {};

      // Check users
      for (const user of suggestedUsers) {
        try {
          const status = await followsAPI.check({
            follower_username: currentUser.username,
            following_username: user.username,
            follow_type: 'user'
          });
          statuses[user.username] = status.is_following;
        } catch (e) {
          statuses[user.username] = false;
        }
      }

      // Check stores
      for (const store of suggestedStores) {
        try {
          const status = await followsAPI.check({
            follower_username: currentUser.username,
            following_username: store.owner_username,
            follow_type: 'store',
            target_id: store._id
          });
          statuses[store.owner_username] = status.is_following;
        } catch (e) {
          statuses[store.owner_username] = false;
        }
      }

      return statuses;
    },
    enabled: tab === "suggestions" && (suggestedUsers.length > 0 || suggestedStores.length > 0) && !!currentUser?.username,
  });

  // Filter out already followed users/stores
  const filteredSuggestedUsers = useMemo(() => {
    if (!followStatuses) return [];
    return suggestedUsers.filter(user => {
      const apiSaysFollowing = followStatuses[user.username] === true;
      const localSaysFollowing = localFollowedUsers.has(user.username);
      return !apiSaysFollowing && !localSaysFollowing;
    });
  }, [suggestedUsers, followStatuses, localFollowedUsers]);

  const filteredSuggestedStores = useMemo(() => {
    if (!followStatuses) return [];
    return suggestedStores.filter(store => {
      const apiSaysFollowing = followStatuses[store.owner_username] === true;
      const localSaysFollowing = localFollowedUsers.has(store.owner_username);
      return !apiSaysFollowing && !localSaysFollowing;
    });
  }, [suggestedStores, followStatuses, localFollowedUsers]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async ({ username, type, targetId, isFollowing }) => {
      if (isFollowing) {
        return await followsAPI.unfollow({
          follower_username: currentUser.username,
          following_username: username,
          follow_type: type,
          target_id: targetId
        });
      } else {
        return await followsAPI.follow(username, type, targetId);
      }
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["exploreFollowStatuses", currentUser?.username] });
      const previousFollowStatuses = queryClient.getQueryData(["exploreFollowStatuses", currentUser?.username]);
      queryClient.setQueryData(["exploreFollowStatuses", currentUser?.username], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          [variables.username]: !variables.isFollowing
        };
      });
      setLocalFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (!variables.isFollowing) {
          newSet.add(variables.username);
        } else {
          newSet.delete(variables.username);
        }
        return newSet;
      });
      return { previousFollowStatuses };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(["exploreFollowStatuses", currentUser?.username], context.previousFollowStatuses);
      setLocalFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (!variables.isFollowing) {
          newSet.delete(variables.username);
        } else {
          newSet.add(variables.username);
        }
        return newSet;
      });
      toast.error(error.message || "Failed to update follow status");
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isFollowing ? "Unfollowed" : `Following ${variables.username}`);
      queryClient.invalidateQueries({ queryKey: ["followStatus"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["exploreFollowStatuses", currentUser?.username] });
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder={t("explore.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 pr-4 h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-base focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Categories (Only show when not searching or show as filters) */}
      {!search && !tab && (
        <div className="overflow-x-auto -mx-4 px-4 mb-6 hide-scrollbar">
          <div className="flex gap-2" style={{ width: "max-content" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  category === cat.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <span>{cat.emoji}</span>
                {t(cat.tKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Tab */}
      {tab === "suggestions" && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Suggested for you</h2>
          {suggestedLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Loading suggestions...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSuggestedUsers.map((user) => {
                const isFollowing = followStatuses?.[user.username] || false;
                return (
                  <div key={user.username} className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <Link to={createPageUrl("Profile") + `?username=${user.username}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                        <AvatarImg
                          src={user.avatar_url}
                          className="w-full h-full object-cover"
                          fallback={<User className="w-6 h-6 text-slate-400" />}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.display_name || user.username}</p>
                        <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => followMutation.mutate({
                        username: user.username,
                        type: 'user',
                        targetId: null,
                        isFollowing
                      })}
                      disabled={followMutation.isPending}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {followMutation.isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
              {filteredSuggestedStores.map((store) => {
                const isFollowing = followStatuses?.[store.owner_username] || false;
                return (
                  <div key={store._id} className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <Link to={createPageUrl("StoreDetail") + `?id=${store._id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                        {store.logo_url ? (
                          <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{store.name}</p>
                        <p className="text-xs text-slate-500 truncate">@{store.owner_username}</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => followMutation.mutate({
                        username: store.owner_username,
                        type: 'store',
                        targetId: store._id,
                        isFollowing
                      })}
                      disabled={followMutation.isPending}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {followMutation.isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!suggestedLoading && filteredSuggestedUsers.length === 0 && filteredSuggestedStores.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">No suggestions available</p>
            </div>
          )}
        </div>
      )}

      {/* Search Results for Users */}
      {debouncedSearch && users.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            {t("explore.people")}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {users.map((u) => (
              <Link
                key={u.id || u.username}
                to={createPageUrl("Profile") + `?username=${u.username}`}
                className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 min-w-[100px] hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-50 dark:border-slate-600">
                  <AvatarImg
                    src={u.avatar_url}
                    className="w-full h-full object-cover"
                    fallback={<span className="text-orange-600 dark:text-orange-400 font-bold text-lg">{(u.username || u.display_name)?.[0]?.toUpperCase()}</span>}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate w-full text-center">{u.display_name || u.username}</span>
                <span className="text-[10px] text-slate-400 truncate w-full text-center">@{u.username}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Communities Section */}
      {communities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            {debouncedSearch ? t("explore.relatedCommunities") : t("explore.popularCommunities")}
          </h2>
          <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {communities.map((c) => (
                <Link
                  key={c.id || c._id}
                  to={createPageUrl("CommunityDetail") + `?id=${c.id || c._id}`}
                  className="w-52 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="h-24 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative">
                    {c.cover_image ? (
                      <img src={c.cover_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-white/50" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 -mt-6 relative">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 shadow-lg border-2 border-white dark:border-slate-600 flex items-center justify-center text-2xl mb-3 overflow-hidden">
                      {c.icon_url ? (
                        <img src={c.icon_url} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{c.category === 'fashion' ? '👗' : c.category === 'tech' ? '💻' : c.category === 'fitness' ? '💪' : c.category === 'food' ? '🍕' : c.category === 'art' ? '🎨' : c.category === 'music' ? '🎵' : c.category === 'gaming' ? '🎮' : c.category === 'travel' ? '✈️' : c.category === 'diy' ? '🛠️' : '👥'}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1">{c.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 min-h-[2.5rem]">
                      {c.description || t("explore.noDescription")}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>{t("explore.members", { count: c.member_count || 0 })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          {debouncedSearch ? t("explore.productResultsFor", { search: debouncedSearch }) : t("explore.discoverProducts")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
          {productsLoading
            ? Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
            : products.map((product) => <ProductCard key={product.id || product._id} product={product} />)}
        </div>
        {!productsLoading && products.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400">{t("shop.noProducts")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
