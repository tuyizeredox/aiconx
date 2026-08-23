import { Settings } from '../models/Settings';

export type PlanId = 'free' | 'pro' | 'elite';
export type BillingCycle = 'monthly' | 'annual';

export const DEFAULT_PLAN_PRICES: Record<PlanId, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 29000, annual: 23000 },
  elite: { monthly: 79000, annual: 63000 },
};

// Server-side source of truth for what a plan should cost. Callers must never
// substitute a client-supplied amount for this — the payment amount charged
// and verified before a subscription is activated must come from here.
export async function getPlanPrice(plan: PlanId, billingCycle: BillingCycle): Promise<number> {
  const settings = await Settings.findOne().select('plan_prices').lean();
  const prices = (settings?.plan_prices as any)?.[plan] || DEFAULT_PLAN_PRICES[plan];
  return billingCycle === 'annual' ? prices.annual : prices.monthly;
}
