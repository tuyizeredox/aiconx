import { FastifyInstance } from 'fastify';
import { Bookmark, IBookmark } from '../models/Bookmark';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Product } from '../models/Product';

export async function bookmarkRoutes(fastify: FastifyInstance) {
  // List bookmarks for current user
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, limit = 50, skip = 0 } = request.query as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const filter: any = { user_username: user.username };
      if (target_type) filter.target_type = target_type;

      const bookmarks = await Bookmark
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Bookmark.countDocuments(filter);

      return reply.send({
        data: bookmarks,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Check if bookmarked
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.query as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const bookmark = await Bookmark.findOne({
        user_username: user.username,
        target_type,
        target_id
      });

      return reply.send({ is_bookmarked: !!bookmark });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create bookmark
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.body as { target_type: string, target_id: string };

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      // Validate target_type
      if (!['post', 'product'].includes(target_type)) {
        return reply.code(400).send({ error: 'Invalid target_type. Must be post or product.' });
      }

      // Check if already bookmarked
      const existing = await Bookmark.findOne({
        user_username: user.username,
        target_type,
        target_id
      });

      if (existing) {
        return reply.code(409).send({ error: 'Already bookmarked' });
      }

      const bookmark = new Bookmark({
        user_username: user.username,
        target_type,
        target_id
      });

      await bookmark.save();
      return reply.code(201).send(bookmark);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Remove bookmark
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.query as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const result = await Bookmark.findOneAndDelete({
        user_username: user.username,
        target_type,
        target_id
      });

      if (!result) {
        return reply.code(404).send({ error: 'Bookmark not found' });
      }

      return reply.send({ message: 'Bookmark removed' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}
