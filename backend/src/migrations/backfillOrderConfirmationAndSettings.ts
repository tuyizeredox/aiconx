import 'dotenv/config';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';

/**
 * Migration: backfill buyer_confirmation_status + update live Settings document
 *
 * 1. Grandfathers every already-paid order as 'confirmed' so the new delivery-confirmation
 *    hold doesn't retroactively freeze balances vendors already expect to be able to
 *    withdraw. Only orders paid going forward get the real pending -> confirmed/disputed
 *    lifecycle.
 * 2. Updates the one live Settings document to the real platform_fee_percent (5) and
 *    min_withdrawal_amount (20) — schema defaults only apply to newly-created documents,
 *    and a Settings document already exists in this database.
 */
async function run() {
  try {
    console.log('Starting order-confirmation + settings backfill migration...');

    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vetora');
    }

    const orderResult = await Order.updateMany(
      { payment_status: 'paid', buyer_confirmation_status: { $exists: false } },
      { $set: { buyer_confirmation_status: 'confirmed' } }
    );
    console.log(`Grandfathered ${orderResult.modifiedCount} already-paid order(s) as confirmed.`);

    const settingsResult = await Settings.updateMany(
      {},
      { $set: { platform_fee_percent: 5, min_withdrawal_amount: 20 } }
    );
    console.log(`Updated ${settingsResult.modifiedCount} settings document(s) to platform_fee_percent=5, min_withdrawal_amount=20.`);

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
