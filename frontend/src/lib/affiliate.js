import { createPageUrl } from "@/lib/utils";

/**
 * What a shopper can earn by sharing a product.
 *
 * The product itself carries everything needed to answer this, so grids can
 * show an amount without a request per tile. It mirrors the backend rule in
 * routes/affiliateLinks.ts (`resolveAffiliateEligibility`) — keep the two in
 * step. The backend stays the authority: this only decides whether to *offer*
 * the amount, never whether a link gets minted.
 *
 * Returns null when nobody can earn on this product, so callers can render
 * nothing rather than a zero.
 */
export function estimateEarnings(product, { subscriptionEnforced = false, viewerUsername } = {}) {
  if (!product) return null;

  const price = Number(product.price) || 0;
  const pct = Number(product.affiliate_commission_pct) || 0;

  if (product.affiliate_enabled === false) return null;
  if (pct <= 0 || price <= 0) return null;
  if (product.status && product.status !== "active") return null;

  // Commission on your own sale is money moving from one of your pockets to
  // the other, via the payouts system. Don't offer it.
  if (viewerUsername && product.vendor_username === viewerUsername) return null;

  // vendor_plan is a snapshot on the product and can lag a lapsed
  // subscription; the create call re-checks the live plan and is what
  // actually decides. Only consult it while subscriptions are being enforced —
  // with enforcement off, every vendor has the affiliate programme.
  if (subscriptionEnforced && product.vendor_plan && product.vendor_plan !== "elite") return null;

  return { pct, amount: Math.round((price * pct) / 100) };
}

/**
 * A product URL carrying an affiliate ref code, or the plain URL without one.
 * The `ref` param is what AffiliateTracker picks up on landing.
 */
export function affiliateProductUrl(productId, refCode) {
  const base = window.location.origin + createPageUrl("ProductDetail") + `?id=${productId}`;
  return refCode ? `${base}&ref=${refCode}` : base;
}
