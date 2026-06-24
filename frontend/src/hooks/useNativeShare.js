import { useCallback } from "react";
import { toast } from "sonner";
import { createPageUrl } from "@/lib/utils";
import { postsAPI } from "@/api/apiClient";

export function useNativeShare({ post, product, onFallback }) {
  const isProduct = !!product;
  const item = product || post;
  const itemId = item?.id || item?._id;
  const itemTitle = isProduct
    ? product?.title
    : post?.content?.slice(0, 80) || "Check this out";
  const itemUrl =
    window.location.origin +
    createPageUrl(isProduct ? "ProductDetail" : "PostDetail") +
    `?id=${itemId}`;

  const share = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: itemTitle,
          text: itemTitle,
          url: itemUrl,
        });
        if (!isProduct && itemId) {
          postsAPI.share(itemId).catch(() => {});
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          onFallback?.();
        }
      }
    } else {
      onFallback?.();
    }
  }, [itemTitle, itemUrl, isProduct, itemId, onFallback]);

  return share;
}
