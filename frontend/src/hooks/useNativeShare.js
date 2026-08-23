import { useCallback } from "react";
import { createPageUrl } from "@/lib/utils";
import { postsAPI } from "@/api/apiClient";

/**
 * The share action behind every share icon.
 *
 * @param resolveUrl - optional async resolver for the URL to share. Product
 *   surfaces pass their affiliate `ensureLink`, so pressing share is what
 *   mints the sharer's link: whatever leaves the app is already attributed to
 *   them, with nothing to opt into and no second step.
 *
 *   Awaiting inside the tap is a deliberate trade. navigator.share() needs
 *   transient activation, and a slow resolve can burn it — but the resolver
 *   returns instantly once the code is cached, and if activation is lost the
 *   browser throws and `onFallback` opens the share dialog, which mints the
 *   same link with UI on screen. The failure mode is a dialog, not a lost
 *   commission. Sharing a plain URL to protect the gesture would silently
 *   cost the user the money, which is the worse outcome.
 */
export function useNativeShare({ post, product, onFallback, resolveUrl }) {
  const isProduct = !!product;
  const item = product || post;
  const itemId = item?.id || item?._id;
  const itemTitle = isProduct
    ? product?.title
    : post?.content?.slice(0, 80) || "Check this out";
  const plainUrl =
    window.location.origin +
    createPageUrl(isProduct ? "ProductDetail" : "PostDetail") +
    `?id=${itemId}`;

  const share = useCallback(async () => {
    if (!navigator.share) {
      onFallback?.();
      return;
    }

    let url = plainUrl;
    if (resolveUrl) {
      try {
        url = (await resolveUrl()) || plainUrl;
      } catch {
        // Attribution is a bonus on top of the share, never a gate in front
        // of it — fall through with the plain URL.
      }
    }

    try {
      await navigator.share({ title: itemTitle, text: itemTitle, url });
      if (!isProduct && itemId) {
        postsAPI.share(itemId).catch(() => {});
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        onFallback?.();
      }
    }
  }, [itemTitle, plainUrl, isProduct, itemId, onFallback, resolveUrl]);

  return share;
}
