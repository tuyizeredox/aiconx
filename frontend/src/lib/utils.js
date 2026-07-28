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
