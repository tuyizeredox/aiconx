import { FastifyInstance } from 'fastify';
import { Announcement } from '../models/Announcement';
import { authenticateOptional } from '../middleware/auth';

export async function announcementRoutes(fastify: FastifyInstance) {
  // Get active announcements for current user
  fastify.get('/active', {
    preHandler: [authenticateOptional]
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const now = new Date();

      const query: any = {
        is_active: true,
        $or: [
          { expires_at: { $exists: false } },
          { expires_at: { $gt: now } }
        ]
      };

      // Filter by target
      if (!user) {
        // Public announcements
        query.target = 'all';
      } else {
        // Logged in user: 'all' + their specific role
        const targets = ['all'];
        if (user.role === 'vendor') {
          targets.push('vendors');
        } else {
          targets.push('users');
        }
        query.target = { $in: targets };
      }

      const announcements = await Announcement.find(query)
        .sort({ created_at: -1 });

      return { announcements };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
