import { FastifyInstance } from 'fastify';
import { User, IUser } from '../models/User';
import { escapeRegex } from '../utils/sanitize';
import { z } from 'zod';

export async function userRoutes(fastify: FastifyInstance) {
  // Get user online/offline status
  fastify.get('/:identifier/status', async (request, reply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      let user = await User.findOne({ username: identifier.toLowerCase() }).lean();
      if (!user) {
        user = await User.findOne({ email: identifier.toLowerCase() }).lean();
      }
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return {
        username: user.username,
        is_online: user.is_online || false,
        last_seen_at: user.last_seen_at || null,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get user profile by email or username
  fastify.get('/:identifier', async (request, reply) => {
    try {
      const { identifier } = request.params as { identifier: string };
      
      // Try finding by username first, then email
      let user = await User.findOne({ username: identifier.toLowerCase() }).lean();
      if (!user) {
        user = await User.findOne({ email: identifier.toLowerCase() }).lean();
      }

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Return public profile info (email hidden)
      return {
        id: user._id,
        username: user.username,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        role: user.role,
        follower_count: user.follower_count || 0,
        following_count: user.following_count || 0,
        created_at: user.created_at,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Search users
  fastify.get('/search', async (request, reply) => {
    try {
      const { q, limit = 10 } = request.query as any;
      if (!q) return [];

      const escaped = escapeRegex(q);
      const users = await User.find({
        $or: [
          { username: { $regex: escaped, $options: 'i' } },
          { display_name: { $regex: escaped, $options: 'i' } }
        ]
      })
      .limit(parseInt(limit))
      .select('username display_name avatar_url is_verified')
      .lean();

      return users;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get suggested users (random users with high follower count)
  fastify.get('/suggested', async (request, reply) => {
    try {
      const { limit = 10 } = request.query as any;

      const users = await User.find({})
        .sort({ follower_count: -1, created_at: -1 })
        .limit(parseInt(limit))
        .select('username display_name avatar_url is_verified follower_count')
        .lean();

      return { users };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Register push notification token
  fastify.post('/push-token', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      const user = request.user as any;

      if (!token) {
        return reply.code(400).send({ error: 'Token is required' });
      }

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      // Add token if it doesn't exist already
      await User.findOneAndUpdate(
        { username: user.username },
        { $addToSet: { push_tokens: token } }
      );

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Unregister push notification token
  fastify.delete('/push-token', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      const user = request.user as any;

      if (!token) {
        return reply.code(400).send({ error: 'Token is required' });
      }

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      await User.findOneAndUpdate(
        { username: user.username },
        { $pull: { push_tokens: token } }
      );

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error' 
      });
    }
  });
}
