import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Report } from '../models/Report';

export async function reportRoutes(fastify: FastifyInstance) {
  const createReportSchema = z.object({
    target_id: z.string(),
    target_type: z.enum(['user', 'store', 'post', 'product', 'comment', 'community', 'live_chat_message']),
    reason: z.string(),
    description: z.string().optional()
  });

  // Create a report
  fastify.post('/reports', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createReportSchema.parse(request.body);

      const report = new Report({
        reporter_id: user._id || user.userId,
        ...body,
        status: 'pending'
      });

      await report.save();
      return reply.code(201).send(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get my reports
  fastify.get('/reports/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const reports = await Report.find({ reporter_id: user._id || user.userId })
        .sort({ created_at: -1 });
      return reports;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
