import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductQuestion } from '../models/ProductQuestion';
import { Product } from '../models/Product';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

const askSchema = z.object({
  product_id: z.string().min(1),
  question: z.string().trim().min(5).max(500),
});

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
});

export async function productQuestionRoutes(fastify: FastifyInstance) {
  // Public Q&A for a product. Answered questions surface first — an unanswered
  // pile at the top reads as an unresponsive seller and buries the answers that
  // actually help someone decide.
  fastify.get('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const { limit = 20, skip = 0 } = request.query as any;

      const filter = { product_id: productId, status: 'published' as const };

      const [questions, total, answered] = await Promise.all([
        ProductQuestion.find(filter)
          .sort({ answered_at: -1, created_at: -1 })
          .limit(Math.min(parseInt(limit) || 20, 100))
          .skip(parseInt(skip) || 0)
          .lean(),
        ProductQuestion.countDocuments(filter),
        ProductQuestion.countDocuments({ ...filter, answer: { $exists: true, $nin: [null, ''] } }),
      ]);

      return reply.send({
        data: questions.map(q => ({ ...q, id: String(q._id) })),
        total,
        answered,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Ask a question
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = askSchema.parse(request.body);

      const product = await Product.findById(body.product_id).lean();
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      if (product.vendor_username === user.username) {
        return reply.code(400).send({
          error: 'Cannot ask about your own product',
          message: 'You can answer questions on your own product, not ask them.',
        });
      }

      const question = new ProductQuestion({
        product_id: String(product._id),
        store_id: product.store_id,
        vendor_username: product.vendor_username,
        asker_username: user.username,
        asker_name: user.display_name || user.username,
        question: body.question,
      });
      await question.save();

      // Tell the vendor — an unseen question is a lost sale, and nothing else
      // in the app surfaces these to them.
      try {
        const notification = new Notification({
          recipient_username: product.vendor_username,
          type: 'comment',
          title: `New question on ${product.title}`,
          body: body.question.slice(0, 140),
          link: `/productdetail?id=${product._id}`,
          sender_username: user.username,
          sender_name: user.display_name || user.username,
          metadata: { product_id: String(product._id), question_id: String(question._id) },
        });
        await notification.save();
        fastify.io?.to(`user:${product.vendor_username}`).emit('notification:new', notification);
        NotificationService.sendPushNotification(product.vendor_username, notification, fastify);
      } catch (notifyError) {
        // A failed notification must not fail the question itself.
        fastify.log.error(notifyError);
      }

      return reply.code(201).send({ ...question.toObject(), id: String(question._id) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Answer a question — the product's vendor only
  fastify.post('/:id/answer', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const body = answerSchema.parse(request.body);

      const question = await ProductQuestion.findById(id);
      if (!question) {
        return reply.code(404).send({ error: 'Question not found' });
      }

      if (question.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'Only the seller can answer questions on this product' });
      }

      question.answer = body.answer;
      question.answered_by = user.username;
      question.answered_at = new Date();
      await question.save();

      try {
        const notification = new Notification({
          recipient_username: question.asker_username,
          type: 'comment',
          title: 'Your question was answered',
          body: body.answer.slice(0, 140),
          link: `/productdetail?id=${question.product_id}`,
          sender_username: user.username,
          sender_name: user.display_name || user.username,
          metadata: { product_id: question.product_id, question_id: String(question._id) },
        });
        await notification.save();
        fastify.io?.to(`user:${question.asker_username}`).emit('notification:new', notification);
        NotificationService.sendPushNotification(question.asker_username, notification, fastify);
      } catch (notifyError) {
        fastify.log.error(notifyError);
      }

      return reply.send({ ...question.toObject(), id: String(question._id) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Delete — the asker can withdraw their question, the vendor can remove one
  // from their product page.
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const question = await ProductQuestion.findById(id);
      if (!question) {
        return reply.code(404).send({ error: 'Question not found' });
      }

      const canDelete = question.asker_username === user.username
        || question.vendor_username === user.username
        || user.role === 'super_admin';

      if (!canDelete) {
        return reply.code(403).send({ error: 'You cannot delete this question' });
      }

      await ProductQuestion.findByIdAndDelete(id);
      return reply.send({ message: 'Question deleted' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });
}
