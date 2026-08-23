// Mirrors backend/src/utils/platformFinance.ts — kept in sync manually since this is
// display-only logic (the backend is the authoritative gate on what's actually withdrawable).
export const DELIVERY_HOLD_DAYS = 7;

export function isOrderWithdrawable(order) {
  if (order.buyer_confirmation_status === "confirmed") return true;
  if (order.status === "delivered" && order.delivered_at) {
    const daysSinceDelivery = (Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceDelivery >= DELIVERY_HOLD_DAYS;
  }
  return false;
}
