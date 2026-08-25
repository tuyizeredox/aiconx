import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, BadgeCheck, Store as StoreIcon } from "lucide-react";
import { createPageUrl, storeUrl } from "@/lib/utils";
import { StoreSkeleton } from "@/components/shared/LoadingSkeleton";

/**
 * Horizontal rail of stores above the results. Doubles as the "near me"
 * payoff: when the shopper has a location, this becomes the nearby stores
 * with real distances, which is the clearest possible proof that the filter
 * is doing something.
 */
export default function StoreStrip({ stores, isLoading, nearbyMode }) {
  const { t } = useTranslation();

  if (!isLoading && stores.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {nearbyMode ? <MapPin className="w-4 h-4 text-orange-500" /> : <StoreIcon className="w-4 h-4 text-orange-500" />}
          {nearbyMode ? t("shop.storesNearYou") : t("shop.featuredStores")}
        </h2>
        {!isLoading && (
          <span className="text-xs text-slate-400 dark:text-ink-500 shrink-0">
            {t("shop.storesCount", { count: stores.length })}
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-3 sm:-mx-6 px-3 sm:px-6 hide-scrollbar">
        <div className="flex gap-3" style={{ width: "max-content" }}>
          {isLoading
            ? Array(6).fill(0).map((_, i) => <StoreSkeleton key={`store-skeleton-${i}`} />)
            : stores.map((store, idx) => {
                const id = store.id || store._id;
                return (
                  <Link
                    key={id || `store-${idx}`}
                    to={storeUrl(store)}
                    className="w-40 shrink-0 bg-white dark:bg-ink-900 rounded-2xl border border-slate-100 dark:border-ink-800 p-4 text-center hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900 transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900 flex items-center justify-center mx-auto mb-2 text-2xl font-bold text-orange-700 dark:text-orange-300 overflow-hidden">
                      {store.logo_url
                        ? <img src={store.logo_url} alt="" loading="lazy" className="w-full h-full object-cover rounded-2xl" />
                        : store.name?.[0]?.toUpperCase()}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center justify-center gap-1">
                      <span className="truncate">{store.name}</span>
                      {store.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                    </h3>
                    {store.distance_km !== null && store.distance_km !== undefined ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950 rounded-full px-2 py-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {t("shop.kmAway", { km: store.distance_km })}
                      </span>
                    ) : (
                      <span className="block mt-1 text-xs text-slate-400 dark:text-ink-500 truncate">
                        {store.location?.city || t("shop.storeItems", { count: store.product_count || 0 })}
                      </span>
                    )}
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
