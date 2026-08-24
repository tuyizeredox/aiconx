import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function createPageUrl(pageName) {
  if (pageName === "Home") return "/";
  return `/${pageName.toLowerCase()}`;
}

// Link to a store page. Prefers the readable handle (/store/kigali-coffee) and
// falls back to the legacy /storedetail?id=<ObjectId> route when the caller only
// has an id (or the store predates slugs and hasn't been backfilled yet) — both
// resolve server-side, so either form always works.
//
// `store` may be a store object, or a bare id string when that's all the caller
// has. `query` is an optional object of extra params (e.g. { view: "shop" }).
export function storeUrl(store, query) {
  const isObject = store && typeof store === "object";
  const slug = isObject ? store.slug : null;
  const id = isObject ? (store.id || store._id) : store;

  let url;
  if (slug) url = `/store/${encodeURIComponent(slug)}`;
  else if (id) url = `/storedetail?id=${encodeURIComponent(id)}`;
  else return "/marketplace";

  const extra = new URLSearchParams(
    Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  if (!extra) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${extra}`;
}

export function getRedirectPath(user) {
  return user?.role === 'super_admin' ? '/admin-dashboard' : '/';
}

export const isIframe = window.self !== window.top;

const _rwfFormatter = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return 'RWF 0';
  return _rwfFormatter.format(Number(amount));
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".avi", ".mkv", ".flv", ".wmv", ".3gp"];

export function isVideoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.includes(ext)) || lower.includes("video/upload");
}

// Index of the first video item in a post's media, or -1 if it has none.
export function getPostVideoIndex(post) {
  if (!post?.media_urls?.length) return -1;
  if (post.media_type === "video") return 0;
  return post.media_urls.findIndex(isVideoUrl);
}

export function isVideoPost(post) {
  return getPostVideoIndex(post) !== -1;
}

/**
 * Great-circle distance between two lat/lng pairs, in kilometres, rounded to
 * one decimal — the same calculation the /stores/nearby endpoint runs, so a
 * distance shown on a product page matches the one shown in the feed.
 *
 * Returns null unless both points are real coordinates.
 */
export function haversineKm(from, to) {
  const lat1 = Number(from?.lat), lng1 = Number(from?.lng);
  const lat2 = Number(to?.lat), lng2 = Number(to?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/**
 * The paint of the mobile app bar.
 *
 * Layout's top bar and the block Home sticks directly underneath it are two
 * components rendering one bar, so the surface has to be defined once. Any
 * difference between them shows up as a visible seam across the header.
 */
export const APP_BAR_SURFACE = "bg-white/95 dark:bg-[#181824]/95 backdrop-blur-xl";

/**
 * The paint behind a banner or cover slot that has no image uploaded yet.
 *
 * Near-black with a low brand glow instead of a flat orange fill: the slot sits
 * under avatars, logos and white text in both themes, and a saturated block
 * there reads as a design choice rather than an empty slot waiting for a photo.
 */
export const COVER_PLACEHOLDER =
  "bg-slate-950 bg-[radial-gradient(circle_at_18%_130%,rgba(249,115,22,0.38)_0%,transparent_58%),radial-gradient(circle_at_88%_-25%,rgba(249,115,22,0.16)_0%,transparent_52%)]";
