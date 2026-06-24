import { FastifyInstance } from 'fastify';
import { LiveChatMessage, ILiveChatMessage } from '../models/LiveChatMessage';
import { LiveSession } from '../models/LiveSession';
import { LiveChatService } from '../services/liveChatService';
import { z } from 'zod';
import { checkLiveChatLimit } from '../middleware/subscription';

export async function liveChatMessageRoutes(fastify: FastifyInstance) {
  // Schema for message sending
  const sendMessageSchema = z.object({
    session_id: z.string(),
    content: z.string().min(1).max(500),
    message_type: z.enum(['chat', 'purchase', 'join', 'like']).optional(),
    product_id: z.string().optional(),
    product_title: z.string().optional(),
    reply_to: z.string().optional()
  });

  // Schema for banning
  const banUserSchema = z.object({
    session_id: z.string(),
    target_username: z.string(),
    ban: z.boolean().optional()
  });

  // Schema for reporting
  const reportSchema = z.object({
    reason: z.string(),
    description: z.string().optional()
  });
  // Get messages for a live session
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        session_id,
        message_type,
        limit = 50,
        skip = 0,
        include_deleted = false
      } = query;

      if (!session_id) {
        return reply.code(400).send({ error: 'session_id is required' });
      }

      // Access control for deleted messages
      let canSeeDeleted = false;
      if (include_deleted === 'true' || include_deleted === true) {
        try {
          // Check if user is authenticated and is host/moderator
          await request.jwtVerify();
          const user = request.user as any;
          const session = await LiveSession.findById(session_id);
          if (session) {
            canSeeDeleted = 
              session.host_username === user.username || 
              session.moderators.includes(user.username.toLowerCase());
          }
        } catch (err) {
          // Not authenticated or other error, canSeeDeleted stays false
        }
      }

      const filter: any = { session_id };
      if (!canSeeDeleted) filter.is_deleted = false;
      if (message_type) filter.message_type = message_type;

      const messages = await LiveChatMessage
        .find(filter)
        .sort({ is_pinned: -1, created_at: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await LiveChatMessage.countDocuments(filter);

      reply.send({
        messages,
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

  // Send a message
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkLiveChatLimit]
  }, async (request, reply) => {
    try {
      const body = sendMessageSchema.parse(request.body);
      const user = request.user as any;

      const message = await LiveChatService.sendMessage({
        session_id: body.session_id,
        user_username: user.username,
        user_name: user.display_name || user.username,
        content: body.content,
        message_type: body.message_type as any,
        product_id: body.product_id,
        product_title: body.product_title,
        reply_to: body.reply_to
      });

      reply.code(201).send(message);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      fastify.log.error(error);
      reply.code(error.message.includes('banned') || error.message.includes('fast') ? 403 : 400).send({ error: error.message });
    }
  });

  // Like a message
  fastify.post('/:id/like', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const message = await LiveChatService.likeMessage(id, user.username);
      reply.send(message);
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  // Pin/Unpin a message
  fastify.post('/:id/pin', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { pin = true } = request.body as { pin?: boolean };
      const user = request.user as any;
      
      const message = await LiveChatService.togglePinMessage(id, user.username, pin);
      reply.send(message);
    } catch (error: any) {
      reply.code(error.message.includes('Unauthorized') ? 403 : 400).send({ error: error.message });
    }
  });

  // Delete a message
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      
      const message = await LiveChatService.deleteMessage(id, user.username);
      reply.send({ message: 'Message deleted successfully', data: message });
    } catch (error: any) {
      reply.code(error.message.includes('Unauthorized') ? 403 : 400).send({ error: error.message });
    }
  });

  // Report a message
  fastify.post('/:id/report', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = reportSchema.parse(request.body);
      const user = request.user as any;

      const report = await LiveChatService.reportMessage(id, user._id || user.userId, body.reason, body.description);
      reply.code(201).send(report);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      reply.code(400).send({ error: error.message });
    }
  });

  // Ban/Unban user from chat
  fastify.post('/ban', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = banUserSchema.parse(request.body);
      const user = request.user as any;
      const isBan = body.ban ?? true;

      await LiveChatService.toggleBanUser(body.session_id, user.username, body.target_username, isBan);
      reply.send({ message: `User ${body.target_username} ${isBan ? 'banned' : 'unbanned'} successfully` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      reply.code(error.message.includes('Unauthorized') ? 403 : 400).send({ error: error.message });
    }
  });

  // Get message statistics
  fastify.get('/stats/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };

      const stats = await LiveChatMessage.aggregate([
        { $match: { session_id: sessionId, is_deleted: false } },
        {
          $group: {
            _id: '$message_type',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalMessages = await LiveChatMessage.countDocuments({ session_id: sessionId, is_deleted: false });
      const uniqueUsers = await LiveChatMessage.distinct('user_username', { session_id: sessionId, is_deleted: false });

      reply.send({
        session_id: sessionId,
        total_messages: totalMessages,
        unique_users: uniqueUsers.length,
        message_types: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
