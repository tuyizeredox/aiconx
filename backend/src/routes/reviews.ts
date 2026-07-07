import { FastifyInstance } from 'fastify';
import { Review, IReview } from '../models/Review';
import { User } from '../models/User';
import { likeTarget } from '../services/likeService';

export async function reviewRoutes(fastify: FastifyInstance) {
  // List reviews with filtering, sorting, and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        product_id,
        store_id,
        reviewer_username,
        rating,
        is_verified_purchase,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (product_id) filter.product_id = product_id;
      if (store_id) filter.store_id = store_id;
      if (reviewer_username) filter.reviewer_username = reviewer_username;
      if (rating) filter.rating = parseInt(rating);
      if (is_verified_purchase !== undefined) filter.is_verified_purchase = is_verified_purchase === 'true';

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const reviews = await Review
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // product_id and store_id are strings, so we can't use .populate()
      // If we need product/store info, we would need to fetch them separately
      // but the model should probably have used ObjectIds if populate was intended.

      const total = await Review.countDocuments(filter);

      return reply.send({
        data: reviews,
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

  // Get review by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const review = await Review.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Review not found' });
      }

      return reply.send(review);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create review
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IReview>;
      const user = request.user as any;

      // Validate required fields
      if (!body.product_id || !body.rating || !body.content) {
        return reply.code(400).send({ error: 'Missing required fields: product_id, rating, content' });
      }

      if (body.rating < 1 || body.rating > 5) {
        return reply.code(400).send({ error: 'Rating must be between 1 and 5' });
      }

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({
        product_id: body.product_id,
        reviewer_username: user.username
      });

      if (existingReview) {
        return reply.code(409).send({ error: 'You have already reviewed this product' });
      }

      // Fetch full user data to get display_name
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      const review = new Review({
        ...body,
        reviewer_username: user.username,
        reviewer_name: userData.display_name || user.username,
        is_verified_purchase: false // TODO: Implement purchase verification logic
      });

      await review.save();

      // Emit real-time event
      fastify.io?.emit('review:created', {
        review: review.toObject(),
        product_id: body.product_id
      });

      return reply.code(201).send(review);
    } catch (error: any) {
      fastify.log.error(error);
      
      if (error.name === 'ValidationError') {
        return reply.code(400).send({ 
          error: 'Validation Error', 
          details: Object.entries(error.errors).map(([path, e]: [string, any]) => ({
            path: [path],
            message: e.message
          }))
        });
      }

      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Update review
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IReview>;
      const user = request.user as any;

      const review = await Review.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Review not found' });
      }

      // Check if user owns the review
      if (review.reviewer_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own reviews' });
      }

      // Update allowed fields
      const allowedUpdates = ['rating', 'title', 'content', 'media_urls'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IReview;
        if (body[key] !== undefined) {
          (review as any)[key] = body[key];
        }
      });

      if (body.rating && (body.rating < 1 || body.rating > 5)) {
        return reply.code(400).send({ error: 'Rating must be between 1 and 5' });
      }

      await review.save();

      // Emit real-time event
      fastify.io?.emit('review:updated', {
        review: review.toObject(),
        product_id: review.product_id
      });

      return reply.send(review);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete review
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const review = await Review.findById(id);

      if (!review) {
        return reply.code(404).send({ error: 'Review not found' });
      }

      // Check if user owns the review
      if (review.reviewer_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own reviews' });
      }

      await Review.findByIdAndDelete(id);

      // Emit real-time event
      fastify.io?.emit('review:deleted', {
        review_id: id,
        product_id: review.product_id
      });

      return reply.send({ message: 'Review deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get product reviews summary
  fastify.get('/product/:productId/summary', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };

      const reviews = await Review.find({ product_id: productId });

      if (reviews.length === 0) {
        return reply.send({
          product_id: productId,
          total_reviews: 0,
          average_rating: 0,
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          verified_reviews: 0
        });
      }

      const totalReviews = reviews.length;
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
      const verifiedReviews = reviews.filter(review => review.is_verified_purchase).length;

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      return reply.send({
        product_id: productId,
        total_reviews: totalReviews,
        average_rating: Math.round(averageRating * 10) / 10,
        rating_distribution: ratingDistribution,
        verified_reviews: verifiedReviews
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}