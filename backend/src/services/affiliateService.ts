import { Order } from '../models/Order';
import { AffiliateLink } from '../models/AffiliateLink';

/**
 * Credits affiliate conversions/commission only for orders that are already
 * paid and haven't been credited yet. Safe to call multiple times for the
 * same order (webhook + client poll can both fire) since it atomically
 * claims each order via affiliate_commission_credited before crediting it.
 *
 * `io`, when provided, is used to notify the affiliate in real time that
 * their commission was credited (event: 'affiliate:commission_credited').
 */
export async function creditAffiliateConversions(orderIds: string[], io?: any): Promise<void> {
  const candidates = await Order.find({
    _id: { $in: orderIds },
    payment_status: 'paid',
    affiliate_link_id: { $exists: true, $ne: null },
    affiliate_commission_credited: { $ne: true },
  });

  for (const order of candidates) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, affiliate_commission_credited: { $ne: true } },
      { $set: { affiliate_commission_credited: true } }
    );
    if (!claimed) continue;

    const link = await AffiliateLink.findByIdAndUpdate(
      order.affiliate_link_id,
      {
        $inc: {
          conversions: 1,
          total_commission_earned: order.affiliate_commission || 0,
        },
      },
      { new: true }
    );

    if (io && link) {
      io.to(`user:${link.influencer_username}`).emit('affiliate:commission_credited', {
        order_id: order._id,
        link_id: link._id,
        product_title: link.product_title,
        commission: order.affiliate_commission || 0,
      });
    }
  }
}
