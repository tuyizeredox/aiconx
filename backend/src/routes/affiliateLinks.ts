import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { AffiliateLink, IAffiliateLink } from '../models/AffiliateLink';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { getVendorPlan } from '../middleware/subscription';

export async function affiliateLinkRoutes(fastify: FastifyInstance) {
  // List affiliate links with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        influencer_username,
        store_id,
        product_id,
        status = 'active',
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (influencer_username) filter.influencer_username = influencer_username;
      if (store_id) filter.store_id = store_id;
      if (product_id) filter.product_id = product_id;
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const links = await AffiliateLink
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // product_id and store_id are strings, so we can't use .populate()
      // If we need product/store info, we would need to fetch it separately.

      const total = await AffiliateLink.countDocuments(filter);

      return reply.send({
        links,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get affiliate leaderboard — aggregate paid orders this month by affiliate
  fastify.get('/leaderboard', async (request, reply) => {
    try {
      const query = request.query as any;
      const { period = 'month', limit = 10, username } = query;

      const now = new Date();
      const matchStage: any = {
        affiliate_username: { $exists: true, $nin: [null, ''] },
        payment_status: 'paid',
      };

      if (period === 'month') {
        matchStage.created_at = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      } else if (period === 'week') {
        matchStage.created_at = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      }
      // period === 'all' (or any unrecognized value): no date filter, aggregate across all time

      const raw = await Order.aggregate([
        { $match: matchStage },
        { $group: {
          _id: '$affiliate_username',
          total_earned: { $sum: '$affiliate_commission' },
          total_sales: { $sum: 1 },
        }},
        { $sort: { total_earned: -1 } },
        { $limit: parseInt(limit) + 20 },
      ]);

      const usernames = raw.map((l: any) => l._id);
      const users = await User.find({ username: { $in: usernames } }, { username: 1, display_name: 1, avatar_url: 1 });
      const userMap = new Map(users.map(u => [u.username, u]));

      const enriched = raw.map((item: any, index: number) => {
        const u = userMap.get(item._id) as any;
        return {
          rank: index + 1,
          username: item._id,
          name: u?.display_name || item._id,
          avatar_url: u?.avatar_url || null,
          total_earned: item.total_earned,
          total_sales: item.total_sales,
        };
      });

      let my_rank: number | null = null;
      if (username) {
        const mine = enriched.find((e: any) => e.username === username);
        if (mine) {
          my_rank = mine.rank;
        } else {
          const myStats = await Order.aggregate([
            { $match: { ...matchStage, affiliate_username: username } },
            { $group: { _id: null, total_earned: { $sum: '$affiliate_commission' } } },
          ]);
          if (myStats.length > 0) {
            const myEarned = myStats[0].total_earned;
            const aheadResult = await Order.aggregate([
              { $match: matchStage },
              { $group: { _id: '$affiliate_username', total_earned: { $sum: '$affiliate_commission' } } },
              { $match: { total_earned: { $gt: myEarned } } },
              { $count: 'ahead' },
            ]);
            my_rank = (aheadResult[0]?.ahead || 0) + 1;
          }
        }
      }

      return reply.send({
        leaderboard: enriched.slice(0, parseInt(limit)),
        my_rank,
        period,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Get affiliate link by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      return reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get affiliate link by ref code
  fastify.get('/ref/:refCode', async (request, reply) => {
    try {
      const { refCode } = request.params as { refCode: string };

      const link = await AffiliateLink.findOne({
        ref_code: refCode.toUpperCase(),
        status: 'active'
      });

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found or inactive' });
      }

      return reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create affiliate link
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IAffiliateLink>;
      const user = request.user as any;

      // Validate required fields
      if (!body.product_id) {
        return reply.code(400).send({ error: 'Missing required field: product_id' });
      }

      // Check if product exists
      const product = await Product.findById(body.product_id);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      // Check if the vendor has disabled affiliate marketing for this specific product
      if (product.affiliate_enabled === false) {
        return reply.code(403).send({
          error: 'Affiliate marketing disabled',
          message: 'The vendor has disabled affiliate marketing for this product.'
        });
      }

      // Check if vendor has affiliate program enabled in their plan
      // This respects subscription_mode - when disabled, all vendors get elite access
      const vendorPlan = await getVendorPlan(product.vendor_username, request);

      if (!vendorPlan.limits?.affiliate_program) {
        return reply.code(403).send({
          error: 'Affiliate program restricted',
          message: `The store owner (${product.vendor_username}) is on the ${vendorPlan.plan.toUpperCase()} plan which does not support affiliate links. Only Elite stores can have affiliate programs.`
        });
      }

      // If the user requested a specific ref code, pre-check it (the unique
      // index on the schema is still the real guarantee — see the save-retry
      // loop below, which covers a concurrent request winning the race).
      const requestedRefCode = body.ref_code?.toUpperCase();
      if (requestedRefCode) {
        const existingLink = await AffiliateLink.findOne({ ref_code: requestedRefCode });
        if (existingLink) {
          return reply.code(400).send({ error: 'Referral code already in use' });
        }
      }

      // Generate (or use the requested) ref code and save, retrying on a
      // duplicate-key error in case a concurrent request claimed the same
      // generated code between the pre-check above and this save.
      const MAX_SAVE_ATTEMPTS = 5;
      let link: IAffiliateLink | undefined;
      for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
        const refCode = requestedRefCode || generateRefCode();
        const candidate = new AffiliateLink({
          influencer_email: user.email,
          influencer_username: user.username,
          influencer_name: user.display_name || user.username,
          store_id: product.store_id,
          store_name: product.store_name,
          product_id: product._id,
          product_title: product.title,
          product_price: product.price,
          product_image: product.images?.[0],
          ref_code: refCode,
          // Commission rate is set by the seller on the product, not by the
          // affiliate creating the link — never trust body.commission_pct here.
          commission_pct: product.affiliate_commission_pct,
          status: 'active',
        });

        try {
          await candidate.save();
          link = candidate;
          break;
        } catch (saveError: any) {
          const isDuplicateRefCode = saveError?.code === 11000 && saveError?.keyPattern?.ref_code;
          if (!isDuplicateRefCode) throw saveError;
          if (requestedRefCode) {
            return reply.code(400).send({ error: 'Referral code already in use' });
          }
          // Generated code collided — loop and try another generated code.
        }
      }

      if (!link) {
        return reply.code(500).send({ error: 'Failed to generate a unique referral code. Please try again.' });
      }

      return reply.code(201).send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update affiliate link
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IAffiliateLink>;
      const user = request.user as any;

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      // Check if user owns the link
      if (link.influencer_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own affiliate links' });
      }

      // Prevent updating ref_code
      if (body.ref_code && body.ref_code !== link.ref_code) {
        return reply.code(400).send({ error: 'Cannot change referral code' });
      }

      // Update allowed fields. commission_pct is intentionally excluded —
      // it's set by the seller on the product at link-creation time, not
      // editable by the affiliate afterward.
      const allowedUpdates = ['status'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IAffiliateLink;
        if (body[key] !== undefined) {
          (link as any)[key] = body[key];
        }
      });

      await link.save();

      return reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete affiliate link
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      // Check if user owns the link
      if (link.influencer_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own affiliate links' });
      }

      await AffiliateLink.findByIdAndDelete(id);

      return reply.send({ message: 'Affiliate link deleted successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Track click on affiliate link
  fastify.post('/ref/:refCode/click', async (request, reply) => {
    try {
      const { refCode } = request.params as { refCode: string };

      const link = await AffiliateLink.findOneAndUpdate(
        { ref_code: refCode.toUpperCase(), status: 'active' },
        { $inc: { clicks: 1 } },
        { new: true }
      );

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found or inactive' });
      }

      return reply.send({
        message: 'Click tracked successfully',
        clicks: link.clicks
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get influencer's affiliate links
  fastify.get('/influencer/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { status, limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = { influencer_username: user.username };
      if (status) filter.status = status;

      const links = await AffiliateLink
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // Links only store a snapshot of the product, and product_image was added
      // after some links were created — resolve the current product so the
      // affiliate always sees an up-to-date image/title/price for each link.
      const productIds = links
        .map(l => l.product_id)
        .filter(id => mongoose.Types.ObjectId.isValid(id));
      const products = productIds.length
        ? await Product.find({ _id: { $in: productIds } }, { title: 1, price: 1, images: 1, store_name: 1 })
        : [];
      const productMap = new Map(products.map(p => [String(p._id), p]));

      const enrichedLinks = links.map(link => {
        const product = productMap.get(String(link.product_id)) as any;
        return {
          ...link.toObject(),
          product_title: product?.title || link.product_title,
          product_price: product?.price ?? link.product_price,
          product_image: product?.images?.[0] || link.product_image || null,
          store_name: product?.store_name || link.store_name,
        };
      });

      const total = await AffiliateLink.countDocuments(filter);

      // Calculate totals
      const stats = await AffiliateLink.aggregate([
        { $match: { influencer_username: user.username } },
        {
          $group: {
            _id: null,
            total_clicks: { $sum: '$clicks' },
            total_conversions: { $sum: '$conversions' },
            total_earned: { $sum: '$total_commission_earned' },
            total_paid: { $sum: '$commission_paid' }
          }
        }
      ]);

      return reply.send({
        links: enrichedLinks,
        stats: stats[0] || {
          total_clicks: 0,
          total_conversions: 0,
          total_earned: 0,
          total_paid: 0
        },
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Whether the caller could earn on this product, and how much.
  //
  // Separate from creating a link because the answer is needed *before* anyone
  // commits to anything: it's what the "Earn X per sale" line on a product
  // reads. Deliberately cheap and safe to call for signed-out visitors, who
  // get the amount without the link.
  fastify.get('/product/:productId/eligibility', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return reply.code(400).send({ error: 'Invalid product id' });
      }

      const product = await Product.findById(productId).lean();
      if (!product) return reply.code(404).send({ error: 'Product not found' });

      const eligibility = await resolveAffiliateEligibility(product, request);
      const user = request.user as any;

      // An existing link is surfaced here so the product page can show "your
      // link" without a second round trip — and without creating one for
      // someone who is only browsing.
      let existing = null;
      if (user?.username) {
        existing = await AffiliateLink.findOne({
          influencer_username: user.username,
          product_id: String(product._id),
          status: 'active',
        }).lean();
      }

      return reply.send({
        ...eligibility,
        ref_code: existing?.ref_code || null,
        clicks: existing?.clicks ?? 0,
        conversions: existing?.conversions ?? 0,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get *or create* the caller's affiliate link for a product.
  //
  // This is what makes sharing earn money without anyone opting into an
  // "affiliate programme": pressing Share calls this, gets a ref code back and
  // shares that URL. It has to be idempotent — a shopper who shares the same
  // product to four chats must end up with one link and four clicks on it, not
  // four links splitting their own stats.
  fastify.post('/product/:productId/my-link', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const user = request.user as any;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return reply.code(400).send({ error: 'Invalid product id' });
      }

      const product = await Product.findById(productId).lean();
      if (!product) return reply.code(404).send({ error: 'Product not found' });

      // A vendor sharing their own product is just sharing it. Paying someone
      // commission on their own sale would be a round trip through the payouts
      // system to end up where the money already was.
      if (product.vendor_username === user.username) {
        return reply.send({ ...(await resolveAffiliateEligibility(product, request)), eligible: false, reason: 'own_product', link: null });
      }

      const existing = await AffiliateLink.findOne({
        influencer_username: user.username,
        product_id: String(product._id),
        status: 'active',
      });
      if (existing) {
        return reply.send({
          link: existing,
          ref_code: existing.ref_code,
          commission_pct: existing.commission_pct,
          earn_per_sale: Math.round((product.price * existing.commission_pct) / 100),
          created: false,
          eligible: true,
        });
      }

      const eligibility = await resolveAffiliateEligibility(product, request);
      if (!eligibility.eligible) {
        return reply.code(403).send({ ...eligibility, link: null });
      }

      const MAX_SAVE_ATTEMPTS = 5;
      let link: IAffiliateLink | undefined;
      for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
        const candidate = new AffiliateLink({
          influencer_email: user.email,
          influencer_username: user.username,
          influencer_name: user.display_name || user.username,
          store_id: product.store_id,
          store_name: product.store_name,
          product_id: String(product._id),
          product_title: product.title,
          product_price: product.price,
          product_image: product.images?.[0],
          ref_code: generateRefCode(),
          // The seller sets the rate on the product; never accept it from the
          // client, which is why this route takes no body at all.
          commission_pct: product.affiliate_commission_pct,
          status: 'active',
        });

        try {
          await candidate.save();
          link = candidate;
          break;
        } catch (saveError: any) {
          const isDuplicateRefCode = saveError?.code === 11000 && saveError?.keyPattern?.ref_code;
          if (isDuplicateRefCode) continue; // collided, draw another code

          // Two shares fired at once: the other request created the link, so
          // return that one rather than failing the share.
          const raced = await AffiliateLink.findOne({
            influencer_username: user.username,
            product_id: String(product._id),
            status: 'active',
          });
          if (raced) {
            return reply.send({
              link: raced,
              ref_code: raced.ref_code,
              commission_pct: raced.commission_pct,
              earn_per_sale: Math.round((product.price * raced.commission_pct) / 100),
              created: false,
              eligible: true,
            });
          }
          throw saveError;
        }
      }

      if (!link) {
        return reply.code(500).send({ error: 'Failed to generate a unique referral code. Please try again.' });
      }

      return reply.code(201).send({
        link,
        ref_code: link.ref_code,
        commission_pct: link.commission_pct,
        earn_per_sale: Math.round((product.price * link.commission_pct) / 100),
        created: true,
        eligible: true,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Get affiliate links for a product
  fastify.get('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const query = request.query as any;
      const { status = 'active', limit = 10, skip = 0 } = query;

      const filter: any = { product_id: productId, status };

      const links = await AffiliateLink
        .find(filter)
        .sort({ clicks: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // influencer_email is a string, so we can't use .populate()
      // If we need influencer info, we would need to fetch it separately by email.

      const total = await AffiliateLink.countDocuments(filter);

      return reply.send({
        links,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}

/**
 * Can anyone earn commission on this product, and how much per sale?
 *
 * One place for the rule, because it is asked in three different situations:
 * before showing an amount, before minting a link, and when a share fires.
 * `reason` exists so the UI can stay quiet about a product nobody can earn on
 * rather than showing a disabled control nobody can act on.
 */
async function resolveAffiliateEligibility(product: any, request: any) {
  const commission_pct = product.affiliate_commission_pct ?? 0;
  const earn_per_sale = Math.round((product.price * commission_pct) / 100);
  const base = { commission_pct, earn_per_sale, currency: product.currency || 'RWF' };

  if (product.affiliate_enabled === false) {
    return { ...base, eligible: false, reason: 'disabled_by_vendor' };
  }
  if (commission_pct <= 0) {
    return { ...base, eligible: false, reason: 'no_commission' };
  }
  if (product.status !== 'active') {
    return { ...base, eligible: false, reason: 'product_unavailable' };
  }

  const vendorPlan = await getVendorPlan(product.vendor_username, request);
  if (!vendorPlan.limits?.affiliate_program) {
    return { ...base, eligible: false, reason: 'vendor_plan' };
  }

  return { ...base, eligible: true, reason: null };
}

// Helper function to generate unique referral code
function generateRefCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}