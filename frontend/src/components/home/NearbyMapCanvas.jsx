import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./nearby-map.css";

/**
 * The Leaflet half of the nearby-shops map, kept in its own module so that
 * Leaflet (~150 KB with its stylesheet) is code-split into a chunk that only
 * downloads once a shopper actually has a map on screen.
 *
 * It draws and nothing else: every control, card and label lives in
 * NearbyShopsMap, outside the map container, where Leaflet's drag and zoom
 * handlers can't swallow the taps. The only channel back out is `onSelect`.
 */

// CARTO's basemaps are the two that read well against this app's palette:
// Voyager keeps street names and shop-level landmarks (the whole point of
// "where exactly is it"), dark_matter is its night twin.
//
// Deliberately one fixed host rather than Leaflet's usual {s} rotation across
// a-d. Domain sharding is an HTTP/1.1 trick for getting more parallel
// requests, and it costs a full TLS handshake per host — measured at ~0.5s
// each on a phone connection, paid four times over, to save queueing that the
// six-connections-per-origin budget already covers for a dozen tiles. One
// host also means index.html's preconnect can have the connection open and
// warm before the map ever mounts.
const TILE_HOST = "https://a.basemaps.cartocdn.com";
const TILES = {
  light: `${TILE_HOST}/rastertiles/voyager/{z}/{x}/{y}{r}.png`,
  dark: `${TILE_HOST}/dark_all/{z}/{x}/{y}{r}.png`,
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Shop names and logo URLs are seller-supplied and go into a divIcon as raw
// HTML, so they are escaped on the way in.
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function storeIcon(store, { selected, label }) {
  const media = store.logo_url
    ? `<img src="${esc(store.logo_url)}" alt="" loading="lazy" />`
    : esc((store.name || "?").trim().charAt(0).toUpperCase() || "?");

  // A dashed, desaturated pin for a shop whose coordinates were inferred from
  // its owner's IP: the shape still says "a shop is around here", but nothing
  // about it claims the precision of a dropped pin.
  const approx = store.approximate ? " is-approx" : "";

  return L.divIcon({
    // Replaces Leaflet's own `leaflet-div-icon` class, whose white box and
    // border would frame every pin.
    className: "nb-pin-wrap",
    html:
      `<div class="nb-pin${selected ? " is-on" : ""}${approx}">` +
        (selected && label ? `<span class="nb-pin__label">${esc(label)}</span>` : "") +
        `<span class="nb-pin__body">${media}</span>` +
        `<span class="nb-pin__tail"></span>` +
      `</div>`,
    iconSize: [46, 56],
    // The tail tip, not the badge, is what sits on the coordinate.
    iconAnchor: [23, 50],
  });
}

/**
 * Padding for a fit, capped against the map's own size: on the short preview
 * card a flat 74/160 would leave a sliver to fit the shops into, and Leaflet
 * would answer by zooming out to half the country.
 *
 * A pin stands 50px above its coordinate and the selected one carries a
 * distance label another ~24px above that, so the top reserve depends on
 * whether any pin is highlighted at all.
 */
function fitPadding(map, bottomInset, hasSelection) {
  const size = map.getSize();
  const sidePad = Math.min(44, size.x * 0.14);
  const topPad = hasSelection
    ? Math.min(80, Math.max(74, size.y * 0.2))
    : Math.min(58, Math.max(52, size.y * 0.16));
  return {
    paddingTopLeft: [sidePad, topPad],
    paddingBottomRight: [sidePad, Math.min(bottomInset + 20, size.y * 0.45)],
  };
}

const meIcon = L.divIcon({
  className: "nb-me",
  html: '<span class="nb-me__pulse"></span><span class="nb-me__dot"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function NearbyMapCanvas({
  center,
  stores,
  radiusKm,
  selectedId,
  onSelect,
  onMapReady,
  interactive = true,
  theme = "light",
  meLabel,
  // Height of whatever floats over the bottom of the map (the shop carousel),
  // so the auto-fit can keep every pin in the part that is actually visible.
  bottomInset = 0,
  // Frame only the nearest N shops. On the short preview card, fitting a shop
  // 15 km out would shrink the whole neighbourhood to a smudge; the far pins
  // are still drawn, they just live outside the first frame.
  fitCount = 0,
}) {
  const [map, setMap] = useState(null);
  const hasFlown = useRef(false);

  const selected = useMemo(
    () => stores.find((s) => s.mapId === selectedId) || null,
    [stores, selectedId]
  );

  // Handing a Marker a new icon object rebuilds its DOM, which would reload
  // every shop logo each time the selection moved. Both states of every pin
  // are built once per shop-set, so selecting one only ever touches the two
  // markers that actually changed.
  const icons = useMemo(() => {
    const map = new Map();
    stores.forEach((store) => {
      map.set(store.mapId, {
        on: storeIcon(store, { selected: true, label: store.distanceLabel }),
        off: storeIcon(store, { selected: false }),
      });
    });
    return map;
  }, [stores]);

  // Identity of the pin set, so the auto-fit re-runs when the shops change but
  // not on every unrelated re-render (a fit mid-pan would fight the shopper).
  const fitKey = useMemo(
    () => `${center.lat},${center.lng}|${bottomInset}|${fitCount}|${stores.map((s) => s.mapId).join(",")}`,
    [center, stores, bottomInset, fitCount]
  );

  // Hand the instance up so the buttons rendered outside the map can drive it.
  useEffect(() => {
    if (map && onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  // The card grows when it expands to full screen and shrinks on rotate;
  // Leaflet only recalculates its viewport when told to.
  useEffect(() => {
    if (!map) return undefined;
    const nudge = () => map.invalidateSize({ animate: false });
    const observer = new ResizeObserver(nudge);
    observer.observe(map.getContainer());
    // One late nudge covers the expand animation, which finishes after the
    // element has already reached its final size.
    const timer = setTimeout(nudge, 420);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [map]);

  // Frame every shop plus the shopper, so the first thing on screen answers
  // "how far is all this from me" without a single gesture.
  useEffect(() => {
    if (!map) return;
    if (stores.length === 0) {
      map.setView([center.lat, center.lng], 14, { animate: false });
      return;
    }
    const framed = fitCount > 0 ? stores.slice(0, fitCount) : stores;
    const bounds = L.latLngBounds([
      [center.lat, center.lng],
      ...framed.map((s) => [s.lat, s.lng]),
    ]);
    map.fitBounds(bounds, { ...fitPadding(map, bottomInset, !!selectedId), maxZoom: 16, animate: false });
    // Keyed on fitKey alone: re-fitting mid-pan would fight the shopper's
    // own gesture.
  }, [map, fitKey]);

  // Follow the selection — but never on the first pass, which is the shop the
  // component picked for the shopper rather than one they asked to see.
  useEffect(() => {
    if (!map || !selected) return;
    if (!hasFlown.current) {
      hasFlown.current = true;
      return;
    }
    // Flying to zoom 16 on a shop whose coordinates came from an IP lookup
    // would fill the screen with one street and hide the accuracy ring
    // entirely — a precision the data does not have. Frame the ring instead,
    // so what fills the screen is the area the shop is actually somewhere in.
    if (selected.approximate && selected.accuracyKm > 0) {
      const area = L.latLng(selected.lat, selected.lng).toBounds(selected.accuracyKm * 2000);
      map.flyToBounds(area, { ...fitPadding(map, bottomInset, true), duration: 0.6 });
      return;
    }
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, selected, bottomInset]);

  // A radius ring only helps when the shops don't already fill it; on a dense
  // high street it would just wash the whole view orange.
  const showRadius = useMemo(() => {
    if (!radiusKm || stores.length === 0) return false;
    const farthest = Math.max(...stores.map((s) => s.distance_km ?? 0));
    return farthest >= radiusKm * 0.35;
  }, [radiusKm, stores]);

  return (
    <MapContainer
      ref={setMap}
      className="nb-map w-full h-full"
      center={[center.lat, center.lng]}
      zoom={14}
      zoomControl={false}
      // Scroll-wheel zoom is off so that scrolling the feed past the map
      // doesn't zoom it instead, and touch drag is off in preview mode so the
      // map never steals a vertical swipe.
      scrollWheelZoom={false}
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      attributionControl
    >
      <TileLayer
        key={theme}
        url={theme === "dark" ? TILES.dark : TILES.light}
        attribution={ATTRIBUTION}
        maxZoom={20}
      />

      {showRadius && (
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: "#f97316",
            weight: 1.5,
            opacity: 0.45,
            dashArray: "5 6",
            fillColor: "#f97316",
            fillOpacity: 0.05,
          }}
          interactive={false}
        />
      )}

      {/* The honest footprint of an IP lookup: the shop is somewhere in here,
          not at the pin. Drawn only for the selected shop, because a ring per
          pin would bury the map. */}
      {selected?.approximate && selected.accuracyKm > 0 && (
        <Circle
          center={[selected.lat, selected.lng]}
          radius={selected.accuracyKm * 1000}
          pathOptions={{
            color: "#64748b",
            weight: 1.5,
            opacity: 0.5,
            dashArray: "4 5",
            fillColor: "#64748b",
            fillOpacity: 0.08,
          }}
          interactive={false}
        />
      )}

      <Marker
        position={[center.lat, center.lng]}
        icon={meIcon}
        zIndexOffset={-100}
        interactive={false}
        keyboard={false}
        alt={meLabel}
      />

      {stores.map((store) => (
        <Marker
          key={store.mapId}
          position={[store.lat, store.lng]}
          icon={icons.get(store.mapId)[store.mapId === selectedId ? "on" : "off"]}
          zIndexOffset={store.mapId === selectedId ? 1000 : 0}
          riseOnHover
          keyboard={interactive}
          alt={store.name}
          title={store.name}
          eventHandlers={{ click: () => onSelect?.(store.mapId) }}
        />
      ))}
    </MapContainer>
  );
}
