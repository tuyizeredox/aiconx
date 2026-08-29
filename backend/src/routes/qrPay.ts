import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { itecPayService } from '../services/itecPayService';
import { notifyRestockedBookings } from '../services/bookingService';

/**
 * Scan-to-pay: the counter-sale half of the product QR codes vendors print and
 * stick on physical items (see services/productQrService.ts).
 *
 * Everything here is deliberately public. The whole point is that someone
 * holding the product in a shop can scan, type their phone number, approve the
 * mobile money prompt and walk away with it — asking them to register an
 * account first would defeat the feature. That has two consequences the rest of
 * the file is built around:
 *
 *  - Orders carry a guest buyer handle (`guest-<phone>`) instead of a real
 *    account. Registered usernames can only contain [a-zA-Z0-9_] (see
 *    routes/auth.ts), so a handle with a hyphen can never collide with one.
 *  - Nothing is trusted from the client except the phone number and quantity.
 *    Price, vendor, store and total all come from the Product document, and the
 *    order is only settled against what the gateway says was actually paid.
 */

const initiateSchema = z.object({
  product_id: z.string(),
  quantity: z.number().int().min(1).max(50).default(1),
  phone: z.string().min(9).max(20),
  provider: z.enum(['mtn', 'airtel']).default('mtn'),
  buyer_name: z.string().trim().max(80).optional(),
});

// Knowing an order's payment reference (a server-minted UUID that only the
// device which started the payment ever sees) is what authorises polling it.
const statusSchema = z.object({
  reference: z.string().min(8),
});

// Two people can't be scanning the same sticker from the same phone a second
// apart, but a script can — and every attempt pushes a real payment prompt to
// whatever number it names. This is the anti-nuisance gate on that.
const DUPLICATE_ATTEMPT_WINDOW_MS = 45 * 1000;

const SUCCESS_STATUSES = ['completed', 'success', 'successful', 'paid', 'approved'];
const FAILURE_STATUSES = ['failed', 'cancelled', 'canceled', 'rejected', 'declined', 'expired'];

export async function qrPayRoutes(fastify: FastifyInstance) {
  /**
   * What the scan page shows before anyone types anything: enough to prove the
   * shopper is looking at the right product, and nothing about the vendor's
   * business they couldn't already see on the public product page.
   */
  fastify.get('/product/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid product code' });
      }

      const product = await Product.findById(id)
        .select('title description price compare_at_price currency images inventory_count status store_id store_name')
        .lean();

      if (!product || product.status === 'draft' || product.status === 'archived') {
        return reply.code(404).send({ error: 'This product is no longer available' });
      }

      const store = await Store.findById(product.store_id).select('name logo_url slug').lean();

      // An inventory_count of 0 means "not tracked", not "out of stock" —
      // matching how checkout and order creation read the same field.
      const tracksInventory = (product.inventory_count ?? 0) > 0;

      return {
        id: String(product._id),
        title: product.title,
        description: product.description || '',
        price: product.price,
        compare_at_price: product.compare_at_price,
        currency: product.currency || 'RWF',
        image: product.images?.[0] || '',
        images: product.images || [],
        store_name: store?.name || product.store_name || '',
        store_logo: store?.logo_url || '',
        store_slug: store?.slug || '',
        available: product.status === 'active',
        max_quantity: tracksInventory ? product.inventory_count : null,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Could not load this product' });
    }
  });

  /**
   * Creates the counter sale and pushes the mobile money prompt to the
   * shopper's phone. Rate limited hard: each call rings a real phone.
   */
  fastify.post('/orders', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Deliberately not opened until the request is known to be worth a
    // transaction: everything below the gateway call validates first, and a
    // session opened up here would escape this handler's own error handling if
    // Mongo were unreachable.
    let session: mongoose.ClientSession | null = null;

    try {
      const body = initiateSchema.parse(request.body);

      if (!mongoose.isValidObjectId(body.product_id)) {
        return reply.code(400).send({ error: 'Invalid product code' });
      }

      const phone = itecPayService.normalizePhone(body.phone);
      if (!/^0[0-9]{8,9}$/.test(phone)) {
        return reply.code(400).send({
          error: 'Invalid phone number',
          message: 'Enter a mobile money number like 0788123456.',
        });
      }

      const product = await Product.findOne({ _id: body.product_id, status: 'active' });
      if (!product) {
        return reply.code(404).send({ error: 'This product is no longer available' });
      }

      const tracksInventory = (product.inventory_count ?? 0) > 0;
      if (tracksInventory && product.inventory_count < body.quantity) {
        return reply.code(409).send({
          error: 'Not enough stock',
          message: `Only ${product.inventory_count} left.`,
        });
      }

      const buyerUsername = `guest-${phone}`;

      const recentAttempt = await Order.findOne({
        buyer_username: buyerUsername,
        payment_status: 'pending',
        status: 'pending',
        created_at: { $gt: new Date(Date.now() - DUPLICATE_ATTEMPT_WINDOW_MS) },
      }).select('_id');

      if (recentAttempt) {
        return reply.code(429).send({
          error: 'Payment already in progress',
          message: 'Check your phone — a payment request was just sent to this number.',
        });
      }

      const store = await Store.findById(product.store_id).select('name').lean();
      const total = product.price * body.quantity;

      let order: any;

      session = await mongoose.startSession();
      const txn = session;
      await txn.withTransaction(async () => {
        // Same inventory contract as checkout: only decrement when the vendor
        // actually tracks stock, and let the conditional update be the lock.
        const inventoryFilter: any = { _id: product._id, status: 'active' };
        if (tracksInventory) {
          inventoryFilter.inventory_count = { $gte: body.quantity };
        }

        const reserved = await Product.findOneAndUpdate(
          inventoryFilter,
          {
            $inc: {
              sales_count: body.quantity,
              ...(tracksInventory && { inventory_count: -body.quantity }),
            },
          },
          { new: true, session: txn }
        );

        if (!reserved) {
          throw Object.assign(new Error('This product just sold out'), { statusCode: 409 });
        }

        order = new Order({
          buyer_username: buyerUsername,
          buyer_name: body.buyer_name || 'Walk-in customer',
          buyer_phone: phone,
          vendor_username: product.vendor_username,
          store_id: product.store_id,
          store_name: store?.name || product.store_name,
          items: [{
            product_id: String(product._id),
            product_title: product.title,
            product_image: product.images?.[0],
            quantity: body.quantity,
            price: product.price,
            inventory_deducted: tracksInventory,
          }],
          subtotal: total,
          shipping_fee: 0,
          delivery_fee: 0,
          discount_amount: 0,
          // The shopper is standing in the shop holding the item, so this is a
          // handover, not a shipment — no address to collect, nothing to send.
          delivery_method: 'pickup',
          pickup_instructions: 'Paid in person by scanning the product QR code',
          order_note: 'QR scan — paid in store',
          total,
          status: 'pending',
          payment_status: 'pending',
          payment_method: body.provider,
          payment_provider: 'itecpay',
        });

        await order.save({ session: txn });
      });

      // Outside the transaction: an external call must not hold a Mongo
      // transaction open, and a gateway failure is handled by cancelling the
      // order below rather than by rolling back.
      let paymentData;
      try {
        paymentData = await itecPayService.initializeTransaction(
          '',
          total,
          String(order._id),
          'RWF',
          [body.provider],
          phone
        );
      } catch (payErr: any) {
        await releaseOrder(order, fastify);
        return reply.code(payErr.statusCode || 502).send({
          error: 'Payment request failed',
          message: payErr.message || 'Could not reach the payment service. Please try again.',
        });
      }

      const reference = paymentData?.data?.reference;
      if (!reference) {
        await releaseOrder(order, fastify);
        return reply.code(502).send({
          error: 'Payment request failed',
          message: 'The payment service did not return a reference. Please try again.',
        });
      }

      order.payment_reference = reference;
      await order.save();

      return {
        order_id: String(order._id),
        reference,
        total,
        currency: product.currency || 'RWF',
        provider: body.provider,
        phone,
        message: 'Check your phone and approve the payment prompt.',
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: 'Could not start this payment',
        message: error.message,
      });
    } finally {
      await session?.endSession();
    }
  });

  /**
   * Polled by the scan page while the shopper approves the prompt. The
   * reference doubles as the bearer of authority here — an order id alone
   * gets nothing.
   */
  fastify.post('/orders/:id/status', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reference } = statusSchema.parse(request.body);

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order' });
      }

      const order = await Order.findOne({ _id: id, payment_reference: reference });
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      if (order.payment_status === 'paid') {
        return { status: 'paid', ...receipt(order) };
      }

      if (order.status === 'cancelled' || order.payment_status === 'failed') {
        return { status: 'failed', message: 'This payment did not go through. Please try again.' };
      }

      const provider = (order.payment_method === 'airtel' ? 'airtel' : 'mtn') as 'mtn' | 'airtel';
      const { status, amount } = await itecPayService.checkPaymentStatus(reference, provider);
      const normalized = String(status || '').toLowerCase();

      if (FAILURE_STATUSES.includes(normalized)) {
        await releaseOrder(order, fastify);
        return { status: 'failed', message: 'The payment was cancelled or declined. Please try again.' };
      }

      if (!SUCCESS_STATUSES.includes(normalized)) {
        return { status: 'pending', message: 'Waiting for you to approve the payment on your phone.' };
      }

      // Same gate checkout applies: never mark an order paid for less than it
      // costs, whatever the gateway's status field says.
      const paidAmount = Number(amount || 0);
      const TOLERANCE = 1; // absorbs gateway rounding, not a discount
      if (paidAmount + TOLERANCE < order.total) {
        fastify.log.warn(
          `QR pay: underpayment on order ${order._id} (ref ${reference}) — paid ${paidAmount}, expected ${order.total}`
        );
        return {
          status: 'pending',
          message: 'We could not confirm the full amount yet. Please contact the seller if you were charged.',
        };
      }

      await settleOrder(order, reference, fastify);

      return { status: 'paid', ...receipt(order) };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Could not check this payment',
        message: error.message,
      });
    }
  });
}

function receipt(order: any) {
  return {
    order_id: String(order._id),
    total: order.total,
    store_name: order.store_name,
    product_title: order.items?.[0]?.product_title,
    quantity: order.items?.[0]?.quantity,
    delivered: order.status === 'delivered',
    paid_at: order.updated_at,
  };
}

/**
 * A counter sale that never got paid: cancel it and put the stock back, the
 * same way orderCleanupService does for abandoned checkouts.
 */
async function releaseOrder(order: any, fastify: FastifyInstance) {
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

    for (const item of order.items) {
      if (item.inventory_deducted) {
        void notifyRestockedBookings(item.product_id, fastify);
      }
    }
  } catch (err) {
    fastify.log.error(err, `QR pay: failed to release order ${order._id}`);
  } finally {
    await session.endSession();
  }
}

/**
 * Marks the sale paid and delivered in one step.
 *
 * Delivery confirmation exists to protect buyers of goods that still have to
 * arrive. Nothing has to arrive here: the shopper scanned the item, paid for
 * it, and is holding it. Leaving the order "pending confirmation" would also
 * strand it forever, because a guest has no account to confirm from — so the
 * handover is recorded as what it is, which also releases the vendor's funds
 * immediately instead of after the seven-day shipping hold.
 */
async function settleOrder(order: any, reference: string, fastify: FastifyInstance) {
  const now = new Date();

  order.payment_status = 'paid';
  order.payment_reference = reference;
  order.status = 'delivered';
  order.delivered_at = now;
  order.buyer_confirmation_status = 'confirmed';
  order.buyer_confirmed_at = now;
  order.updated_at = now;

  await order.save();

  try {
    const item = order.items?.[0];
    const notification = new Notification({
      recipient_username: order.vendor_username,
      type: 'order_update',
      title: 'Paid at the counter',
      body: `${item?.product_title || 'Product'} x${item?.quantity || 1} — RWF ${Number(order.total).toLocaleString()} · ${order.buyer_phone}`,
      link: '/Orders',
      sender_name: order.buyer_name,
      metadata: { order_id: order._id },
    });
    await notification.save();

    fastify.io?.to(`user:${order.vendor_username}`).emit('notification:new', notification);
    NotificationService.sendPushNotification(order.vendor_username, notification, fastify);
  } catch (notifErr: any) {
    fastify.log.error(notifErr, 'QR pay: failed to notify vendor of counter sale');
  }
}
