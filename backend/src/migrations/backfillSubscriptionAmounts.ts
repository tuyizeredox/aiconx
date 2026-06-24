import mongoose from 'mongoose';
import { VendorSubscription } from '../models/VendorSubscription';
import { Settings } from '../models/Settings';

/**
 * Migration: Backfill subscription amounts
 * 
 * This script adds the 'amount' field to existing subscriptions based on their plan and billing cycle.
 * It fetches the current plan prices from Settings and applies them to subscriptions that don't have an amount.
 */

const PLAN_PRICES = {
  pro: { monthly: 29000, annual: 23000 },
  elite: { monthly: 79000, annual: 63000 },
  free: { monthly: 0, annual: 0 }
};

async function backfillSubscriptionAmounts() {
  try {
    console.log('Starting subscription amount backfill migration...');

    // Connect to MongoDB
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vetora');
    }

    // Fetch current plan prices from Settings if available
    const settings = await Settings.findOne();
    if (settings?.plan_prices) {
      console.log('Using plan prices from Settings');
      if (settings.plan_prices.pro) {
        PLAN_PRICES.pro.monthly = settings.plan_prices.pro.monthly || 29000;
        PLAN_PRICES.pro.annual = settings.plan_prices.pro.annual || 23000;
      }
      if (settings.plan_prices.elite) {
        PLAN_PRICES.elite.monthly = settings.plan_prices.elite.monthly || 79000;
        PLAN_PRICES.elite.annual = settings.plan_prices.elite.annual || 63000;
      }
    }

    // Find all subscriptions without an amount field or with amount = 0
    const subscriptions = await VendorSubscription.find({
      $or: [
        { amount: { $exists: false } },
        { amount: null },
        { amount: 0 }
      ]
    });

    console.log(`Found ${subscriptions.length} subscriptions to update`);

    let updated = 0;
    for (const sub of subscriptions) {
      const plan = sub.plan as 'free' | 'pro' | 'elite';
      const billingCycle = sub.billing_cycle as 'monthly' | 'annual';
      
      // Use pending_plan if it exists (for subscriptions that were paid but not activated)
      const actualPlan = (sub.pending_plan || sub.plan) as 'free' | 'pro' | 'elite';
      const actualBillingCycle = (sub.pending_billing_cycle || sub.billing_cycle) as 'monthly' | 'annual';
      
      const amount = PLAN_PRICES[actualPlan]?.[actualBillingCycle] || 0;
      
      await VendorSubscription.updateOne(
        { _id: sub._id },
        { $set: { amount } }
      );
      
      updated++;
      console.log(`Updated subscription ${sub._id}: ${actualPlan} (${actualBillingCycle}) -> ${amount} RWF`);
    }

    console.log(`Migration complete. Updated ${updated} subscriptions.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
backfillSubscriptionAmounts();
