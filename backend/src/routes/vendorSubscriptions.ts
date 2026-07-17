import { FastifyInstance } from 'fastify';
import { VendorSubscription, IVendorSubscription } from '../models/VendorSubscription';
import { Product } from '../models/Product';
import { Settings } from '../models/Settings';
import { User } from '../models/User';
import { checkCustomDomainLimit, PLAN_PRIORITY } from '../middleware/subscription';
import { itecPayService } from '../services/itecPayService';
import { getPlanPrice, DEFAULT_PLAN_PRICES } from '../utils/planPricing';
import { DEFAULT_PLATFORM_FEE_PERCENT, DEFAULT_MIN_WITHDRAWAL_AMOUNT } from '../utils/platformFinance';

export async function vendorSubscriptionRoutes(fastify: FastifyInstance) {
  // Get subscription for a vendor
  fastify.get('/vendor/:vendorUsername', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { vendorUsername } = request.params as { vendorUsername: string };
      const user = request.user as any;

      // Check if user owns the vendor account
      if (user.username !== vendorUsername.toLowerCase()) {
        return reply.code(403).send({ error: 'You can only view your own subscription' });
      }

      const subscription = await VendorSubscription.findOne({
        vendor_username: vendorUsername.toLowerCase(),
        status: 'active'
      });

      if (!subscription) {
        return reply.code(404).send({ error: 'No active subscription found' });
      }

      return reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get subscription for a store
  fastify.get('/store/:storeId', async (request, reply) => {
    try {
      const { storeId } = request.params as { storeId: string };

      const subscription = await VendorSubscription.findOne({
        store_id: storeId,
        status: 'active'
      });

      if (!subscription) {
        return reply.code(404).send({ error: 'No active subscription found for this store' });
      }

      return reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List vendor subscriptions with filtering
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const user = request.user as any;
      const {
        vendor_username,
        store_id,
        plan,
        status,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Check if user owns the vendor account (unless admin)
      if (vendor_username && user.username !== vendor_username.toLowerCase() && user.role !== 'super_admin') {
        return reply.code(403).send({ error: 'You can only view your own subscriptions' });
      }

      // Build filter object
      const filter: any = {};

      if (vendor_username) {
        filter.vendor_username = vendor_username.toLowerCase();
      } else if (user.role !== 'super_admin') {
        // Force filter to own username for non-admins
        filter.vendor_username = user.username;
      }
      if (store_id) filter.store_id = store_id;
      if (plan) filter.plan = plan;
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const subscriptions = await VendorSubscription
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // Fetch user roles for each subscription
      const vendorUsernames = [...new Set(subscriptions.map(s => s.vendor_username))];
      const users = await User.find({ username: { $in: vendorUsernames } }).select('username role');
      const userRoleMap = new Map(users.map(u => [u.username, u.role]));

      // Fetch plan prices from Settings for amount calculation
      const settings = await Settings.findOne();
      const storedPlanPrices = settings?.plan_prices;

      // Add user_role and calculate amounts based on current plan prices
      const subscriptionsWithRoles = await Promise.all(subscriptions.map(async (sub) => {
        const subObj = sub.toObject() as any;
        subObj.user_role = userRoleMap.get(sub.vendor_username) || 'user';

        // Always calculate amount from current plan prices for admin view
        const plan = (sub.plan || 'free') as string;
        const billingCycle = (sub.billing_cycle || 'monthly') as string;
        const prices = (storedPlanPrices as any)?.[plan] || (DEFAULT_PLAN_PRICES as any)[plan];
        const calculatedAmount = prices ? (billingCycle === 'annual' ? prices.annual : prices.monthly) : 0;
        subObj.amount = calculatedAmount;

        // Update DB if stored amount differs from current plan price
        if (subObj.amount !== calculatedAmount && calculatedAmount > 0) {
          await VendorSubscription.updateOne({ _id: sub._id }, { $set: { amount: calculatedAmount } });
        }

        return subObj;
      }));

      const total = await VendorSubscription.countDocuments(filter);

      return reply.send({
        subscriptions: subscriptionsWithRoles,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get subscription by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      return reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create vendor subscription
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IVendorSubscription>;
      const user = request.user as any;

      // Validate required fields
      if (!body.plan) {
        return reply.code(400).send({ error: 'Missing required field: plan' });
      }

      // Validate plan
      const validPlans = ['free', 'pro', 'elite'];
      if (!validPlans.includes(body.plan)) {
        return reply.code(400).send({ error: 'Invalid plan. Must be free, pro, or elite' });
      }

      // Set vendor_username from authenticated user
      body.vendor_username = user.username;

      // Set status based on plan
      body.status = body.plan === 'free' ? 'active' : 'pending';
      body.started_at = new Date();

      // Set expiration date based on billing cycle
      if (body.billing_cycle === 'annual') {
        body.expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      } else {
        body.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      const subscription = new VendorSubscription(body);
      await subscription.save();

      // If activated immediately (like 'free' plan), update products
      if (subscription.status === 'active') {
        try {
          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            { 
              vendor_plan: subscription.plan,
              plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0
            }
          );
        } catch (err) {
          fastify.log.error(err, 'Failed to sync product plans on creation:');
        }
      }

      return reply.code(201).send(subscription);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return reply.code(409).send({ error: 'An active subscription already exists for this vendor' });
      } else {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Update vendor subscription
  fastify.put('/:id', {
    preHandler: [fastify.authenticate, checkCustomDomainLimit]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IVendorSubscription>;
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own subscription' });
      }

      // Update allowed non-plan fields
      if (body.custom_domain !== undefined) subscription.custom_domain = body.custom_domain;
      if (body.payment_method !== undefined) subscription.payment_method = body.payment_method;

      // Validate plan if being updated
      if (body.plan) {
        const validPlans = ['free', 'pro', 'elite'];
        if (!validPlans.includes(body.plan)) {
          return reply.code(400).send({ error: 'Invalid plan. Must be free, pro, or elite' });
        }

        if (body.plan === 'free') {
          // Downgrade to free: apply immediately, clear any pending upgrade
          subscription.plan = 'free';
          subscription.status = 'active';
          subscription.pending_plan = undefined;
          subscription.pending_billing_cycle = undefined;
          subscription.pending_amount = undefined;
          subscription.set('custom_domain', null);
        } else if (subscription.status === 'active' && subscription.plan !== 'free' && subscription.plan !== body.plan) {
          // Upgrading from an active PAID plan (pro → elite):
          // Do NOT downgrade current plan — store target in pending_plan so the user
          // keeps their existing paid features while the new payment is processed.
          const targetCycle = (body.billing_cycle || subscription.billing_cycle) as 'monthly' | 'annual';
          subscription.pending_plan = body.plan as 'pro' | 'elite';
          subscription.pending_billing_cycle = targetCycle;
          // Server-computed price for this plan/cycle — the amount actually charged
          // and verified before activation must be checked against this, never
          // against whatever amount the client later claims to have paid.
          subscription.pending_amount = await getPlanPrice(subscription.pending_plan, targetCycle);
          // status and plan remain unchanged
        } else if (subscription.plan !== body.plan || subscription.status !== 'active') {
          // First-time paid sub, or free → paid upgrade, or re-attempting a pending payment:
          // Store target plan in pending_plan - only activate after payment verification
          const targetCycle = (body.billing_cycle || subscription.billing_cycle) as 'monthly' | 'annual';
          subscription.pending_plan = body.plan as 'pro' | 'elite';
          subscription.pending_billing_cycle = targetCycle;
          subscription.pending_amount = await getPlanPrice(subscription.pending_plan, targetCycle);
          subscription.status = 'pending';
          // Keep current plan unchanged until payment is verified
          if (body.billing_cycle) {
            subscription.billing_cycle = body.billing_cycle;
          }
        }
      }

      await subscription.save();

      // Update products if plan/status changed
      if (subscription.status === 'active') {
        try {
          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            { 
              vendor_plan: subscription.plan,
              plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0
            }
          );
        } catch (err) {
          fastify.log.error(err, 'Failed to sync product plans on update:');
        }
      }

      return reply.send(subscription);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return reply.code(409).send({ error: 'Custom domain is already in use' });
      } else {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Cancel subscription or pending plan
  fastify.post('/:id/cancel', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only cancel your own subscription' });
      }

      let syncWarning: string | undefined;
      let message = 'Subscription cancelled';

      // Cancel a pending upgrade before payment is completed
      if (subscription.pending_plan) {
        subscription.pending_plan = undefined;
        subscription.pending_billing_cycle = undefined;
        subscription.pending_amount = undefined;
        await subscription.save();
        message = 'Pending upgrade cancelled';
        return reply.send({ ...subscription.toObject(), message, warning: syncWarning });
      }

      // Cancel a pending first-time paid subscription and revert to free
      if (subscription.status === 'pending') {
        subscription.plan = 'free';
        subscription.status = 'active';
        subscription.billing_cycle = 'monthly';
        subscription.pending_plan = undefined;
        subscription.pending_billing_cycle = undefined;
        subscription.pending_amount = undefined;
        subscription.set('custom_domain', null);
        await subscription.save();
        message = 'Pending subscription cancelled';
        try {
          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            { vendor_plan: 'free', plan_priority: 0 }
          );
        } catch (err) {
          request.log.error(err, 'Failed to reset product plans on cancel:');
          syncWarning = 'Subscription cancelled but product plan sync failed. Contact support.';
        }
        return reply.send({ ...subscription.toObject(), message, warning: syncWarning });
      }

      // Cancel an active paid subscription
      subscription.status = 'cancelled';
      subscription.plan = 'free';
      subscription.billing_cycle = 'monthly';
      subscription.pending_plan = undefined;
      subscription.pending_billing_cycle = undefined;
      subscription.pending_amount = undefined;
      subscription.set('custom_domain', null);
      await subscription.save();

      // Reset product plan and priority
      try {
        await Product.updateMany(
          { vendor_username: subscription.vendor_username },
          { vendor_plan: 'free', plan_priority: 0 }
        );
      } catch (err) {
        request.log.error(err, 'Failed to reset product plans on cancel:');
        syncWarning = 'Subscription cancelled but product plan sync failed. Contact support.';
      }

      return reply.send({ ...subscription.toObject(), message, warning: syncWarning });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Renew subscription
  fastify.post('/:id/renew', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reference } = (request.body || {}) as { reference?: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only renew your own subscription' });
      }

      // Renewing a paid plan must never just extend expiry on trust — it requires
      // a real payment, verified with the gateway, for at least the plan's price.
      if (subscription.plan !== 'free') {
        if (!reference) {
          return reply.code(400).send({ error: 'Missing payment reference. Renewals require a completed payment.' });
        }

        if (subscription.payment_reference === reference) {
          return reply.code(409).send({ error: 'This payment reference has already been used.' });
        }

        let verifyResult: any;
        try {
          const provider = (subscription.payment_method || 'mtn') as 'mtn' | 'airtel' | 'spenn' | 'card';
          verifyResult = await itecPayService.verifyPayment(reference, provider);
        } catch (verifyErr: any) {
          return reply.code(402).send({ error: 'Payment not confirmed', message: verifyErr.message });
        }

        const paidAmount = Number(verifyResult?.data?.amount || 0);
        const expectedAmount = await getPlanPrice(subscription.plan, subscription.billing_cycle);
        const TOLERANCE = 1; // guard against gateway float rounding, not a discount
        if (paidAmount + TOLERANCE < expectedAmount) {
          return reply.code(402).send({ error: 'Payment amount does not cover the renewal price' });
        }

        subscription.payment_reference = reference;
        subscription.last_payment_date = new Date();
        subscription.amount = paidAmount;
      }

      // Calculate new expiration date
      const currentExpiry = subscription.expires_at || new Date();
      let newExpiry: Date;

      if (subscription.billing_cycle === 'annual') {
        newExpiry = new Date(currentExpiry.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      subscription.expires_at = newExpiry;
      subscription.status = 'active';
      await subscription.save();

      // Sync product plan and priority
      let syncWarning: string | undefined;
      try {
        await Product.updateMany(
          { vendor_username: subscription.vendor_username },
          { 
            vendor_plan: subscription.plan, 
            plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0 
          }
        );
      } catch (err) {
        request.log.error(err, 'Failed to sync product plans on renew:');
        syncWarning = 'Subscription renewed but product plan sync failed. Contact support.';
      }

      return reply.send({ ...subscription.toObject(), warning: syncWarning });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete subscription
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own subscription' });
      }

      await VendorSubscription.findByIdAndDelete(id);

      return reply.send({ message: 'Vendor subscription deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Check subscription status
  fastify.get('/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      const now = new Date();
      let currentStatus = subscription.status;

      // Check if subscription has expired
      if (subscription.expires_at && subscription.expires_at < now && subscription.status === 'active') {
        currentStatus = 'expired';
        // Update the status in database
        subscription.status = 'expired';
        await subscription.save();
      }

      const daysUntilExpiry = subscription.expires_at
        ? Math.ceil((subscription.expires_at.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return reply.send({
        subscription_id: id,
        plan: subscription.plan,
        status: currentStatus,
        billing_cycle: subscription.billing_cycle,
        expires_at: subscription.expires_at,
        days_until_expiry: daysUntilExpiry,
        is_expired: currentStatus === 'expired',
        custom_domain: subscription.custom_domain
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get subscription plans and pricing (public endpoint)
  fastify.get('/public/plans', async (request, reply) => {
    try {
      const settings = await Settings.findOne().select('subscription_mode plan_prices platform_fee_percent min_withdrawal_amount').lean();
      const subscription_mode = settings?.subscription_mode ?? false;
      const prices = settings?.plan_prices ?? DEFAULT_PLAN_PRICES;
      const platform_fee_percent = settings?.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT;
      const min_withdrawal_amount = settings?.min_withdrawal_amount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT;

      const plans = {
        free: {
          name: 'Starter',
          price_monthly: prices.free?.monthly ?? 0,
          price_annual: prices.free?.annual ?? 0,
          features: [
            'Up to 10 products',
            '5 images per product',
            'Basic analytics',
            'Standard search listing',
            'Community support'
          ]
        },
        pro: {
          name: 'Pro',
          price_monthly: prices.pro?.monthly ?? 29000,
          price_annual: prices.pro?.annual ?? 23000,
          features: [
            'Up to 200 products',
            '20 images + videos per product',
            'Advanced analytics & CTR data',
            'Priority search listing',
            'Custom domain mapping',
            'Shipping zone manager',
            'AI-powered content generation',
            'Live shopping sessions',
            'Store coupons & discounts',
            'Email support'
          ]
        },
        elite: {
          name: 'Elite',
          price_monthly: prices.elite?.monthly ?? 79000,
          price_annual: prices.elite?.annual ?? 63000,
          features: [
            'Unlimited products',
            'Unlimited images & videos',
            'Full analytics suite',
            'Top-tier search placement',
            'Custom domain + SSL',
            'Shipping zones + live rates',
            'AI-powered content generation',
            'Live shopping sessions + priority',
            'Store coupons & discounts',
            'Dedicated account manager',
            'Affiliate program access'
          ]
        }
      };

      return reply.send({ plans, subscription_mode, platform_fee_percent, min_withdrawal_amount });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update subscription plan prices (admin only)
  fastify.put('/public/plans', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      if (user.role !== 'super_admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const { plan_prices } = request.body as { plan_prices: typeof DEFAULT_PLAN_PRICES };

      if (!plan_prices) {
        return reply.code(400).send({ error: 'Missing plan_prices in request body' });
      }

      const settings = await Settings.findOneAndUpdate(
        {},
        { $set: { plan_prices } },
        { upsert: true, new: true }
      );

      return reply.send({ success: true, plan_prices: settings.plan_prices });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

   // Verify payment for a subscription
   fastify.post('/:id/verify-payment', {
     preHandler: fastify.authenticate
   }, async (request, reply) => {
     try {
       const { id } = request.params as { id: string };
       const { reference } = request.body as { reference: string };
       const user = request.user as any;

       if (!reference) {
         return reply.code(400).send({ error: 'Missing payment reference' });
       }

       const subscription = await VendorSubscription.findById(id);

       if (!subscription) {
         return reply.code(404).send({ error: 'Subscription not found' });
       }

       // Check ownership
       if (subscription.vendor_username !== user.username) {
         return reply.code(403).send({ error: 'You can only verify your own subscription' });
       }

       // Check if subscription is already active with this reference
       if (subscription.payment_reference === reference && subscription.status === 'active') {
         return reply.send(subscription);
       }

       // Also check if subscription is active regardless of reference (callback may have fired)
       if (subscription.status === 'active' && !subscription.pending_plan) {
         return reply.send(subscription);
       }

       // Poll ITEC Pay directly to check if payment succeeded
       try {
         const provider = subscription.payment_method || 'mtn';
         const verifyResult = await itecPayService.verifyPayment(reference, provider as 'mtn' | 'airtel' | 'spenn' | 'card');
         const res = verifyResult as any;
         const isPaid =
           res.status === 'success' || res.status === 200 || res.status === true ||
           res.data?.status === 'success' || res.data?.status === 'completed' ||
           String(res.data?.status).toLowerCase() === 'successful';

         if (isPaid) {
           await itecPayService.handleSuccessfulPayment(
             `SUB-${id}`,
             res.data?.transaction_id || reference,
             String(res.data?.amount || '')
           );
           const updated = await VendorSubscription.findById(id);
           return reply.send(updated);
         }
       } catch (verifyErr: any) {
         fastify.log.warn('ITEC Pay direct verify failed, falling back to pending state:', verifyErr.message);
       }

       return reply.code(402).send({ 
         error: 'Payment verification pending. Please wait for the ITEC Pay callback.',
         details: 'Payments are verified automatically via ITEC Pay webhook callbacks.' 
       });
     } catch (error) {
       fastify.log.error(error);
       return reply.code(500).send({ error: 'Internal server error' });
     }
   });
}