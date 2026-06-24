import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Search, TrendingUp, Sparkles, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { productsAPI, communitiesAPI, usersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";

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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const debouncedSearch = useDebounce(search, 500);
  const { user: currentUser } = useAuth();

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

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder={t("explore.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 pr-4 h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-base focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Categories (Only show when not searching or show as filters) */}
      {!search && (
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
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{(u.username || u.display_name)?.[0]?.toUpperCase()}</span>
                  )}
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
            <Sparkles className="w-5 h-5 text-indigo-500" />
            {debouncedSearch ? t("explore.relatedCommunities") : t("explore.popularCommunities")}
          </h2>
          <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {communities.map((c) => (
                <Link
                  key={c.id || c._id}
                  to={createPageUrl("CommunityDetail") + `?id=${c.id || c._id}`}
                  className="w-48 shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-20 bg-gradient-to-br from-indigo-400 to-purple-500 relative">
                    {c.cover_image && <img src={c.cover_image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-3 -mt-4 relative">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-lg mb-2">
                      {c.icon_url || "👥"}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name}</h3>
                    <p className="text-xs text-slate-400">{t("explore.members", { count: c.member_count || 0 })}</p>
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
