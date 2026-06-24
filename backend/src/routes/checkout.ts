import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { CartItem } from '../models/CartItem';
import { ShippingZone } from '../models/ShippingZone';
import { AffiliateLink } from '../models/AffiliateLink';
import { itecPayService } from '../services/itecPayService';
import { Coupon } from '../models/Coupon';

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().min(1),
  })).optional(),
  shipping_address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('NG'),
    phone: z.string(),
  }).optional(),
    payment_method: z.enum(['card', 'itecpay', 'mobile_money', 'mtn', 'airtel', 'spenn', 'bank_transfer']).default('itecpay'),
  mobile_money_phone: z.string().optional(),
  order_note: z.string().optional(),
  coupon_code: z.string().optional(),
  affiliate_ref: z.string().optional(),
  affiliate_time: z.string().optional(),
  store_fulfillment_types: z.record(z.string(), z.enum(['shipping', 'delivery', 'pickup'])).optional(),
});

export async function checkoutRoutes(fastify: FastifyInstance) {
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = request.user as any;
      const body = checkoutSchema.parse(request.body);

      // 1. Get items (either from body or current cart)
      let cartItemsToProcess = [];
      if (body.items && body.items.length > 0) {
        for (const item of body.items) {
           const ci = await CartItem.findOne({ user_username: user.username, product_id: item.product_id });
           cartItemsToProcess.push({
             product_id: item.product_id,
             quantity: item.quantity,
             affiliate_username: ci?.affiliate_username
           });
        }
      } else {
        const cartItems = await CartItem.find({ user_username: user.username });
        if (cartItems.length === 0) {
          throw new Error('Cart is empty');
        }
        cartItemsToProcess = cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          affiliate_username: item.affiliate_username
        }));
      }

      // 2. Fetch all products and stores
      const productIds = cartItemsToProcess.map(i => i.product_id);
      const dbProducts = await Product.find({ _id: { $in: productIds }, status: 'active' });
      
      if (dbProducts.length !== new Set(productIds).size) {
        throw new Error('One or more products not found or inactive');
      }

      const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
      const storeIds = Array.from(new Set(dbProducts.map(p => p.store_id.toString())));
      const dbStores = await Store.find({ _id: { $in: storeIds } });
      const storeMap = new Map(dbStores.map(s => [s._id.toString(), s]));

      // 3. Group items by store
      const storeGroups: Record<string, any[]> = {};
      for (const item of cartItemsToProcess) {
        const product = productMap.get(item.product_id)!;
        const storeId = product.store_id.toString();
        if (!storeGroups[storeId]) storeGroups[storeId] = [];
        storeGroups[storeId].push({
          ...item,
          product,
        });
      }

      // 4. Validate Coupon if provided
      let coupon = null;
      let totalSubtotalAcrossStores = 0;

      if (body.coupon_code) {
        coupon = await Coupon.findOne({ 
          code: body.coupon_code.toUpperCase(), 
          status: 'active',
          expires_at: { $gt: new Date() }
        });
        if (!coupon) {
          throw new Error('Invalid or expired coupon code');
        }
      }

      // 4.5 Pre-fetch Affiliate Link if global ref provided
      let globalAffLink = null;
      if (body.affiliate_ref) {
        const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
        const refTime = body.affiliate_time ? parseInt(body.affiliate_time) : Date.now();
        const isWithinWindow = (Date.now() - refTime) <= ATTRIBUTION_WINDOW_MS;
        
        if (isWithinWindow) {
          globalAffLink = await AffiliateLink.findOne({
            ref_code: body.affiliate_ref.toUpperCase(),
            status: 'active'
          });
        }
      }

      // Pre-calculate total subtotal if we have a global flat coupon
      if (coupon && !coupon.store_id && coupon.discount_type === 'flat') {
        for (const storeId in storeGroups) {
          const groupItems = storeGroups[storeId];
          totalSubtotalAcrossStores += groupItems.reduce((sum: number, gi: any) => sum + (gi.product.price * gi.quantity), 0);
        }
      }

      const orders: any[] = [];
      let totalAmount = 0;

      // 5. Create orders for each store
      for (const storeId in storeGroups) {
        const groupItems = storeGroups[storeId];
        const store = storeMap.get(storeId)!;
        const storeSettings = store.delivery_settings || {};
        
        let subtotal = 0;
        let affiliate_commission = 0;
        let affiliate_username: string | undefined = undefined;

        const orderItems = groupItems.map((gi: any) => {
          const price = gi.product.price;
          subtotal += price * gi.quantity;
          
          let itemAffiliate = gi.affiliate_username;
          let itemCommissionPct = 0;

          if (globalAffLink && globalAffLink.product_id.toString() === gi.product_id.toString()) {
            itemAffiliate = globalAffLink.influencer_username;
            itemCommissionPct = globalAffLink.commission_pct;
          }

          if (itemAffiliate) {
             affiliate_username = itemAffiliate;
             if (itemCommissionPct > 0) {
                affiliate_commission += (price * gi.quantity * itemCommissionPct) / 100;
             }
          }

          return {
            product_id: gi.product_id,
            product_title: gi.product.title,
            product_image: gi.product.images[0],
            quantity: gi.quantity,
            price: price,
          };
        });

        // 5a. Determine fulfillment type for this store
        const requestedFulfillment = body.store_fulfillment_types?.[storeId];
        let fulfillmentType: 'shipping' | 'delivery' | 'pickup';

        if (requestedFulfillment) {
          fulfillmentType = requestedFulfillment;
        } else {
          // Default: first enabled method
          if (storeSettings.shipping_enabled !== false) {
            fulfillmentType = 'shipping';
          } else if (storeSettings.delivery_enabled) {
            fulfillmentType = 'delivery';
          } else if (storeSettings.pickup_enabled) {
            fulfillmentType = 'pickup';
          } else {
            fulfillmentType = 'shipping';
          }
        }

        // 5b. Validate the selected method is enabled for this store
        if (fulfillmentType === 'pickup' && !storeSettings.pickup_enabled) {
          throw new Error(`Store pickup is not available for: ${store.name}`);
        }
        if (fulfillmentType === 'delivery' && !storeSettings.delivery_enabled) {
          throw new Error(`Local delivery is not available for: ${store.name}`);
        }
        if (fulfillmentType === 'shipping' && storeSettings.shipping_enabled === false) {
          throw new Error(`Shipping is not available for: ${store.name}`);
        }

        // 5c. Require address for shipping/delivery
        if (['shipping', 'delivery'].includes(fulfillmentType) && !body.shipping_address) {
          throw new Error(`A delivery address is required for order from: ${store.name}`);
        }

        // 5d. Calculate fulfillment fee
        let shipping_fee = 0;
        let order_delivery_fee = 0;
        let pickup_instructions_val: string | undefined;
        let estimated_delivery: string | undefined;

        if (fulfillmentType === 'pickup') {
          shipping_fee = 0;
          pickup_instructions_val = storeSettings.pickup_instructions;
          estimated_delivery = storeSettings.delivery_time_est;
        } else if (fulfillmentType === 'delivery') {
          // Validate minimum order for delivery
          if (storeSettings.min_order_for_delivery && subtotal < storeSettings.min_order_for_delivery) {
            throw new Error(`Minimum order for local delivery from ${store.name} is $${storeSettings.min_order_for_delivery}`);
          }
          let fee = storeSettings.delivery_fee || 0;
          if (storeSettings.free_delivery_above && subtotal >= storeSettings.free_delivery_above) {
            fee = 0;
          }
          order_delivery_fee = fee;
          shipping_fee = fee;
          estimated_delivery = storeSettings.delivery_time_est;
        } else {
          // shipping - use ShippingZone configuration
          const countryCode = body.shipping_address!.country.toUpperCase();
          const zones = await ShippingZone.find({
            store_id: storeId,
            is_active: true,
            $or: [
              { countries: { $in: [countryCode, 'WORLD'] } },
              { countries: { $size: 0 } }
            ]
          }).sort({ countries: -1 });

          if (zones.length > 0) {
            const zone = zones[0];
            shipping_fee = zone.flat_rate;
            if (zone.free_above > 0 && subtotal >= zone.free_above) {
              shipping_fee = 0;
            }
          }
        }

        // 5e. Apply coupon discount
        let discount = 0;
        if (coupon) {
           if (coupon.store_id && coupon.store_id.toString() === storeId) {
             if (coupon.discount_type === 'percentage') {
               discount = (subtotal * coupon.discount_value) / 100;
             } else {
               discount = Math.min(coupon.discount_value, subtotal);
             }
           } else if (!coupon.store_id) {
             if (coupon.discount_type === 'percentage') {
               discount = (subtotal * coupon.discount_value) / 100;
             } else {
               if (totalSubtotalAcrossStores > 0) {
                 const proportionalDiscount = (subtotal / totalSubtotalAcrossStores) * coupon.discount_value;
                 discount = Math.min(Math.round(proportionalDiscount * 100) / 100, subtotal);
               } else {
                 discount = Math.min(coupon.discount_value, subtotal);
               }
             }
           }
        }

        const orderTotal = subtotal + shipping_fee - discount;
        totalAmount += orderTotal;

        // Build shipping address string
        let shippingAddressStr: string | undefined;
        if (body.shipping_address && fulfillmentType !== 'pickup') {
          const addr = body.shipping_address;
          shippingAddressStr = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}`;
        } else if (fulfillmentType === 'pickup') {
          shippingAddressStr = store.address ? `Store Pickup — ${store.address}` : 'Store Pickup';
        }

        const order = new Order({
          buyer_username: user.username,
          buyer_name: user.display_name || user.full_name || user.username,
          buyer_email: user.email,
          buyer_phone: body.shipping_address?.phone || user.phone_number || '',
          vendor_username: store.owner_username,
          store_id: store._id,
          store_name: store.name,
          items: orderItems,
          subtotal,
          shipping_fee,
          delivery_fee: order_delivery_fee,
          delivery_method: fulfillmentType,
          discount_amount: discount,
          total: orderTotal,
          shipping_address: shippingAddressStr,
          shipping_country: body.shipping_address?.country,
          estimated_delivery,
          pickup_instructions: pickup_instructions_val,
          order_note: body.order_note,
          status: 'pending',
          payment_status: 'pending',
          payment_method: body.payment_method,
          affiliate_username,
          affiliate_commission,
          affiliate_ref: body.affiliate_ref,
          affiliate_time: body.affiliate_time,
        });

        // Inventory check and reduction
         for (const item of groupItems) {
           const product = productMap.get(item.product_id)!;
           // Only check inventory if product has inventory_count > 0 (0 means unlimited/no tracking)
           const inventoryFilter: any = { 
             _id: item.product_id, 
             status: 'active'
           };
           if (product.inventory_count > 0) {
             inventoryFilter.inventory_count = { $gte: item.quantity };
           }

           const updatedProduct = await Product.findOneAndUpdate(
             inventoryFilter,
             {
               $inc: { 
                 sales_count: item.quantity,
                 ...(product.inventory_count > 0 && { inventory_count: -item.quantity })
               }
             },
             { new: true, session }
           );

           if (!updatedProduct) {
             throw new Error(`Insufficient stock for product: ${item.product.title}`);
           }
         }

        await order.save({ session });
        orders.push(order);

        if (globalAffLink) {
           await AffiliateLink.findByIdAndUpdate(globalAffLink._id, {
             $inc: { 
               conversions: 1,
               total_commission_earned: affiliate_commission 
             }
           }, { session });
        }
      }

      // 5.5 Increment coupon usage count if used
      if (coupon) {
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { uses_count: 1 } }, { session });
      }

// 6. Initialize Payment if ITEC Pay or other methods
       let paymentData = null;
       const itecPayPayments = ['itecpay', 'card', 'mobile_money', 'mtn', 'airtel', 'spenn'];
       if (itecPayPayments.includes(body.payment_method)) {
         const orderIds = orders.map(o => o._id.toString()).join(',');

         // Determine provider for ITEC Pay
         let provider: string;
         if (body.payment_method === 'card' || body.payment_method === 'itecpay') {
           provider = 'card';
         } else if (body.payment_method === 'mtn' || body.payment_method === 'mobile_money') {
           provider = 'mtn';
         } else if (body.payment_method === 'airtel') {
           provider = 'airtel';
         } else {
           provider = 'spenn';
         }

paymentData = await itecPayService.initializeTransaction(
            user.email,
            totalAmount,
            orderIds,
            undefined,
            [provider],
            body.mobile_money_phone || body.shipping_address?.phone || user.phone_number || ''
          );
       }

      // 7. Clear Cart
      await CartItem.deleteMany({ user_username: user.username }, { session });

      await session.commitTransaction();

      return {
        message: 'Checkout successful',
        orders: orders.map(o => o._id),
        total_amount: totalAmount,
        payment_url: paymentData?.data?.authorization_url,
        reference: paymentData?.data?.reference,
      };

    } catch (error: any) {
      await session.abortTransaction();
      fastify.log.error(error);
      return reply.code(400).send({ 
        error: 'Checkout failed', 
        message: error.message 
      });
    } finally {
      session.endSession();
    }
  });

  // Verify payment endpoint
  fastify.post('/:orderId/verify-payment', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const { reference } = request.body as { reference: string };
      const user = request.user as any;

      // Find the order
      const order = await Order.findOne({ _id: orderId });
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Verify the payment with ITEC Pay
      const verificationResult = await itecPayService.verifyPayment(reference, 'mtn');

      if (verificationResult.data?.status === 'completed' || 
          verificationResult.data?.status === 'success' || 
          verificationResult.data?.status === 'successful' ||
          verificationResult.data?.status === 'paid' ||
          verificationResult.data?.status === 'approved') {
        
        // Update order payment status
        order.payment_status = 'paid';
        order.status = 'confirmed';
        order.payment_reference = reference;
        await order.save();

        return {
          message: 'Payment verified successfully',
          order: order._id,
          status: 'paid'
        };
      } else {
        return reply.code(400).send({ 
          error: 'Payment verification failed', 
          message: 'Payment not completed yet',
          status: verificationResult.data?.status 
        });
      }
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(400).send({ 
        error: 'Payment verification failed', 
        message: error.message 
      });
    }
  });
}
