import { FastifyInstance } from 'fastify';
import { Notification as NotificationModel, INotification } from '../models/Notification';

export async function notificationRoutes(fastify: FastifyInstance) {
  // List notifications for a user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const query = request.query as any;
      
      const limit = parseInt(query.limit) || 50;
      const skip = parseInt(query.skip) || 0;
      const unread_only = query.unread_only === 'true';
      const since = query.since;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const filter: any = { recipient_username: user.username };
      if (unread_only) {
        filter.is_read = false;
      }

      if (since) {
        filter.created_at = { $gt: new Date(since) };
      }

      // Use Promise.all to run queries in parallel
      const [notifications, total, unreadCount] = await Promise.all([
        NotificationModel.find(filter)
          .sort({ created_at: -1 })
          .limit(limit)
          .skip(skip)
          .lean({ virtuals: true }),
        NotificationModel.countDocuments(filter),
        NotificationModel.countDocuments({ recipient_username: user.username, is_read: false })
      ]);

      return {
        data: notifications,
        total,
        unreadCount,
        limit,
        skip,
      };
    } catch (error: any) {
      console.error('❌ Notifications API Error:', error);
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      });
    }
  });

  // Mark notification as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const notification = await NotificationModel.findOneAndUpdate(
        { _id: id, recipient_username: user.username },
        { is_read: true },
        { new: true }
      );

      if (!notification) {
        return reply.code(404).send({ error: 'Notification not found' });
      }

      return notification;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark all notifications as read
  fastify.patch('/read-all', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      await NotificationModel.updateMany(
        { recipient_username: user.username, is_read: false },
        { is_read: true }
      );

      return { status: 'success' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const result = await NotificationModel.deleteOne({ _id: id, recipient_username: user.username });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Notification not found' });
      }

      return { status: 'deleted' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}