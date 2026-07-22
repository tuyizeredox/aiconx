import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';

// A payment that hasn't been confirmed within this window is treated as
// abandoned (buyer closed the tab, mobile money prompt timed out, etc.) and
// the order is auto-cancelled instead of sitting as "pending" forever.
const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

async function cancelOrder(order: InstanceType<typeof Order>) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (!order.stock_restored) {
        for (const item of order.items) {
          if (item.inventory_deducted) {
            await Product.findByIdAndUpdate(
              item.product_id,
              { $inc: { inventory_count: item.quantity, sales_count: -item.quantity } },
              { session }
            );
          }
        }
        order.stock_restored = true;
      }
      order.status = 'cancelled';
      order.payment_status = 'failed';
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

async function sweepExpiredPendingOrders() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MS);

  const expiredOrders = await Order.find({
    status: 'pending',
    payment_status: 'pending',
    created_at: { $lt: cutoff },
  });

  for (const order of expiredOrders) {
    try {
      await cancelOrder(order);
    } catch (err) {
      console.error(`[orderCleanup] Failed to auto-cancel order ${order._id}:`, err);
    }
  }
}

function runSweep() {
  sweepExpiredPendingOrders().catch(err => {
    console.error('[orderCleanup] Sweep failed:', err);
  });
}

// Run once at startup — this also catches orders that were already stuck
// pending before the server (re)started, not just ones that expire from now on.
runSweep();
setInterval(runSweep, SWEEP_INTERVAL_MS);
