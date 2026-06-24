import { FastifyInstance } from 'fastify';
import { StoreReview, IStoreReview } from '../models/StoreReview';
import { User } from '../models/User';

export async function storeReviewRoutes(fastify: FastifyInstance) {
  // Get reviews for a store
  fastify.get('/store/:storeId', async (request, reply) => {
    try {
      const { storeId } = request.params as { storeId: string };
      const query = request.query as any;
      const {
        rating,
        is_verified_purchase,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = { store_id: storeId };

      if (rating) filter.rating = parseInt(rating);
      if (is_verified_purchase !== undefined) filter.is_verified_purchase = is_verified_purchase === 'true';

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const reviews = await StoreReview
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await StoreReview.countDocuments(filter);

      // Calculate average rating
      const stats = await StoreReview.aggregate([
        { $match: { store_id: storeId } },
        {
          $group: {
            _id: null,
            average_rating: { $avg: '$rating' },
            total_reviews: { $sum: 1 },
            rating_distribution: {
              $push: '$rating'
            }
          }
        }
      ]);

      const ratingStats = stats[0] || { average_rating: 0, total_reviews: 0, rating_distribution: [] };

      // Calculate rating distribution
      const distribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: ratingStats.rating_distribution.filter((r: number) => r === rating).length
      }));

      reply.send({
        reviews,
        stats: {
          average_rating: Math.round(ratingStats.average_rating * 10) / 10,
          total_reviews: ratingStats.total_reviews,
          rating_distribution: distribution
        },
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get reviews by reviewer
  fastify.get('/reviewer/:reviewerUsername', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { reviewerUsername } = request.params as { reviewerUsername: string };
      const user = request.user as any;

      // Check if user is requesting their own reviews
      if (user.username !== reviewerUsername.toLowerCase()) {
        return reply.code(403).send({ error: 'You can only view your own reviews' });
      }

      const reviews = await StoreReview
        .find({ reviewer_username: reviewerUsername.toLowerCase() })
        .sort({ created_at: -1 });

      reply.send({ reviews });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List store reviews with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        store_id,
        vendor_username,
        reviewer_username,
        rating,
        is_verified_purchase,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (store_id) filter.store_id = store_id;
      if (vendor_username) filter.vendor_username = vendor_username.toLowerCase();
      if (reviewer_username) filter.reviewer_username = reviewer_username.toLowerCase();
      if (rating) filter.rating = parseInt(rating);
      if (is_verified_purchase !== undefined) filter.is_verified_purchase = is_verified_purchase === 'true';

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const reviews = await StoreReview
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await StoreReview.countDocuments(filter);

      reply.send({
        reviews,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store review by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const review = await StoreReview.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Store review not found' });
      }

      reply.send(review);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create store review
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IStoreReview>;
      const user = request.user as any;

      // Validate required fields
      if (!body.store_id) {
        return reply.code(400).send({ error: 'Missing required field: store_id' });
      }

      if (body.rating === undefined) {
        return reply.code(400).send({ error: 'Missing required field: rating' });
      }

      if (!body.content) {
        return reply.code(400).send({ error: 'Missing required field: content' });
      }

      // Validate rating
      if (body.rating < 1 || body.rating > 5) {
        return reply.code(400).send({ error: 'Rating must be between 1 and 5' });
      }

      // Fetch full user data to get display_name
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      // Set reviewer info from authenticated user
      body.reviewer_username = user.username;
      body.reviewer_name = userData.display_name || user.username;

      const review = new StoreReview(body);
      await review.save();

      reply.code(201).send(review);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        reply.code(409).send({ error: 'You have already reviewed this store' });
      } else {
        fastify.log.error(error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Update store review
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IStoreReview>;
      const user = request.user as any;

      const review = await StoreReview.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Store review not found' });
      }

      // Check if user owns the review
      if (review.reviewer_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own reviews' });
      }

      // Update allowed fields
      const allowedUpdates = ['rating', 'title', 'content'];

      allowedUpdates.forEach(field => {
        const key = field as keyof IStoreReview;
        if (body[key] !== undefined) {
          (review as any)[key] = body[key];
        }
      });

      // Validate rating if being updated
      if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
        return reply.code(400).send({ error: 'Rating must be between 1 and 5' });
      }

      await review.save();

      reply.send(review);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Vendor reply to review
  fastify.post('/:id/reply', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reply: vendorReply } = request.body as { reply: string };
      const user = request.user as any;

      if (!vendorReply || vendorReply.trim().length === 0) {
        return reply.code(400).send({ error: 'Reply content is required' });
      }

      const review = await StoreReview.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Store review not found' });
      }

      // Check if user is the vendor
      if (review.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'Only the store vendor can reply to reviews' });
      }

      review.vendor_reply = vendorReply.trim();
      review.vendor_replied_at = new Date();
      await review.save();

      reply.send(review);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Mark review as helpful
  fastify.post('/:id/helpful', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const review = await StoreReview.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Store review not found' });
      }

      // Increment helpful count
      review.helpful_count += 1;
      await review.save();

      // TODO: Track who marked it helpful to prevent multiple votes from same user

      reply.send({ helpful_count: review.helpful_count });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete store review
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const review = await StoreReview.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Store review not found' });
      }

      // Check if user owns the review or is the vendor
      if (review.reviewer_username !== user.username && review.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own reviews or reviews for your store' });
      }

      await StoreReview.findByIdAndDelete(id);

      reply.send({ message: 'Store review deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store review statistics
  fastify.get('/stats/:storeId', async (request, reply) => {
    try {
      const { storeId } = request.params as { storeId: string };

      const stats = await StoreReview.aggregate([
        { $match: { store_id: storeId } },
        {
          $group: {
            _id: null,
            average_rating: { $avg: '$rating' },
            total_reviews: { $sum: 1 },
            verified_reviews: { $sum: { $cond: ['$is_verified_purchase', 1, 0] } },
            rating_1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            rating_2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            rating_3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            rating_4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            rating_5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
          }
        }
      ]);

      const result = stats[0] || {
        average_rating: 0,
        total_reviews: 0,
        verified_reviews: 0,
        rating_1: 0,
        rating_2: 0,
        rating_3: 0,
        rating_4: 0,
        rating_5: 0
      };

      reply.send({
        store_id: storeId,
        average_rating: Math.round(result.average_rating * 10) / 10,
        total_reviews: result.total_reviews,
        verified_reviews: result.verified_reviews,
        rating_distribution: {
          1: result.rating_1,
          2: result.rating_2,
          3: result.rating_3,
          4: result.rating_4,
          5: result.rating_5
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}