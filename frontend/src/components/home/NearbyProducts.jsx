import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ChevronRight, Loader2 } from "lucide-react";
import { storesAPI, productsAPI } from "@/api/apiClient";
import { createPageUrl } from "@/lib/utils";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import FeedProductTile from "./FeedProductTile";
import { rankProducts } from "@/lib/personalization";

const RADIUS_KM = 15;

/**
 * "Available near you" — the bridge between the app and the physical shops
 * around the shopper.
 *
 * Location is never requested on load: the section first appears as a single
 * quiet invitation, and the browser prompt only follows a deliberate tap.
 * Once granted, `useGeolocation` caches the fix for the session, so this and
 * the Nearby chip share one permission ask.
 */
export default function NearbyProducts({ geo, limit = 10, variant = "rail" }) {
  const { t } = useTranslation();
  const { coords, status, request } = geo;

  const { data: nearbyRes, isFetching: loadingStores } = useQuery({
    queryKey: ["nearbyStores", coords?.lat, coords?.lng, RADIUS_KM],
    queryFn: () => storesAPI.nearby({ lat: coords.lat, lng: coords.lng, radius_km: RADIUS_KM, limit: 60 }),
    enabled: !!coords,
    staleTime: 5 * 60 * 1000,
  });

  const stores = useMemo(() => (Array.isArray(nearbyRes?.data) ? nearbyRes.data : []), [nearbyRes]);

  // store_id -> distance, so each product can carry the distance of the shop
  // that actually stocks it.
  const distanceByStore = useMemo(() => {
    const map = new Map();
    stores.forEach((s) => map.set(String(s.id || s._id), s.distance_km));
    return map;
  }, [stores]);

  const storeIds = stores.map((s) => s.id || s._id).filter(Boolean).join(",");

  const { data: productsRes, isFetching: loadingProducts } = useQuery({
    queryKey: ["nearbyProducts", storeIds, limit],
    queryFn: () => productsAPI.list({
      status: "active",
      store_ids: storeIds,
      in_stock: "true",
      sort: "-sales_count",
      limit: limit * 3,
    }),
    // An empty store list means "nothing nearby" — asking the API for
    // store_ids="" would quietly return the whole catalogue instead.
    enabled: !!storeIds,
    staleTime: 5 * 60 * 1000,
  });

  const products = useMemo(
    () => rankProducts(productsRes?.data || []).slice(0, limit),
    [productsRes, limit]
  );

  const loading = loadingStores || loadingProducts;

  // Invitation state — one line, one button, no permission prompt yet.
  if (!coords) {
    if (status === "denied" || status === "unavailable") return null;
    return (
      <section className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("home.nearbyInviteTitle")}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("home.nearbyPromptDesc")}</p>
        </div>
        <button
          onClick={request}
          disabled={status === "locating"}
          className="shrink-0 h-9 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60"
        >
          {status === "locating" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t("home.nearbyEnable")}
        </button>
      </section>
    );
  }

  if (!loading && products.length === 0) {
    if (variant === "rail") return null;
    return (
      <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
        {t("home.nearbyEmpty", { km: RADIUS_KM })}
      </p>
    );
  }

  const header = (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">
          {t("home.nearbyTitle")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t("home.nearbySubtitle", { count: stores.length })}
        </p>
      </div>
      {variant === "rail" && (
        <Link
          to={createPageUrl("Marketplace")}
          className="shrink-0 text-[13px] font-semibold text-slate-500 dark:text-slate-400 flex items-center"
        >
          {t("home.seeAll")} <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );

  if (variant === "grid") {
    return (
      <section>
        {header}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5">
          {loading
            ? Array(6).fill(0).map((_, i) => <ProductSkeleton key={"nearby-sk-" + i} />)
            : products.map((p) => (
                <FeedProductTile
                  key={p.id || p._id}
                  product={p}
                  width="w-full"
                  distanceKm={distanceByStore.get(String(p.store_id)) ?? null}
                />
              ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      {header}
      {/* Contained to the same gutter as everything else on the screen rather
          than bled to the display edge — one set of vertical lines down the
          whole feed. */}
      <div className="overflow-x-auto overscroll-x-contain hide-scrollbar snap-x">
        <div className="inline-flex gap-3">
          {loading
            ? Array(4).fill(0).map((_, i) => (
                <div key={"nearby-sk-" + i} className="w-40 shrink-0"><ProductSkeleton /></div>
              ))
            : products.map((p) => (
                <FeedProductTile
                  key={p.id || p._id}
                  product={p}
                  distanceKm={distanceByStore.get(String(p.store_id)) ?? null}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
