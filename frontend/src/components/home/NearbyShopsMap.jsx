import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Crosshair,
  Map as MapIcon,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { storeUrl } from "@/lib/utils";

const loadMapCanvas = () => import("./NearbyMapCanvas");
const NearbyMapCanvas = React.lazy(loadMapCanvas);

/**
 * Pulls the Leaflet chunk down while the main thread is idle, so that scrolling
 * the map into view is a mount rather than a mount *plus* a ~45 KB download.
 *
 * Only ever called once this component has decided it has shops to plot, which
 * makes it a good bet rather than a blind one — and skipped outright when the
 * shopper has asked their browser to conserve data.
 */
function prefetchMapCanvas() {
  const connection = navigator.connection;
  if (connection?.saveData) return undefined;
  if (/(^|-)2g$/.test(connection?.effectiveType || "")) return undefined;

  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(() => loadMapCanvas(), { timeout: 2500 });
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(loadMapCanvas, 1200);
  return () => clearTimeout(timer);
}

/**
 * "Shops around you" — the map that turns a list of nearby shops into places a
 * shopper can actually walk to.
 *
 * Two surfaces, one selection:
 *  - inline   a card in the feed. In the rail it is a still, un-draggable
 *             preview that can never steal a vertical swipe and only ever
 *             opens; on the Nearby tab it is a full interactive panel.
 *  - full     the same map over the whole viewport.
 *
 * Only one surface is ever mounted, so there is only ever one Leaflet instance
 * fetching tiles. Which shop is selected lives here, so opening and closing
 * the full screen never loses the shopper's place.
 *
 * Leaflet is loaded lazily *and* only once the card scrolls into view, so a
 * shopper who never reaches the section never pays for the map.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Google Maps' universal URLs: handled by the installed app on both phones,
// and by the web app everywhere else.
//
// A shop whose coordinates came from an IP lookup gets a *search* rather than
// a route. Turn-by-turn navigation to a point that may be 25 km out is worse
// than no navigation at all — it doesn't merely fail, it confidently walks
// someone to the wrong side of the city. Searching the name and city lets the
// maps app resolve the real address if it knows it.
function mapsUrl(store, from) {
  if (store.approximate) {
    const query = [store.name, store.location?.city, store.location?.country].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  const params = new URLSearchParams({
    api: "1",
    destination: `${store.lat},${store.lng}`,
  });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Defers mounting the map until the card is near the viewport. */
function useInViewOnce() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);

  return [ref, seen];
}

function MapButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-xl bg-white/95 dark:bg-ink-800/95 backdrop-blur border border-slate-200/80 dark:border-ink-700 shadow-lg shadow-slate-900/10 flex items-center justify-center text-slate-700 dark:text-ink-100 active:scale-95 transition-transform"
    >
      {children}
    </button>
  );
}

function MapSkeleton({ label }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-ink-800">
      <div className="w-9 h-9 rounded-full border-2 border-slate-300 dark:border-ink-600 border-t-orange-500 animate-spin" />
      <span className="text-[11px] font-semibold text-slate-400 dark:text-ink-500">{label}</span>
    </div>
  );
}

/** One shop in the carousel under the map. */
function ShopCard({ store, center, selected, onSelect, cardRef, t }) {
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(store.mapId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(store.mapId);
        }
      }}
      className={`snap-start shrink-0 w-[16.5rem] rounded-2xl p-2.5 text-left cursor-pointer transition-colors bg-white/95 dark:bg-ink-800/95 backdrop-blur border ${
        selected
          ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/30"
          : "border-slate-200/80 dark:border-ink-700"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl shrink-0 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900 overflow-hidden flex items-center justify-center text-sm font-bold text-orange-700 dark:text-orange-300">
          {store.logo_url ? (
            <img src={store.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            store.name?.[0]?.toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
            <span className="truncate">{store.name}</span>
            {store.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
          </p>
          {/* Rating, stock and street on one line: the card floats over the
              map it is describing, so every row it costs is a row of map. */}
          <p className="text-[11px] text-slate-500 dark:text-ink-400 truncate mt-px flex items-center gap-1">
            {isNum(store.rating_avg) && store.rating_avg > 0 && (
              <>
                <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
                <span>{store.rating_avg.toFixed(1)}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="truncate">
              {store.address
                || store.location?.city
                || (store.approximate ? t("home.mapApproxNote") : t("shop.storeItems", { count: store.product_count || 0 }))}
            </span>
          </p>
        </div>

        {store.distanceLabel && (
          <span
            title={store.approximate ? t("home.mapApproxNote") : undefined}
            className={`shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 ${
              store.approximate
                ? "text-slate-500 dark:text-ink-400 bg-slate-100 dark:bg-ink-700 border border-dashed border-slate-300 dark:border-ink-600"
                : "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950"
            }`}
          >
            {store.distanceLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        {/* Handing off to a maps app, so it opens in a new tab rather than
            replacing a session mid-shop. */}
        <a
          href={mapsUrl(store, center)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-ink-600 text-[12px] font-semibold text-slate-700 dark:text-ink-100 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          {store.approximate ? <Search className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5" />}
          {t(store.approximate ? "home.mapFindOnMap" : "home.mapDirections")}
        </a>
        <Link
          to={storeUrl(store)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-8 rounded-lg bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-[12px] font-bold flex items-center justify-center active:scale-[0.98] transition-transform"
        >
          {t("home.mapViewShop")}
        </Link>
      </div>
    </div>
  );
}

/**
 * A mounted map: the Leaflet canvas plus everything drawn over it. Overlays
 * deliberately sit outside the map container so Leaflet's drag and zoom
 * handlers never swallow a tap meant for a button or a card.
 *
 * Each surface owns its own Leaflet instance and its own carousel, which is
 * why the inline card and the full screen are never mounted at the same time.
 */
function MapSurface({ center, pinned, radiusKm, activeId, onSelect, theme, t, interactive, showRail, railInset, bottomReserve = 0, fitCount = 0, controls }) {
  const mapRef = useRef(null);
  const railRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [railHeight, setRailHeight] = useState(0);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // The carousel floats over the map, so the map has to be told how much of
  // its bottom edge is spoken for — otherwise the auto-fit happily parks the
  // farthest shop's pin behind the cards.
  useEffect(() => {
    const el = railRef.current;
    if (!showRail || !el) {
      setRailHeight(0);
      return undefined;
    }
    const measure = () => setRailHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showRail]);

  // Keep the carousel pointing at the same shop as the pins. Done by hand
  // rather than with scrollIntoView, which would drag the page along too.
  useEffect(() => {
    const rail = railRef.current;
    const card = cardRefs.current.get(activeId);
    if (!rail || !card) return;
    rail.scrollTo({ left: Math.max(0, card.offsetLeft - 12), behavior: "smooth" });
  }, [activeId]);

  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + delta);
  };

  const recenter = () => {
    const map = mapRef.current;
    if (map) map.flyTo([center.lat, center.lng], 15, { duration: 0.6 });
  };

  return (
    <>
      <Suspense fallback={<MapSkeleton label={t("home.mapLoading")} />}>
        <NearbyMapCanvas
          center={center}
          stores={pinned}
          radiusKm={radiusKm}
          selectedId={showRail ? activeId : null}
          onSelect={onSelect}
          onMapReady={handleMapReady}
          interactive={interactive}
          theme={theme}
          meLabel={t("home.mapYouAreHere")}
          bottomInset={Math.max(railHeight, bottomReserve)}
          fitCount={fitCount}
        />
      </Suspense>

      {controls?.({ zoomBy, recenter })}

      {showRail && (
        <div
          ref={railRef}
          className="absolute inset-x-0 bottom-0 z-[500] overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-3 pt-6 bg-gradient-to-t from-black/20 to-transparent"
          style={railInset ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" } : undefined}
        >
          <div className="flex gap-2.5 px-3" style={{ width: "max-content" }}>
            {pinned.map((store) => (
              <ShopCard
                key={store.mapId}
                store={store}
                center={center}
                selected={store.mapId === activeId}
                onSelect={onSelect}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(store.mapId, el);
                  else cardRefs.current.delete(store.mapId);
                }}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function NearbyShopsMap({ stores = [], center, radiusKm, variant = "preview" }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [hostRef, inView] = useInViewOnce();

  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Only shops whose owner actually dropped a pin can be drawn; the rest still
  // appear in the product rail, they just have nothing to point at.
  const pinned = useMemo(
    () =>
      stores
        .filter((s) => isNum(s.location?.lat) && isNum(s.location?.lng))
        .map((s) => {
          // Coordinates the backend inferred from the owner's IP rather than a
          // pin they dropped. They are city-level at best, so every surface
          // that shows them has to say so — a tilde on the distance, a hollow
          // pin, and the accuracy ring once the shop is selected.
          const approximate = s.location?.source === "ip";
          return {
            ...s,
            mapId: String(s.id || s._id),
            lat: s.location.lat,
            lng: s.location.lng,
            approximate,
            accuracyKm: approximate && isNum(s.location.accuracy_km) ? s.location.accuracy_km : null,
            distanceLabel: isNum(s.distance_km)
              ? t(approximate ? "home.mapKmApprox" : "shop.kmValue", { km: s.distance_km })
              : null,
          };
        }),
    [stores, t]
  );

  const handleSelect = useCallback((id) => setSelectedId(id), []);

  useEffect(() => {
    if (pinned.length === 0) return undefined;
    return prefetchMapCanvas();
  }, [pinned.length]);

  // Full screen is a modal: the page behind must not scroll, and Escape must
  // get out of it.
  useEffect(() => {
    if (!expanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  if (!center || pinned.length === 0) return null;

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  // The nearest shop is pre-selected so the card under the map already says
  // something useful before the shopper has tapped anything — the API returns
  // them sorted by distance.
  const activeId =
    selectedId && pinned.some((s) => s.mapId === selectedId) ? selectedId : pinned[0].mapId;
  const activeStore = pinned.find((s) => s.mapId === activeId) || null;

  const countPill = (
    <div className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full bg-white/95 dark:bg-ink-800/95 backdrop-blur border border-slate-200/80 dark:border-ink-700 shadow-lg shadow-slate-900/10 text-[11px] font-bold text-slate-700 dark:text-ink-100">
      <MapIcon className="w-3.5 h-3.5 text-orange-500" />
      {t("home.mapPinned", { count: pinned.length })}
    </div>
  );

  const surfaceProps = {
    center,
    pinned,
    radiusKm,
    activeId,
    onSelect: handleSelect,
    theme,
    t,
  };

  // While the full screen is up the inline map is unmounted — the box keeps
  // its height so the feed doesn't jump when it comes back, but nothing is
  // left behind the modal still pulling tiles.
  const inlineLive = inView && !expanded;

  return (
    <>
      <div
        ref={hostRef}
        className={`nb-map-shell relative rounded-2xl overflow-hidden border border-slate-200 dark:border-ink-800 bg-slate-100 dark:bg-ink-800 ${
          variant === "preview" ? "h-52" : "h-[22rem]"
        }`}
      >
        {inlineLive ? (
          variant === "preview" ? (
            <>
              <MapSurface {...surfaceProps} interactive={false} showRail={false} bottomReserve={44} fitCount={4} />
              {/* One tap target over the whole still map: inside a vertical
                  feed a draggable map is a trap, so the preview only opens. */}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="absolute inset-0 z-[500] flex flex-col items-center justify-end pb-3"
              >
                <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 dark:from-ink-900/90 to-transparent" />
                <span className="relative inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white dark:bg-ink-900 text-slate-900 dark:text-white text-[13px] font-bold shadow-xl border border-slate-200/70 dark:border-ink-700">
                  <MapIcon className="w-4 h-4 text-orange-500" />
                  {t("home.mapOpen")}
                  <span className="text-slate-300 dark:text-ink-600" aria-hidden>·</span>
                  <span className="font-semibold text-slate-500 dark:text-ink-400">
                    {t("home.mapShopCount", { count: pinned.length })}
                  </span>
                </span>
              </button>
            </>
          ) : (
            <MapSurface
              {...surfaceProps}
              interactive
              showRail
              controls={({ recenter }) => (
                <>
                  <div className="absolute top-3 left-3 z-[500]">{countPill}</div>
                  <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
                    <MapButton label={t("home.mapExpand")} onClick={() => setExpanded(true)}>
                      <Maximize2 className="w-4 h-4" />
                    </MapButton>
                    <MapButton label={t("home.mapRecenter")} onClick={recenter}>
                      <Crosshair className="w-4 h-4" />
                    </MapButton>
                  </div>
                </>
              )}
            />
          )
        ) : (
          <MapSkeleton label={t("home.mapLoading")} />
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={t("home.mapTitle")}
            className="nb-map-shell fixed inset-0 z-[80] bg-white dark:bg-ink-900"
          >
            <MapSurface
              {...surfaceProps}
              interactive
              showRail
              railInset
              controls={({ zoomBy, recenter }) => (
                <div
                  className="absolute top-0 inset-x-0 z-[500] flex items-start justify-between gap-3 p-3"
                  style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
                >
                  <div className="flex flex-col items-start gap-2 min-w-0">
                    {countPill}
                    {activeStore && (
                      <span className="max-w-full h-7 px-3 leading-7 rounded-full bg-ink-900/90 dark:bg-white/90 backdrop-blur text-[11px] font-bold text-white dark:text-ink-900 truncate">
                        {activeStore.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <MapButton label={t("home.mapClose")} onClick={() => setExpanded(false)}>
                      <X className="w-4 h-4" />
                    </MapButton>
                    <MapButton label={t("home.mapZoomIn")} onClick={() => zoomBy(1)}>
                      <Plus className="w-4 h-4" />
                    </MapButton>
                    <MapButton label={t("home.mapZoomOut")} onClick={() => zoomBy(-1)}>
                      <Minus className="w-4 h-4" />
                    </MapButton>
                    <MapButton label={t("home.mapRecenter")} onClick={recenter}>
                      <Crosshair className="w-4 h-4" />
                    </MapButton>
                  </div>
                </div>
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
