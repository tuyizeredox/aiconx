import { FastifyInstance } from 'fastify';
import { ProductBooking } from '../models/ProductBooking';
import { Product } from '../models/Product';
import { Notification } from '../models/Notification';
import { NotificationService } from './notificationService';

/**
 * Tells everyone waiting on a product that it's back, so they can go and pay.
 *
 * Safe to call after any inventory change — it no-ops when the product is
 * still out of stock. Each booking is claimed with a findOneAndUpdate before
 * its notification is sent, so two concurrent restocks (a vendor edit landing
 * at the same time as an order cancellation) can't double-notify anyone.
 *
 * Never throws: a restock must not fail because a notification did.
 */
export async function notifyRestockedBookings(productId: string, fastify?: FastifyInstance): Promise<number> {
  try {
    if (!productId) return 0;

    const product = await Product.findById(productId).lean();
    if (!product) return 0;

    // Nothing to announce while the shelf is still empty.
    const backInStock = product.inventory_count > 0 && product.status !== 'sold_out' && product.status !== 'archived';
    if (!backInStock) return 0;

    const waiting = await ProductBooking.find({ product_id: String(product._id), status: 'waiting' })
      .sort({ created_at: 1 })
      .lean();

    if (waiting.length === 0) return 0;

    let notified = 0;

    for (const booking of waiting) {
      const claimed = await ProductBooking.findOneAndUpdate(
        { _id: booking._id, status: 'waiting' },
        { $set: { status: 'notified', notified_at: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        const notification = new Notification({
          recipient_username: claimed.user_username,
          type: 'offer',
          title: `${product.title} is back in stock`,
          body: 'You booked this item — complete your purchase before it sells out again.',
          link: `/productdetail?id=${product._id}`,
          sender_username: product.vendor_username,
          sender_name: product.store_name || product.vendor_username,
          metadata: { product_id: String(product._id), booking_id: String(claimed._id) },
        });
        await notification.save();
        fastify?.io?.to(`user:${claimed.user_username}`).emit('notification:new', notification);
        if (fastify) {
          NotificationService.sendPushNotification(claimed.user_username, notification, fastify);
        }
        notified += 1;
      } catch (notifyError) {
        // The booking is already marked notified; log and keep going so one
        // bad recipient can't stop the rest of the queue.
        fastify?.log?.error(notifyError);
      }
    }

    return notified;
  } catch (error) {
    fastify?.log?.error(error);
    return 0;
  }
}
