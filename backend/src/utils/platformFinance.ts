import { Settings } from '../models/Settings';

export const DEFAULT_PLATFORM_FEE_PERCENT = 5;
export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 20;

// A paid order's funds become withdrawable once the buyer explicitly confirms receipt,
// or automatically after this many days from delivery if they never respond — whichever
// comes first. Orders the buyer disputed are excluded until an admin resolves them.
export const DELIVERY_HOLD_DAYS = 7;

/**
 * Merges a base Mongo filter (e.g. { vendor_username, payment_status: 'paid' }) with the
 * delivery-confirmation gate, so only orders that are confirmed or past the auto-release
 * window count toward a withdrawable balance.
 */
export function withDeliveryConfirmationGate(baseFilter: Record<string, any>) {
  const autoReleaseThreshold = new Date(Date.now() - DELIVERY_HOLD_DAYS * 24 * 60 * 60 * 1000);
  return {
    ...baseFilter,
    $or: [
      { buyer_confirmation_status: 'confirmed' },
      { status: 'delivered', delivered_at: { $lte: autoReleaseThreshold } },
    ],
  };
}

// Server-side source of truth for the platform's cut and the minimum withdrawal
// amount. Settings is the single place these are configured — nothing should
// hardcode its own copy of either number.
export async function getPlatformMoneySettings(): Promise<{ platformFeePercent: number; minWithdrawalAmount: number; payoutRate: number }> {
  const settings = await Settings.findOne().select('platform_fee_percent min_withdrawal_amount').lean();
  const platformFeePercent = settings?.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const minWithdrawalAmount = settings?.min_withdrawal_amount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT;
  return {
    platformFeePercent,
    minWithdrawalAmount,
    payoutRate: 1 - platformFeePercent / 100,
  };
}
