import { FastifyInstance } from 'fastify';
import { WishlistItem, IWishlistItem } from '../models/WishlistItem';
import { User } from '../models/User';

export async function wishlistRoutes(fastify: FastifyInstance) {
  // Get user's wishlist
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const query = request.query as any;
      const {
        store_id,
        sort = '-created_at',
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = { user_username: user.username };
      if (store_id) filter.store_id = store_id;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const wishlist = await WishlistItem
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await WishlistItem.countDocuments(filter);

      reply.send({
        items: wishlist,
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

  // Check if product is in user's wishlist
  fastify.get('/check/:productId', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const user = request.user as any;

      const item = await WishlistItem.findOne({
        user_username: user.username,
        product_id: productId
      });

      reply.send({
        product_id: productId,
        in_wishlist: !!item,
        item: item || null
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Add product to wishlist
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IWishlistItem>;
      const user = request.user as any;

      // Validate required fields
      if (!body.product_id) {
        return reply.code(400).send({ error: 'Missing required field: product_id' });
      }

      if (!body.product_title) {
        return reply.code(400).send({ error: 'Missing required field: product_title' });
      }

      if (body.product_price === undefined) {
        return reply.code(400).send({ error: 'Missing required field: product_price' });
      }

      if (!body.store_id) {
        return reply.code(400).send({ error: 'Missing required field: store_id' });
      }

      if (!body.store_name) {
        return reply.code(400).send({ error: 'Missing required field: store_name' });
      }

      if (!body.vendor_username) {
        return reply.code(400).send({ error: 'Missing required field: vendor_username' });
      }

      // Set usernames
      body.user_username = user.username;

      const wishlistItem = new WishlistItem(body);
      await wishlistItem.save();

      reply.code(201).send(wishlistItem);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        reply.code(409).send({ error: 'Product is already in your wishlist' });
      } else {
        fastify.log.error(error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Remove product from wishlist
  fastify.delete('/:productId', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const user = request.user as any;

      const result = await WishlistItem.findOneAndDelete({
        user_username: user.username,
        product_id: productId
      });

      if (!result) {
        return reply.code(404).send({ error: 'Product not found in wishlist' });
      }

      reply.send({ message: 'Product removed from wishlist successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update wishlist item (for when product details change)
  fastify.put('/:productId', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const body = request.body as Partial<IWishlistItem>;
      const user = request.user as any;

      const item = await WishlistItem.findOne({
        user_username: user.username,
        product_id: productId
      });

      if (!item) {
        return reply.code(404).send({ error: 'Product not found in wishlist' });
      }

      // Update allowed fields
      const allowedUpdates = [
        'product_title',
        'product_image',
        'product_price',
        'compare_at_price',
        'store_name'
      ];

      allowedUpdates.forEach(field => {
        const key = field as keyof IWishlistItem;
        if (body[key] !== undefined) {
          (item as any)[key] = body[key];
        }
      });

      await item.save();

      reply.send(item);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get wishlist statistics for user
  fastify.get('/stats', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const stats = await WishlistItem.aggregate([
        { $match: { user_username: user.username } },
        {
          $group: {
            _id: null,
            total_items: { $sum: 1 },
            total_value: { $sum: '$product_price' },
            stores_count: { $addToSet: '$store_id' },
            avg_price: { $avg: '$product_price' }
          }
        }
      ]);

      const storeBreakdown = await WishlistItem.aggregate([
        { $match: { user_username: user.username } },
        {
          $group: {
            _id: '$store_id',
            store_name: { $first: '$store_name' },
            item_count: { $sum: 1 },
            total_value: { $sum: '$product_price' }
          }
        },
        { $sort: { item_count: -1 } }
      ]);

      const result = stats[0] || {
        total_items: 0,
        total_value: 0,
        stores_count: [],
        avg_price: 0
      };

      reply.send({
        total_items: result.total_items,
        total_value: Math.round(result.total_value * 100) / 100,
        stores_count: result.stores_count.length,
        avg_price: Math.round(result.avg_price * 100) / 100,
        store_breakdown: storeBreakdown
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Bulk add products to wishlist
  fastify.post('/bulk', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { items } = request.body as { items: Partial<IWishlistItem>[] };
      const user = request.user as any;

      if (!Array.isArray(items)) {
        return reply.code(400).send({ error: 'items must be an array' });
      }

      if (items.length === 0) {
        return reply.code(400).send({ error: 'items array cannot be empty' });
      }

      if (items.length > 50) {
        return reply.code(400).send({ error: 'Cannot add more than 50 items at once' });
      }

      const results = [];
      const errors = [];

      for (const itemData of items) {
        try {
          // Validate required fields
          if (!itemData.product_id || !itemData.product_title || itemData.product_price === undefined ||
              !itemData.store_id || !itemData.store_name || !itemData.vendor_username) {
            errors.push({ product_id: itemData.product_id, error: 'Missing required fields' });
            continue;
          }

          const wishlistItem = new WishlistItem({
            ...itemData,
            user_username: user.username
          });

          await wishlistItem.save();
          results.push(wishlistItem);
        } catch (error) {
          errors.push({ product_id: itemData.product_id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      reply.send({
        message: 'Bulk operation completed',
        added: results.length,
        errors_count: errors.length,
        results,
        errors
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Clear entire wishlist
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const result = await WishlistItem.deleteMany({ user_username: user.username });

      reply.send({
        message: 'Wishlist cleared successfully',
        deleted_count: result.deletedCount
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get popular wishlist items (analytics endpoint)
  fastify.get('/popular/items', async (request, reply) => {
    try {
      const query = request.query as any;
      const { limit = 20 } = query;

      const popular = await WishlistItem.aggregate([
        {
          $group: {
            _id: '$product_id',
            product_title: { $first: '$product_title' },
            product_image: { $first: '$product_image' },
            product_price: { $first: '$product_price' },
            store_id: { $first: '$store_id' },
            store_name: { $first: '$store_name' },
            vendor_username: { $first: '$vendor_username' },
            wishlist_count: { $sum: 1 }
          }
        },
        { $sort: { wishlist_count: -1 } },
        { $limit: parseInt(limit) }
      ]);

      reply.send({ popular_items: popular });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}