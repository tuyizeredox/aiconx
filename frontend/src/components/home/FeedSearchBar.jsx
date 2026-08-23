import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Loader2, Package, Store as StoreIcon, Clock } from "lucide-react";
import { productsAPI, storesAPI } from "@/api/apiClient";
import { createPageUrl, storeUrl, formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { recordSignal, getTasteProfile } from "@/lib/personalization";

/**
 * The feed's search field.
 *
 * Search is the shopper's fastest path to a purchase, so matches appear
 * inline as they type and each one links straight to the product page —
 * Search → Product → Buy, with no results page in between. Enter still opens
 * the full Discover results for people who want to browse.
 */
export default function FeedSearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const debounced = useDebounce(query, 250);
  const enabled = debounced.trim().length >= 2;

  const [recent, setRecent] = useState(() => getTasteProfile().recentSearches.slice(0, 5));

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: productsRes, isFetching: loadingProducts } = useQuery({
    queryKey: ["feedSearchProducts", debounced],
    queryFn: () => productsAPI.list({ status: "active", search: debounced, limit: 6, sort: "-sales_count" }),
    enabled,
    staleTime: 60000,
  });

  const { data: storesRes } = useQuery({
    queryKey: ["feedSearchStores", debounced],
    queryFn: () => storesAPI.list({ limit: 60, sort: "-follower_count" }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const products = productsRes?.data || [];
  const stores = (storesRes?.data || [])
    .filter((s) => s.name?.toLowerCase().includes(debounced.trim().toLowerCase()))
    .slice(0, 3);

  const commit = (value) => {
    const q = (value ?? query).trim();
    if (!q) return;
    recordSignal("search", { query: q });
    setRecent(getTasteProfile().recentSearches.slice(0, 5));
    setOpen(false);
    navigate(createPageUrl("Explore") + "?search=" + encodeURIComponent(q));
  };

  const showRecent = open && !enabled && recent.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5 h-11 px-4 rounded-full bg-slate-100 dark:bg-slate-800/80 transition-colors focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-orange-500/60">
        <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder={t("home.searchPlaceholder")}
          aria-label={t("home.searchPlaceholder")}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
        />
        {loadingProducts && <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" />}
        {query && !loadingProducts && (
          <button onClick={() => { setQuery(""); setOpen(false); }} aria-label={t("common.clear")} className="shrink-0">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (enabled || showRecent) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/10 dark:shadow-black/50 border border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {showRecent && recent.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); commit(q); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Clock className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{q}</span>
                </button>
              ))}

              {enabled && products.map((p) => (
                <Link
                  key={p.id || p._id}
                  to={createPageUrl("ProductDetail") + "?id=" + (p.id || p._id)}
                  onClick={() => { recordSignal("search", { query: debounced, category: p.category, price: p.price }); setOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <Package className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{p.store_name}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white shrink-0">{formatCurrency(p.price)}</span>
                </Link>
              ))}

              {enabled && stores.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                  {stores.map((s) => (
                    <Link
                      key={s.id || s._id}
                      to={storeUrl(s)}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {s.logo_url
                          ? <img src={s.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <StoreIcon className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t("home.shopLabel")}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {enabled && !loadingProducts && products.length === 0 && stores.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  {t("home.searchNoResults", { query: debounced })}
                </p>
              )}
            </div>

            {enabled && (
              <button
                onClick={() => commit()}
                className="w-full px-4 py-3 text-sm font-semibold text-orange-600 dark:text-orange-400 border-t border-slate-100 dark:border-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
              >
                {t("home.seeAllResults")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
