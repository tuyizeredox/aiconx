import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function createPageUrl(pageName) {
  if (pageName === "Home") return "/";
  return `/${pageName.toLowerCase()}`;
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
