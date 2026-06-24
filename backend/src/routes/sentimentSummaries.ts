import { FastifyInstance } from 'fastify';
import { SentimentSummary, ISentimentSummary } from '../models/SentimentSummary';

export async function sentimentSummaryRoutes(fastify: FastifyInstance) {
  // Get sentiment summary for a product
  fastify.get('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };

      const summary = await SentimentSummary.findOne({ product_id: productId });

      if (!summary) {
        return reply.code(404).send({ error: 'Sentiment summary not found for this product' });
      }

      reply.send(summary);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List sentiment summaries with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        product_id,
        overall_sentiment,
        min_score,
        max_score,
        sort = '-last_updated',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (product_id) filter.product_id = product_id;
      if (overall_sentiment) filter.overall_sentiment = overall_sentiment;
      if (min_score !== undefined) filter.sentiment_score = { ...filter.sentiment_score, $gte: parseInt(min_score) };
      if (max_score !== undefined) filter.sentiment_score = { ...filter.sentiment_score, $lte: parseInt(max_score) };

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const summaries = await SentimentSummary
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await SentimentSummary.countDocuments(filter);

      reply.send({
        summaries,
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

  // Get sentiment summary by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const summary = await SentimentSummary.findById(id);

      if (!summary) {
        return reply.code(404).send({ error: 'Sentiment summary not found' });
      }

      reply.send(summary);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create or update sentiment summary (typically called by AI service)
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ISentimentSummary>;

      // Validate required fields
      if (!body.product_id) {
        return reply.code(400).send({ error: 'Missing required field: product_id' });
      }

      if (!body.overall_sentiment) {
        return reply.code(400).send({ error: 'Missing required field: overall_sentiment' });
      }

      if (body.sentiment_score === undefined) {
        return reply.code(400).send({ error: 'Missing required field: sentiment_score' });
      }

      if (!body.summary_text) {
        return reply.code(400).send({ error: 'Missing required field: summary_text' });
      }

      // Validate sentiment values
      const validSentiments = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'];
      if (!validSentiments.includes(body.overall_sentiment)) {
        return reply.code(400).send({ error: 'Invalid overall_sentiment value' });
      }

      if (body.sentiment_score < 0 || body.sentiment_score > 100) {
        return reply.code(400).send({ error: 'sentiment_score must be between 0 and 100' });
      }

      // Use upsert to create or update
      const summary = await SentimentSummary.findOneAndUpdate(
        { product_id: body.product_id },
        {
          ...body,
          last_updated: new Date()
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

      reply.code(201).send(summary);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update sentiment summary
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ISentimentSummary>;

      const summary = await SentimentSummary.findById(id);

      if (!summary) {
        return reply.code(404).send({ error: 'Sentiment summary not found' });
      }

      // Update allowed fields
      const allowedUpdates = [
        'overall_sentiment',
        'sentiment_score',
        'pros',
        'cons',
        'summary_text',
        'review_count_analyzed'
      ];

      allowedUpdates.forEach(field => {
        const key = field as keyof ISentimentSummary;
        if (body[key] !== undefined) {
          (summary as any)[key] = body[key];
        }
      });

      summary.last_updated = new Date();
      await summary.save();

      reply.send(summary);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete sentiment summary
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const summary = await SentimentSummary.findByIdAndDelete(id);

      if (!summary) {
        return reply.code(404).send({ error: 'Sentiment summary not found' });
      }

      reply.send({ message: 'Sentiment summary deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Bulk update sentiment summaries (for batch processing)
  fastify.post('/bulk-update', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { summaries } = request.body as { summaries: Partial<ISentimentSummary>[] };

      if (!Array.isArray(summaries)) {
        return reply.code(400).send({ error: 'summaries must be an array' });
      }

      const results = [];
      const errors = [];

      for (const summaryData of summaries) {
        try {
          if (!summaryData.product_id) {
            errors.push({ product_id: summaryData.product_id, error: 'Missing product_id' });
            continue;
          }

          const summary = await SentimentSummary.findOneAndUpdate(
            { product_id: summaryData.product_id },
            {
              ...summaryData,
              last_updated: new Date()
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true
            }
          );

          results.push(summary);
        } catch (error) {
          errors.push({ product_id: summaryData.product_id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      reply.send({
        message: 'Bulk update completed',
        updated: results.length,
        errors_count: errors.length,
        results,
        errors
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get sentiment statistics across all products
  fastify.get('/stats/overview', async (request, reply) => {
    try {
      const stats = await SentimentSummary.aggregate([
        {
          $group: {
            _id: '$overall_sentiment',
            count: { $sum: 1 },
            avg_score: { $avg: '$sentiment_score' },
            min_score: { $min: '$sentiment_score' },
            max_score: { $max: '$sentiment_score' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalSummaries = await SentimentSummary.countDocuments();
      const avgReviewCount = await SentimentSummary.aggregate([
        {
          $group: {
            _id: null,
            avg_reviews: { $avg: '$review_count_analyzed' }
          }
        }
      ]);

      reply.send({
        total_summaries: totalSummaries,
        sentiment_distribution: stats,
        average_reviews_analyzed: avgReviewCount[0]?.avg_reviews || 0
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}