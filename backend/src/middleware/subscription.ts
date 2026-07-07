import { FastifyRequest, FastifyReply } from 'fastify';
import { VendorSubscription } from '../models/VendorSubscription';
import { Product } from '../models/Product';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { Settings } from '../models/Settings';

export const PLAN_LIMITS = {
  free: { 
    products: 10, 
    images_per_product: 5,
    videos_per_product: 0,
    media_per_product: 5,
    custom_domain: false,
    shipping_zones: false,
    affiliate_program: false,
    ai_features: true,
    live_sessions: false,
    live_chat: false,
    coupons: false,
    advanced_analytics: false
  },
  pro: { 
    products: 200, 
    images_per_product: 20,
    videos_per_product: 20,
    media_per_product: 20,
    custom_domain: true,
    shipping_zones: true,
    affiliate_program: false,
    ai_features: true,
    live_sessions: true,
    live_chat: true,
    coupons: true,
    advanced_analytics: true
  },
  elite: { 
    products: Infinity, 
    images_per_product: Infinity,
    videos_per_product: Infinity,
    media_per_product: Infinity,
    custom_domain: true,
    shipping_zones: true,
    affiliate_program: true,
    ai_features: true,
    live_sessions: true,
    live_chat: true,
    coupons: true,
    advanced_analytics: true
  }
};

export const PLAN_PRIORITY = {
  free: 0,
  pro: 1,
  elite: 2
};

/**
 * Check if subscription mode is enabled globally.
 * When disabled, all vendors get elite-level access for free.
 */
async function isSubscriptionModeEnabled(): Promise<boolean> {
  const settings = await Settings.findOne().select('subscription_mode').lean();
  return settings?.subscription_mode ?? false;
}

/**
 * Helper to get the active plan and its limits for a vendor
 * Caches the plan in the request object if provided
 */
export async function getVendorPlan(username: string, request?: FastifyRequest) {
  const normalizedUsername = username.toLowerCase();
  
  // Check if already cached in request
  if (request && (request as any).cached_vendor_plan) {
    return (request as any).cached_vendor_plan;
  }

  // When subscription mode is disabled, all vendors get elite access for free
  const subscriptionEnabled = await isSubscriptionModeEnabled();
  if (!subscriptionEnabled) {
    const vendorPlan = {
      plan: 'elite' as keyof typeof PLAN_PRIORITY,
      limits: PLAN_LIMITS.elite,
      priority: PLAN_PRIORITY.elite,
      normalizedUsername,
      subscription_mode_disabled: true
    };
    if (request) {
      (request as any).cached_vendor_plan = vendorPlan;
    }
    return vendorPlan;
  }

  // Find active subscription
  const now = new Date();
  const subscription = await VendorSubscription.findOne({
    vendor_username: normalizedUsername,
    status: 'active',
    $or: [
      { expires_at: null },
      { expires_at: { $gt: now } }
    ]
  });

  const plan = (subscription?.plan || 'free') as keyof typeof PLAN_PRIORITY;
  const vendorPlan = {
    plan,
    limits: PLAN_LIMITS[plan],
    priority: PLAN_PRIORITY[plan],
    normalizedUsername,
    subscription_mode_disabled: false
  };

  // Cache in request if provided
  if (request) {
    (request as any).cached_vendor_plan = vendorPlan;
  }

  return vendorPlan;
}

/**
 * Helper to send a subscription limit notification with cooldown
 */
async function sendLimitNotification(username: string, message: string, request: FastifyRequest) {
  try {
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
    const lastNotif = await Notification.findOne({
      recipient_username: username,
      type: 'subscription_limit',
      created_at: { $gt: new Date(Date.now() - cooldownPeriod) }
    });

    if (!lastNotif) {
      const notification = await Notification.create({
        recipient_username: username,
        type: 'subscription_limit',
        title: 'Subscription Limit Reached',
        body: message,
        link: '/MyStore?tab=subscription',
      });

      // Emit notification via socket
      const fastify = request.server as any;
      fastify.io?.to(`user:${username}`).emit('notification:new', notification);
      NotificationService.sendPushNotification(username, notification, fastify);
    }
  } catch (err) {
    request.log.error(err, 'Failed to create subscription limit notification:');
  }
}

/**
 * Middleware to check if a vendor can create more products
 */
export async function checkProductCountLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits, priority, normalizedUsername } = await getVendorPlan(user.username, request);
    (request as any).vendor_plan = plan;
    (request as any).vendor_priority = priority;

    // Count existing products (exclude archived)
    const productCount = await Product.countDocuments({
      vendor_username: normalizedUsername,
      status: { $ne: 'archived' }
    });

    if (productCount >= limits.products) {
      const limitDisplay = limits.products === Infinity ? 'unlimited' : limits.products;
      const message = `Your ${plan} plan allows up to ${limitDisplay} products. Please upgrade to add more.`;

      await sendLimitNotification(user.username, message, request);

      return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message,
        limit: limits.products,
        current: productCount
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor has too many media files in a product
 */
export async function checkProductMediaLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    // Check images/videos limit in body
    const body = request.body as any;
    if (!body) return; // No body, nothing to check

    const imagesCount = body.images?.length || 0;
    const videosCount = body.videos?.length || 0;
    const totalMedia = imagesCount + videosCount;
    
    // 1. Check if plan allows videos at all
    if (videosCount > 0 && limits.videos_per_product === 0) {
      const message = `Video uploads are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }

    // 2. Check independent video limit
    if (videosCount > limits.videos_per_product) {
      const limitDisplay = limits.videos_per_product === Infinity ? 'unlimited' : limits.videos_per_product;
      const message = `Your ${plan} plan allows up to ${limitDisplay} videos per product.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message,
        limit: limits.videos_per_product,
        current: videosCount
      });
    }

    // 3. Check independent image limit
    if (imagesCount > limits.images_per_product) {
      const limitDisplay = limits.images_per_product === Infinity ? 'unlimited' : limits.images_per_product;
      const message = `Your ${plan} plan allows up to ${limitDisplay} images per product.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message,
        limit: limits.images_per_product,
        current: imagesCount
      });
    }

    // 4. Check total media limit (if different from individual limits)
    if (totalMedia > (limits as any).media_per_product) {
       const limitDisplay = (limits as any).media_per_product === Infinity ? 'unlimited' : (limits as any).media_per_product;
       const message = `Your ${plan} plan allows up to ${limitDisplay} total media files per product.`;
       await sendLimitNotification(user.username, message, request);
       return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message,
        limit: (limits as any).media_per_product,
        current: totalMedia
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use custom domains
 */
export async function checkCustomDomainLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as any;
    // Only check if custom_domain is being set
    if (!body?.custom_domain) return;

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.custom_domain) {
      const message = `Custom domains are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use shipping zones
 */
export async function checkShippingZoneLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.shipping_zones) {
      const message = `Shipping zones are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use AI features
 */
export async function checkAiAccessLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.ai_features) {
      const message = `AI features are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can create live sessions
 */
export async function checkLiveSessionLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.live_sessions) {
      const message = `Live sessions are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can create coupons
 */
export async function checkCouponLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.coupons) {
      const message = `Coupons are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can access advanced analytics
 */
export async function checkAdvancedAnalyticsLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.advanced_analytics) {
      const message = `Advanced analytics are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use the affiliate program
 */
export async function checkAffiliateLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as any;
    // Only check if affiliate settings are present in the request body
    if (body?.affiliate_commission_pct === undefined && body?.affiliate_enabled === undefined) return;

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.affiliate_program) {
      const message = `The affiliate program is only available on the Elite plan. Please upgrade to Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use live chat
 */
export async function checkLiveChatLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username, request);

    if (!limits.live_chat) {
      const message = `Live chat features are not available on the ${plan} plan. Please upgrade to Pro or Elite.`;
      await sendLimitNotification(user.username, message, request);
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}
