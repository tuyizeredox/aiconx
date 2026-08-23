import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPreviousEntry } from "@/lib/navHistory";

// Pages whose back label we can name. Anything else in-app falls back to a
// plain "Back" rather than guessing at a title.
const PAGE_LABEL_KEYS = {
  "/": "nav.home",
  "/marketplace": "storeDetail.marketplace",
  "/explore": "nav.explore",
  "/wishlist": "nav.wishlist",
  "/cart": "nav.cart",
  "/orders": "nav.orders",
  "/profile": "nav.profile",
  "/mystore": "nav.myStore",
  "/bookmarks": "nav.bookmarks",
  "/affiliate": "nav.affiliate",
};

// "kigali-coffee" → "Kigali Coffee". Store slugs are generated from the store's
// own name (backend/src/utils/slug.ts), so this reads as the store's name.
const titleFromSlug = (slug) =>
  decodeURIComponent(slug)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function labelForEntry(entry, t) {
  const path = entry.pathname.toLowerCase().replace(/\/+$/, "") || "/";

  const storeMatch = path.match(/^\/store\/(.+)$/);
  if (storeMatch) return t("common.backTo", { page: titleFromSlug(storeMatch[1]) });

  const key = PAGE_LABEL_KEYS[path];
  return key ? t("common.backTo", { page: t(key) }) : t("common.back");
}

/**
 * Back-arrow target for the standalone shop pages.
 *
 * Returns where the visitor actually came from — a store page, the feed, search
 * results — and only uses `fallbackTo` when there is no in-app history to pop
 * (a shared link opened cold, or a new tab). `onClick` pops history rather than
 * pushing the previous URL, so going back restores that page's own scroll and
 * state; `to` still holds a real URL so middle-click and "open in new tab" work.
 */
export function useBackLink(fallbackTo, fallbackLabel) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const previous = getPreviousEntry();
  // React Router stamps an incrementing `idx` on each entry it pushes; idx > 0
  // means an earlier entry belongs to this session, so popping stays in the app.
  const canGoBack = previous && (window.history.state?.idx ?? 0) > 0;

  const onClick = useCallback((event) => {
    if (!canGoBack) return;
    // Leave modified clicks alone — those are "open in a new tab", which needs
    // the href, not a history pop.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(-1);
  }, [canGoBack, navigate]);

  if (!canGoBack) return { to: fallbackTo, label: fallbackLabel, onClick: undefined };

  return {
    to: `${previous.pathname}${previous.search}`,
    label: labelForEntry(previous, t),
    onClick,
  };
}
