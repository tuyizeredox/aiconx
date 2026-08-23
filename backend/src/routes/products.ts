import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { Follow } from '../models/Follow';
import { Notification } from '../models/Notification';
import { Store } from '../models/Store';
import { NotificationService } from '../services/notificationService';
import { checkProductCountLimit, checkProductMediaLimit, checkAdvancedAnalyticsLimit, checkAffiliateLimit } from '../middleware/subscription';
import { checkStoreVerified } from '../middleware/verification';
import { escapeRegex } from '../utils/sanitize';
import { deleteProductCascade } from '../services/cascadeService';
import { notifyRestockedBookings } from '../services/bookingService';

// Translates the marketplace's query-string filters into a Mongo filter.
// Shared by the product list and the facet counts so the two can never drift
// apart — a sidebar that says "Fashion (12)" must lead to those same 12.
// `omit` lets the facet endpoint drop the dimension it's counting.
function buildProductFilter(query: any, omit: { category?: boolean } = {}): any {
  const {
    category,
    status = 'active',
    vendor_username,
    vendor_plan,
    store_id,
    store_ids,
    search,
    affiliate_enabled,
    min_price,
    max_price,
    min_rating,
    in_stock,
    on_sale,
  } = query;

  const filter: any = {};

  if (status) filter.status = status;
  if (category && !omit.category) filter.category = category;
  if (vendor_username) filter.vendor_username = vendor_username;
  if (vendor_plan) filter.vendor_plan = vendor_plan;
  if (store_id) filter.store_id = store_id;
  // affiliate_enabled defaults to true on the schema, so treat missing field as enabled
  if (affiliate_enabled === 'true') filter.affiliate_enabled = { $ne: false };

  // Restrict to a set of stores — how the marketplace's "near me" filter
  // narrows products down to stores within the shopper's radius. An empty
  // list is honoured as "no stores matched" rather than ignored, so a
  // location with no nearby stores shows an empty state instead of
  // silently falling back to every product on the platform. Takes precedence
  // over a single store_id if a caller somehow sends both.
  if (store_ids !== undefined) {
    const ids = String(store_ids).split(',').map((s: string) => s.trim()).filter(Boolean);
    filter.store_id = { $in: ids };
  }

  const minPrice = parseFloat(min_price);
  const maxPrice = parseFloat(max_price);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.price = {};
    if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
  }

  const minRating = parseFloat(min_rating);
  if (Number.isFinite(minRating) && minRating > 0) {
    filter.rating_avg = { $gte: minRating };
  }

  if (in_stock === 'true') {
    filter.inventory_count = { $gt: 0 };
  }

  // Discounted items only: a compare-at price that's actually above the
  // current price (a leftover compare_at_price <= price isn't a deal).
  if (on_sale === 'true') {
    filter.compare_at_price = { $gt: 0 };
    filter.$expr = { $gt: ['$compare_at_price', '$price'] };
  }

  // Character-based incremental search: match products whose title (or
  // description/tags/category/store) contains the query as a substring, so
  // results appear as the user types rather than requiring a full word match.
  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { category: searchRegex },
      { store_name: searchRegex },
    ];
  }

  return filter;
}

export async function productRoutes(fastify: FastifyInstance) {
  // Get recommended products for the current user
  fastify.get('/recommendations', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 10 } = request.query as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      // Simplified: Get top-selling active products without heavy user interaction queries
      // This improves performance significantly for anonymous users and new users
      const recommendations = await Product.find({
        status: 'active',
      })
      .sort({ sales_count: -1, created_at: -1 })
      .limit(parseInt(limit))
      .select('title price compare_at_price images store_name store_id vendor_username rating_avg rating_count')
      .lean({ virtuals: true });

      return { data: recommendations };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // List products with filtering, sorting, and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const { sort = '-sales_count', limit = 50, skip = 0 } = query;

      const filter = buildProductFilter(query);

      // Build sort object
      const sortObj: any = { plan_priority: -1 };
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const products = await Product
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .select('title description price compare_at_price images category store_name store_id vendor_username vendor_plan rating_avg rating_count sales_count status inventory_count affiliate_enabled affiliate_commission_pct created_at')
        .lean();

      const total = await Product.countDocuments(filter);

      // Add virtual id field
      const data = products.map(p => ({ ...p, id: p._id.toString() }));

      return {
        data,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Facet counts for the marketplace filter sidebar: how many products each
  // category would return under the *rest* of the active filters, plus the
  // real price range of the current result set (so the price inputs can show
  // meaningful bounds instead of guessed ones). Accepts the same query params
  // as GET /products.
  fastify.get('/facets', async (request, reply) => {
    try {
      const query = request.query as any;
      // Category counts ignore the selected category — otherwise picking one
      // would zero out every other row and the user could never see what else
      // is available without clearing their choice first.
      const categoryFilter = buildProductFilter(query, { category: true });
      const activeFilter = buildProductFilter(query);

      const [categories, priceRange] = await Promise.all([
        Product.aggregate([
          { $match: categoryFilter },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Product.aggregate([
          { $match: activeFilter },
          { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
        ]),
      ]);

      return {
        categories: categories
          .filter((c: any) => c._id)
          .map((c: any) => ({ category: c._id, count: c.count })),
        price: {
          min: priceRange[0]?.min ?? 0,
          max: priceRange[0]?.max ?? 0,
        },
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Products genuinely bought in the same order as this one, most frequent
  // first. Falls back to the store's other best sellers once real co-purchases
  // run out, so a new product still shows a useful bundle instead of an empty
  // strip — `source` tells the client which it got, so the UI can label it
  // honestly rather than claiming a buying pattern that wasn't measured.
  fastify.get('/:id/bought-together', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit = 3 } = request.query as any;
      const want = Math.min(Math.max(parseInt(limit) || 3, 1), 8);

      const product = await Product.findById(id).lean();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      const coPurchased = await Order.aggregate([
        { $match: { 'items.product_id': id, payment_status: 'paid' } },
        { $unwind: '$items' },
        { $match: { 'items.product_id': { $ne: id } } },
        { $group: { _id: '$items.product_id', orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
        { $limit: want },
      ]);

      const coPurchasedIds = coPurchased
        .map((row: any) => row._id)
        .filter((pid: string) => mongoose.Types.ObjectId.isValid(pid));

      const select = 'title price compare_at_price images store_id store_name status inventory_count';

      let products = coPurchasedIds.length
        ? await Product.find({ _id: { $in: coPurchasedIds }, status: 'active' }).select(select).lean()
        : [];

      // Preserve the co-purchase ranking, which the $in query does not.
      products.sort((a, b) => coPurchasedIds.indexOf(String(a._id)) - coPurchasedIds.indexOf(String(b._id)));

      const source = products.length >= want ? 'orders' : products.length > 0 ? 'mixed' : 'store';

      if (products.length < want && product.store_id) {
        const exclude = [id, ...products.map(p => String(p._id))];
        const filler = await Product.find({
          store_id: product.store_id,
          status: 'active',
          _id: { $nin: exclude.filter(pid => mongoose.Types.ObjectId.isValid(pid)) },
        })
          .sort({ sales_count: -1, created_at: -1 })
          .limit(want - products.length)
          .select(select)
          .lean();
        products = [...products, ...filler];
      }

      return {
        data: products.map(p => ({ ...p, id: String(p._id) })),
        source,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Get product by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await Product.findById(id).lean({ virtuals: true });

      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      return product;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create product
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkStoreVerified, checkProductCountLimit, checkProductMediaLimit, checkAffiliateLimit],
  }, async (request, reply) => {
    try {
      const productData = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Invalid user session' });
      }

      const product = new Product({
        ...productData,
        vendor_username: user.username,
        vendor_plan: (request as any).vendor_plan || 'free',
        plan_priority: (request as any).vendor_priority || 0,
      });

      const savedProduct = await product.save();

      if (savedProduct.store_id) {
        await Store.findByIdAndUpdate(savedProduct.store_id, { $inc: { product_count: 1 } });
      }

      // Emit real-time event — target only store/vendor rooms, not all sockets
      const storeRoom = savedProduct.store_id ? `store:${savedProduct.store_id}` : `vendor:${user.username}`;
      fastify.io?.to(storeRoom).emit('product:created', savedProduct);

      // Notification logic for followers in background
      (async () => {
        try {
          const vendorName = user.display_name || user.username;
          let storeName = '';
          
          if (savedProduct.store_id) {
            const store = await Store.findById(savedProduct.store_id);
            if (store) storeName = store.name;
          }

// Find unique followers of the vendor (user follow) or the store (store follow)
           const followers = await Follow.find({
             $or: [
               { following_username: user.username, follow_type: 'user' },
               ...(savedProduct.store_id ? [{ target_id: savedProduct.store_id.toString(), follow_type: 'store' }] : [])
             ]
           }).select('follower_username');

           const uniqueFollowerUsernames: string[] = [...new Set(followers.map((f: any) => f.follower_username))];

          // Exclude the vendor themselves if they somehow follow themselves
          const recipientUsernames = uniqueFollowerUsernames.filter(username => username !== user.username);

          if (recipientUsernames.length > 0) {
            const title = storeName 
              ? `${storeName} added a new product: ${savedProduct.title}`
              : `${vendorName} added a new product: ${savedProduct.title}`;
            
            const body = savedProduct.description 
              ? (savedProduct.description.length > 100 ? savedProduct.description.substring(0, 97) + '...' : savedProduct.description)
              : `Check out our latest addition: ${savedProduct.title}`;

            const notifications = recipientUsernames.map(followerUsername => ({
              recipient_username: followerUsername,
              type: 'product_added',
              title,
              body,
              link: `/ProductDetail?id=${savedProduct._id}`,
              sender_username: user.username,
              sender_name: vendorName,
              metadata: {
                product_id: savedProduct._id,
                store_id: savedProduct.store_id
              }
            }));

            const savedNotifications = await Notification.insertMany(notifications);
            
            // Emit via socket to each follower
            const io = fastify.io;
            if (io) {
              savedNotifications.forEach(notif => {
                io.to(`user:${notif.recipient_username}`).emit('notification:new', notif);
              });
            }

            // Send push notifications (native)
            await NotificationService.sendBulkPushNotifications(recipientUsernames, {
              title,
              body,
              type: 'product_added',
              link: `/ProductDetail?id=${savedProduct._id}`,
              metadata: { product_id: savedProduct._id }
            }, fastify);
          }
        } catch (error) {
          fastify.log.error(error, 'Error creating product added notifications');
        }
      })();

      return reply.code(201).send(savedProduct);
    } catch (error: any) {
      fastify.log.error(error);
      
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const details = Object.entries(error.errors).map(([path, e]: [string, any]) => ({
          path: [path],
          message: e.message
        }));
        return reply.code(400).send({ 
          error: 'Validation Error', 
          details 
        });
      }

      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Update product
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, checkProductMediaLimit, checkAffiliateLimit],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { vendor_plan, plan_priority, vendor_username, store_id, _id, ...safeUpdate } = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      if (safeUpdate.inventory_count !== undefined) {
        const count = Number(safeUpdate.inventory_count);
        if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
          return reply.code(400).send({ error: 'inventory_count must be a non-negative integer' });
        }
        safeUpdate.inventory_count = count;
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, vendor_username: user.username },
        { ...safeUpdate, updated_at: new Date() },
        { new: true, runValidators: true }
      );

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Emit real-time event — target store/vendor room only
      const updatedStoreRoom = product.store_id ? `store:${product.store_id}` : `vendor:${user.username}`;
      fastify.io?.to(updatedStoreRoom).emit('product:updated', product);

      // A vendor restocking is the main way a booked product becomes buyable
      // again. Not awaited: the vendor's save shouldn't wait on a fan-out of
      // notifications, and the service swallows its own errors.
      if (safeUpdate.inventory_count !== undefined || safeUpdate.status !== undefined) {
        void notifyRestockedBookings(String(product._id), fastify);
      }

      return product;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete product
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const product = await Product.findOne({
        _id: id,
        vendor_username: user.username
      });

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Cascades to cart/wishlist entries, reviews, affiliate links, sentiment
      // summaries, likes/bookmarks, uploaded media, and decrements the store's
      // product_count.
      await deleteProductCascade(product);

      // Emit real-time event — target store/vendor room only
      const deletedStoreRoom = product.store_id ? `store:${product.store_id}` : `vendor:${user.username}`;
      fastify.io?.to(deletedStoreRoom).emit('product:deleted', { id });

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Track product view
  fastify.post('/:id/view', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { views_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track product click
  fastify.post('/:id/click', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { clicks_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track add to cart
  fastify.post('/:id/add-to-cart', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { add_to_cart_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track checkout start
  fastify.post('/:id/checkout-start', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { checkout_start_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get product statistics (Advanced Analytics)
  fastify.get('/stats', {
    preHandler: [fastify.authenticate, checkAdvancedAnalyticsLimit],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { store_id } = request.query as any;

      const filter: any = { vendor_username: user.username };
      if (store_id) filter.store_id = store_id;

      const products = await Product.find(filter)
        .select('title views_count clicks_count add_to_cart_count checkout_start_count sales_count price')
        .lean();

      const totalStats = products.reduce((acc, p) => {
        acc.views += (p.views_count || 0);
        acc.clicks += (p.clicks_count || 0);
        acc.add_to_cart += (p.add_to_cart_count || 0);
        acc.sales += (p.sales_count || 0);
        acc.revenue += ((p.sales_count || 0) * (p.price || 0));
        return acc;
      }, { views: 0, clicks: 0, add_to_cart: 0, sales: 0, revenue: 0 });

      return {
        summary: totalStats,
        products: products.map(p => ({
          ...p,
          ctr: p.views_count ? ((p.clicks_count / p.views_count) * 100).toFixed(2) : 0,
          conversion_rate: p.clicks_count ? ((p.sales_count / p.clicks_count) * 100).toFixed(2) : 0
        }))
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
