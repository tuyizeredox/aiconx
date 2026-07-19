import { FastifyInstance } from 'fastify';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { ShippingZone } from '../models/ShippingZone';
import { AffiliateLink } from '../models/AffiliateLink';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { z } from 'zod';
import mongoose from 'mongoose';

const createOrderSchema = z.object({
  buyer_username: z.string().min(1).optional(),
  buyer_name: z.string().optional(),
  buyer_email: z.string().email().optional(),
  buyer_phone: z.string().optional(),
  vendor_username: z.string().optional(),
  store_id: z.string().optional(),
  store_name: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string(),
    product_title: z.string(),
    product_image: z.string().optional(),
    quantity: z.number().min(1),
    price: z.number().min(0),
    selected_color: z.string().optional(),
    selected_size: z.string().optional(),
    selected_options: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    selected_image: z.string().optional(),
  })),
  subtotal: z.number().min(0),
  shipping_fee: z.number().default(0),
  delivery_fee: z.number().default(0),
  delivery_method: z.enum(['shipping', 'delivery', 'pickup']).default('shipping'),
  total: z.number().min(0),
  shipping_address: z.string().optional(),
  shipping_country: z.string().length(2).optional(), // ISO country code
  order_note: z.string().optional(),
  affiliate_username: z.string().min(1).or(z.literal('')).optional(),
  affiliate_ref: z.string().optional(),
  affiliate_time: z.string().optional(),
    payment_method: z.enum(['card', 'paypal', 'crypto', 'bank_transfer', 'mobile_money', 'itecpay']).default('itecpay'),
});

export async function orderRoutes(fastify: FastifyInstance) {
  // List orders for a user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { role = 'buyer', vendor_username, buyer_username, affiliate_username, status, limit = 20, skip = 0 } = request.query as any;

      const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
      if (status && !allowedStatuses.includes(status)) {
        return reply.code(400).send({ error: 'Invalid status value' });
      }

      const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const parsedSkip = Math.max(parseInt(skip) || 0, 0);
      const isAdminCaller = user.role === 'super_admin';

      // Explicit vendor_username/buyer_username params are honored (several frontend
      // pages send these instead of `role`), but only for the caller's own username
      // unless they're a super_admin — never let one user page through another user's
      // private order history (buyer PII: address, phone, email).
      const filter: any = {};
      if (vendor_username) {
        if (!isAdminCaller && vendor_username.toLowerCase() !== user.username.toLowerCase()) {
          return reply.code(403).send({ error: 'You can only view your own orders' });
        }
        filter.vendor_username = vendor_username.toLowerCase();
      } else if (buyer_username) {
        if (!isAdminCaller && buyer_username.toLowerCase() !== user.username.toLowerCase()) {
          return reply.code(403).send({ error: 'You can only view your own orders' });
        }
        filter.buyer_username = buyer_username.toLowerCase();
      } else if (affiliate_username) {
        if (!isAdminCaller && affiliate_username.toLowerCase() !== user.username.toLowerCase()) {
          return reply.code(403).send({ error: 'You can only view your own referrals' });
        }
        filter.affiliate_username = affiliate_username.toLowerCase();
      } else if (role === 'buyer') {
        filter.buyer_username = user.username;
      } else {
        filter.vendor_username = user.username;
      }

      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .sort({ created_at: -1 })
        .limit(parsedLimit)
        .skip(parsedSkip)
        .lean();

      const total = await Order.countDocuments(filter);

      return {
        data: orders,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order ID' });
      }

      const order = await Order.findById(id).lean();

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check permissions
      if (order.buyer_username !== user.username && order.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      return order;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create order
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createOrderSchema.parse(request.body);

      // Get vendor and store details from the first product
      if (!body.items || body.items.length === 0) {
        return reply.code(400).send({ error: 'Order must contain at least one item' });
      }

      // Validate all product IDs
      for (const item of body.items) {
        if (!mongoose.isValidObjectId(item.product_id)) {
          return reply.code(400).send({ error: `Invalid product ID format: ${item.product_id}` });
        }
      }

      // Fetch all products from DB to get authoritative prices and vendor info
      const productIds = body.items.map(i => i.product_id);
      const uniqueProductIds = Array.from(new Set(productIds));
      const dbProducts = await Product.find({ _id: { $in: uniqueProductIds }, status: 'active' });

      if (dbProducts.length !== uniqueProductIds.length) {
        return reply.code(400).send({ error: 'One or more products not found or inactive' });
      }

      const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
      const firstProduct = productMap.get(body.items[0].product_id)!;

      // Aggregate items for inventory check (if same product added twice)
      const inventoryChecks = new Map<string, number>();
      body.items.forEach(item => {
        const current = inventoryChecks.get(item.product_id) || 0;
        inventoryChecks.set(item.product_id, current + item.quantity);
      });

      // Recalculate subtotal and total server-side
      let computedSubtotal = 0;
      const validatedItems = body.items.map(item => {
        const dbProduct = productMap.get(item.product_id)!;
        const price = dbProduct.price;
        computedSubtotal += price * item.quantity;
        const validImage = item.selected_image && dbProduct.images.includes(item.selected_image) ? item.selected_image : undefined;
        return {
          ...item,
          price, // Use DB price
          product_title: dbProduct.title, // Use DB title
          product_image: validImage || dbProduct.images[0], // Use selected image if valid, else default
          selected_image: validImage,
          inventory_deducted: dbProduct.inventory_count > 0,
        };
      });

      // Fetch store details to validate delivery settings
      const store = await Store.findById(firstProduct.store_id);
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      const delivery_method = body.delivery_method;
      let shipping_fee = 0;
      let delivery_fee = 0;
      let estimated_delivery = '';
      let pickup_instructions = '';

      // Validate delivery method against store settings
      // Default delivery settings if not set
      const ds = store.delivery_settings || {
        shipping_enabled: true,
        delivery_enabled: false,
        pickup_enabled: false,
        delivery_fee: 0,
        min_order_for_delivery: 0,
        free_delivery_above: 0,
        delivery_time_est: '',
        pickup_instructions: ''
      };

      if (delivery_method === 'shipping') {
        if (ds.shipping_enabled === false) {
          return reply.code(400).send({ error: 'Shipping is not enabled for this store' });
        }
        if (!body.shipping_address) {
          return reply.code(400).send({ error: 'Shipping address is required for shipping method' });
        }
        
        // Authoritative Shipping Fee Calculation via ShippingZones
        const countryCode = body.shipping_country?.toUpperCase();
        if (countryCode) {
          const zones = await ShippingZone.find({
            store_id: store._id.toString(),
            is_active: true,
            $or: [
              { countries: { $in: [countryCode, 'WORLD'] } },
              { countries: { $size: 0 } }
            ]
          }).sort({ countries: -1 }); // Prefer specific country match (non-empty array) over 'WORLD' or empty array

          if (zones.length > 0) {
            const zone = zones[0];
            shipping_fee = zone.flat_rate;
            estimated_delivery = `${zone.estimated_days_min}-${zone.estimated_days_max} days`;
            
            // Check for free shipping above a threshold
            if (zone.free_above > 0 && computedSubtotal >= zone.free_above) {
              shipping_fee = 0;
            }
          } else {
            // Fallback to body shipping_fee if no zone found, or 0
            shipping_fee = body.shipping_fee || 0;
          }
        } else {
          // Fallback to body shipping_fee if no country code provided
          shipping_fee = body.shipping_fee || 0;
        }
      } else if (delivery_method === 'delivery') {
        if (ds.delivery_enabled === false) {
          return reply.code(400).send({ error: 'Local delivery is not enabled for this store' });
        }
        if (!body.shipping_address) {
          return reply.code(400).send({ error: 'Delivery address is required for delivery method' });
        }
        if (computedSubtotal < (ds.min_order_for_delivery || 0)) {
          return reply.code(400).send({ error: `Minimum order for local delivery is ${ds.min_order_for_delivery}` });
        }
        
        // Check for free local delivery above a threshold
        if (ds.free_delivery_above && ds.free_delivery_above > 0 && computedSubtotal >= ds.free_delivery_above) {
          delivery_fee = 0;
        } else {
          delivery_fee = ds.delivery_fee || 0;
        }
        estimated_delivery = ds.delivery_time_est || '';
      } else if (delivery_method === 'pickup') {
        if (ds.pickup_enabled === false) {
          return reply.code(400).send({ error: 'In-store pickup is not enabled for this store' });
        }
        shipping_fee = 0;
        delivery_fee = 0;
        pickup_instructions = ds.pickup_instructions || '';
      }

      const computedTotal = computedSubtotal + shipping_fee + delivery_fee;

      // Handle affiliate tracking
      let affiliate_username = body.affiliate_username;
      let affiliate_commission = 0;
      let affiliate_link_id: string | undefined = undefined;

      if (body.affiliate_ref) {
        // 1. Check attribution window (default 30 days)
        const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
        const refTime = body.affiliate_time ? parseInt(body.affiliate_time) : Date.now();
        const isWithinWindow = (Date.now() - refTime) <= ATTRIBUTION_WINDOW_MS;

        if (isWithinWindow) {
          const affLink = await AffiliateLink.findOne({
            ref_code: body.affiliate_ref.toUpperCase(),
            status: 'active'
          });

          if (affLink) {
            // 2. Scope commission ONLY to the product in the affiliate link
            const referredItems = validatedItems.filter(item =>
              item.product_id.toString() === affLink.product_id.toString()
            );

            if (referredItems.length > 0) {
              affiliate_username = affLink.influencer_username;
              const referredSubtotal = referredItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              affiliate_commission = (referredSubtotal * affLink.commission_pct) / 100;
              affiliate_link_id = affLink._id.toString();
            }
          }
        }
      }

      // Use a session for atomicity
      const session = await mongoose.startSession();
      try {
        let order;
        await session.withTransaction(async () => {
          // Update product sales count and inventory BEFORE saving order
          for (const [productId, quantity] of inventoryChecks.entries()) {
            const dbProduct = productMap.get(productId)!;
            const inventoryFilter: any = {
              _id: productId,
              status: 'active'
            };
            if (dbProduct.inventory_count > 0) {
              inventoryFilter.inventory_count = { $gte: quantity };
            }

            const updatedProduct = await Product.findOneAndUpdate(
              inventoryFilter,
              {
                $inc: {
                  sales_count: quantity,
                  ...(dbProduct.inventory_count > 0 && { inventory_count: -quantity })
                }
              },
              { new: true, session }
            );

            if (!updatedProduct) {
              throw new Error(`Insufficient stock for product: ${productId}`);
            }
          }

          order = new Order({
            ...body,
            items: validatedItems,
            subtotal: computedSubtotal,
            shipping_fee: shipping_fee,
            delivery_fee: delivery_fee,
            delivery_method: delivery_method,
            shipping_country: body.shipping_country,
            estimated_delivery: estimated_delivery,
            pickup_instructions: pickup_instructions,
            total: computedTotal,
            buyer_username: user.username,
            buyer_name: body.buyer_name || user.display_name || user.full_name || user.username,
            buyer_email: body.buyer_email || user.email,
            buyer_phone: body.buyer_phone,
            vendor_username: firstProduct.vendor_username,
            store_id: firstProduct.store_id,
            store_name: firstProduct.store_name,
            order_note: body.order_note,
            affiliate_username: affiliate_username || undefined,
            affiliate_commission: affiliate_commission,
            affiliate_link_id,
            status: 'pending',
            payment_status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          });

          await order.save({ session });
        });

        // Notify the affiliate of the new (unpaid) referral in real time.
        // Conversion counts only increment once payment is confirmed (see creditAffiliateConversions).
        if (order! && (order as any).affiliate_username) {
          fastify.io?.to(`user:${(order as any).affiliate_username}`).emit('affiliate:new_referral', {
            order_id: (order as any)._id,
            product_title: (order as any).items?.[0]?.product_title,
            amount: (order as any).total,
            status: 'pending_payment',
          });
        }

        // Notify the vendor that their product sold ("who bought" push/in-app notification)
        try {
          const vendorUsername = (order as any).vendor_username;
          const buyerName = (order as any).buyer_name || user.username;
          const orderItems = (order as any).items as Array<{ product_title: string }>;
          const itemsSummary = orderItems.length > 1
            ? `${orderItems[0].product_title} +${orderItems.length - 1} more`
            : orderItems[0].product_title;

          const orderNotification = new Notification({
            recipient_username: vendorUsername,
            type: 'order_update',
            title: `New order from ${buyerName}`,
            body: `${itemsSummary} — RWF ${(order as any).total.toLocaleString()}`,
            link: `/Orders`,
            sender_username: user.username,
            sender_name: buyerName,
            metadata: { order_id: (order as any)._id },
          });
          await orderNotification.save();
          fastify.io?.to(`user:${vendorUsername}`).emit('notification:new', orderNotification);
          NotificationService.sendPushNotification(vendorUsername, orderNotification, fastify);
        } catch (notifErr: any) {
          fastify.log.error(notifErr, 'Failed to create order notification');
        }

        return order;
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong while creating your order'
      });
    }
  });

  // Update order status
  fastify.patch('/:id/status', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
      }).parse(request.body);
      const user = request.user as any;

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order ID' });
      }

      const order = await Order.findById(id);
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      const isVendor = order.vendor_username === user.username;
      const isBuyer = order.buyer_username === user.username;

      if (!isVendor && !isBuyer) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Only vendor can update status to fulfillment states
      if (!isVendor && ['confirmed', 'processing', 'shipped', 'delivered', 'refunded'].includes(status)) {
        return reply.code(403).send({ error: 'Unauthorized: Only vendors can update order fulfillment status' });
      }

      // Only buyer can update status to cancelled if it's still pending
      if (isBuyer && !isVendor && status === 'cancelled' && order.status !== 'pending') {
        return reply.code(400).send({ error: 'Cannot cancel order after it has been confirmed' });
      }

      // If user is just a buyer, they can only cancel
      if (isBuyer && !isVendor && status !== 'cancelled') {
        return reply.code(403).send({ error: 'Unauthorized: Buyers can only cancel orders' });
      }

      order.status = status as any;
      order.updated_at = new Date();

      if (status === 'delivered') {
        order.delivered_at = new Date();
        order.buyer_confirmation_status = 'pending';
      }

      // Restore inventory when an order is cancelled or refunded, so stock counts
      // stay accurate instead of being permanently lost. Guarded by stock_restored
      // to avoid double-crediting if status flips back and forth.
      if (['cancelled', 'refunded'].includes(status) && !order.stock_restored) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            for (const item of order.items) {
              if (item.inventory_deducted) {
                await Product.findByIdAndUpdate(
                  item.product_id,
                  {
                    $inc: {
                      inventory_count: item.quantity,
                      sales_count: -item.quantity,
                    },
                  },
                  { session }
                );
              }
            }
            order.stock_restored = true;
            await order.save({ session });
          });
        } finally {
          await session.endSession();
        }
      } else {
        await order.save();
      }

      // Let the affiliate track the referral's fulfillment status in real time.
      if (order.affiliate_username) {
        fastify.io?.to(`user:${order.affiliate_username}`).emit('affiliate:order_update', {
          order_id: order._id,
          product_title: order.items?.[0]?.product_title,
          status: order.status,
        });
      }

      return order;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Buyer confirms receipt, or disputes a delivered order. Funds only become withdrawable
  // once this happens (or automatically after the auto-release window — see
  // utils/platformFinance.ts) — delivery status alone no longer unlocks payout.
  fastify.patch('/:id/confirm-delivery', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { action, reason } = z.object({
        action: z.enum(['confirm', 'dispute']),
        reason: z.string().optional(),
      }).parse(request.body);
      const user = request.user as any;

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order ID' });
      }
      if (action === 'dispute' && !reason) {
        return reply.code(400).send({ error: 'A reason is required to report a problem with an order.' });
      }

      const order = await Order.findById(id);
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }
      if (order.buyer_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }
      if (order.status !== 'delivered') {
        return reply.code(400).send({ error: 'This order has not been marked as delivered yet.' });
      }
      if (order.buyer_confirmation_status !== 'pending') {
        return reply.code(409).send({ error: 'This order has already been confirmed or reported.' });
      }

      if (action === 'confirm') {
        order.buyer_confirmation_status = 'confirmed';
        order.buyer_confirmed_at = new Date();
      } else {
        order.buyer_confirmation_status = 'disputed';
        order.dispute_reason = reason;
      }
      order.updated_at = new Date();
      await order.save();

      const confirmationNotification = await new Notification({
        recipient_username: order.vendor_username,
        type: 'order_update',
        title: action === 'confirm'
          ? `Order confirmed — ${order.items?.[0]?.product_title || 'your order'}`
          : `Order disputed — ${order.items?.[0]?.product_title || 'your order'}`,
        body: action === 'dispute' ? reason : undefined,
        link: '/MyStore',
        sender_username: user.username,
        metadata: { order_id: order._id },
      }).save();
      fastify.io?.to(`user:${order.vendor_username}`).emit('notification:new', confirmationNotification);
      NotificationService.sendPushNotification(order.vendor_username, confirmationNotification, fastify);

      return order;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}