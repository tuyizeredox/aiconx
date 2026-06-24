import React, { useState, useRef, useEffect, useCallback } from "react";
import { productsAPI, storesAPI, usersAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Search, Package, Store, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";

const CATEGORIES = ["all", "products", "stores", "users"];

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const debounceSet = useCallback(debounce((val) => setDebouncedQuery(val), 300), []);

  useEffect(() => { debounceSet(query); }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const enabled = debouncedQuery.trim().length >= 2;

  const { data: products = [], isFetching: loadingProducts } = useQuery({
    queryKey: ["search_products", debouncedQuery],
    queryFn: async () => {
      const res = await productsAPI.list({ sort: "-sales_count", limit: 100 });
      return res.data || [];
    },
    enabled,
    select: (data) => data
      .filter(p => p.title?.toLowerCase().includes(debouncedQuery.toLowerCase()) || p.description?.toLowerCase().includes(debouncedQuery.toLowerCase()))
      .slice(0, 5),
  });

  const { data: stores = [], isFetching: loadingStores } = useQuery({
    queryKey: ["search_stores", debouncedQuery],
    queryFn: async () => {
      const res = await storesAPI.list({ sort: "-follower_count", limit: 100 });
      return res.data || [];
    },
    enabled,
    select: (data) => data
      .filter(s => s.name?.toLowerCase().includes(debouncedQuery.toLowerCase()) || s.description?.toLowerCase().includes(debouncedQuery.toLowerCase()))
      .slice(0, 4),
  });

  const { data: users = [], isFetching: loadingUsers } = useQuery({
    queryKey: ["search_users", debouncedQuery],
    queryFn: async () => {
      const res = await usersAPI.search(debouncedQuery);
      return res.data || res || [];
    },
    enabled,
    select: (data) => (Array.isArray(data) ? data : data?.data || []).slice(0, 4),
  });

  const isLoading = loadingProducts || loadingStores || loadingUsers;
  const hasResults = products.length > 0 || stores.length > 0 || users.length > 0;

  const showProducts = activeCategory === "all" || activeCategory === "products";
  const showStores   = activeCategory === "all" || activeCategory === "stores";
  const showUsers    = activeCategory === "all" || activeCategory === "users";

  const handleResultClick = () => {
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Enter" && query.trim()) {
      navigate(createPageUrl("Marketplace") + `?search=${encodeURIComponent(query)}`);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-300 focus-within:shadow-sm">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search products, stores, people..."
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(""); setDebouncedQuery(""); setOpen(false); }}>
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden min-w-[320px]"
          >
            {/* Category filter tabs */}
            <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto hide-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-lg capitalize transition-colors ${
                    activeCategory === cat ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                </div>
              )}

              {!isLoading && !hasResults && (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No results for "<span className="font-medium">{query}</span>"</p>
                </div>
              )}

              {/* Products */}
              {!isLoading && showProducts && products.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">Products</p>
                  {products.map(p => (
                    <Link
                      key={p.id}
                      to={createPageUrl("ProductDetail") + `?id=${p.id}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-300 m-auto mt-2" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                        <p className="text-xs text-slate-400">{p.store_name || "Store"} · <span className="font-semibold text-indigo-600">${p.price}</span></p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Stores */}
              {!isLoading && showStores && stores.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 border-t border-slate-100">Stores</p>
                  {stores.map(s => (
                    <Link
                      key={s.id || s._id}
                      to={createPageUrl("StoreDetail") + `?id=${s.id || s._id}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden flex items-center justify-center shrink-0">
                        {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{s.category} · {s.product_count || 0} products</p>
                      </div>
                      {s.is_verified && <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full shrink-0">✓ Verified</span>}
                    </Link>
                  ))}
                </div>
              )}

              {/* Users */}
              {!isLoading && showUsers && users.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 border-t border-slate-100">People</p>
                  {users.map(u => (
                    <Link
                      key={u.id || u._id}
                      to={createPageUrl("Profile") + `?username=${u.username}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 overflow-hidden flex items-center justify-center shrink-0">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-bold text-sm">{u.full_name?.[0]?.toUpperCase() || "U"}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.display_name || u.full_name || "User"}</p>
                        <p className="text-xs text-slate-400 truncate">@{u.username || u.display_name?.replace(/\s+/g, '_').toLowerCase()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-[10px] text-slate-400">Press <kbd className="bg-white border border-slate-200 rounded px-1 text-[10px]">Enter</kbd> to search all products</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}