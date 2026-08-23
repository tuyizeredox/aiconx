import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { affiliateLinksAPI } from "@/api/apiClient";
import { affiliateProductUrl, estimateEarnings } from "@/lib/affiliate";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

/**
 * A shopper's earning position on one product.
 *
 * Two things happen here, deliberately kept apart:
 *
 *  - reading is free. `amount` comes from the product itself, so a price can
 *    be shown on a card without a request, and the authoritative check only
 *    runs where it is worth a round trip (the product page).
 *  - writing is lazy. `ensureLink()` mints the link, and is only called when
 *    someone actually shares. Creating one for every product anyone glances at
 *    would fill their affiliate dashboard with links they never used.
 *
 * `ensureLink` is idempotent server-side, so calling it on every share is
 * correct: one link per person per product, with the clicks accumulating on it.
 */
export function useAffiliateLink(product, currentUser, { authoritative = false } = {}) {
  const queryClient = useQueryClient();
  const { isSubscriptionEnforced } = usePlatformSettings();
  const productId = (product?.id || product?._id)?.toString();
  const signedIn = !!currentUser?.username;

  const estimate = estimateEarnings(product, {
    subscriptionEnforced: isSubscriptionEnforced,
    viewerUsername: currentUser?.username,
  });

  const queryKey = ["affiliateEligibility", productId, currentUser?.username || "guest"];

  const { data: server } = useQuery({
    queryKey,
    queryFn: () => affiliateLinksAPI.getProductEligibility(productId),
    // Only the product page pays for the authoritative answer; a feed of forty
    // tiles must not fan out into forty requests.
    enabled: authoritative && !!productId && !!estimate,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const eligible = server ? !!server.eligible : !!estimate;
  const pct = server?.commission_pct ?? estimate?.pct ?? 0;
  const amount = server?.earn_per_sale ?? estimate?.amount ?? 0;
  const refCode = server?.ref_code || null;

  /**
   * Returns the share URL for this product, with the caller's ref code when
   * one could be obtained. Never throws and never returns nothing: a failure
   * to attribute must not become a failure to share.
   */
  const ensureLink = useCallback(async () => {
    if (!productId) return null;
    const plain = affiliateProductUrl(productId, null);
    if (!signedIn || !eligible) return plain;
    if (refCode) return affiliateProductUrl(productId, refCode);

    try {
      const res = await affiliateLinksAPI.ensureMyLink(productId);
      const code = res?.ref_code;
      if (!code) return plain;
      queryClient.setQueryData(queryKey, (old) => ({
        ...(old || {}),
        eligible: true,
        ref_code: code,
        commission_pct: res.commission_pct,
        earn_per_sale: res.earn_per_sale,
      }));
      queryClient.invalidateQueries({ queryKey: ["affiliateLinks"] });
      return affiliateProductUrl(productId, code);
    } catch {
      // Vendor downgraded, product archived, network gone — share the plain
      // link. The shopper still shares; only the attribution is lost.
      return plain;
    }
  }, [productId, signedIn, eligible, refCode, currentUser?.username, queryClient]);

  return {
    eligible,
    pct,
    amount,
    refCode,
    /** true once a link exists, so the URL can be built with no round trip */
    hasLink: !!refCode,
    shareUrl: affiliateProductUrl(productId, refCode),
    ensureLink,
  };
}

export default useAffiliateLink;
