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
