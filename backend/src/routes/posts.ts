import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Post, IPost } from '../models/Post';
import { User } from '../models/User';
import { Follow } from '../models/Follow';
import { z } from 'zod';
import { likeTarget, unlikeTarget, getLikesForTargets, checkIfLiked } from '../services/likeService';
import { escapeRegex } from '../utils/sanitize';

const createPostSchema = z.object({
  content: z.string().default(''),
  media_urls: z.array(z.string()).default([]),
  thumbnail_urls: z.array(z.string()).default([]),
  media_type: z.enum(['image', 'video', 'text', 'product_review']).default('text'),
  tagged_products: z.array(z.string().nullable()).transform(arr => (arr || []).filter(item => typeof item === 'string')).default([]),
  affiliate_links: z.array(z.string().nullable()).transform(arr => (arr || []).filter(item => typeof item === 'string')).default([]),
  community_id: z.string().optional().nullable(),
  visibility: z.enum(['public', 'followers', 'community']).default('public'),
  // Optional fields that can be provided but are not required
  author_email: z.string().optional().nullable(),
  author_username: z.string().optional().nullable(),
  author_name: z.string().optional().nullable(),
});

export async function postRoutes(fastify: FastifyInstance) {
  // List posts with filtering and pagination
  fastify.get('/', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        author_email,
        author_username,
        community_id,
        visibility = 'public',
        following_only,
        user_email,
        user_username,
        search,
        limit = 20,
        skip,
        page = 1,
        sort = '-created_at'
      } = query;

      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);
      const parsedSkip = (skip !== undefined && skip !== null) ? parseInt(skip) : (parsedPage - 1) * parsedLimit;

      const filter: any = {};
      if (author_email) filter.author_email = author_email;
      if (author_username) filter.author_username = author_username;
      if (community_id) filter.community_id = community_id;
      if (visibility) filter.visibility = visibility;
      filter.is_active = { $ne: false };

      // Handle following_only filter
      if (following_only === 'true' && (user_email || user_username)) {
        let follower_username = user_username;
        
        // If only email is provided, find the user to get their username
        if (!follower_username && user_email) {
          const u = await User.findOne({ email: user_email.toLowerCase() }).select('username').lean();
          if (u) follower_username = u.username;
        }

        if (follower_username) {
          const follows = await Follow.find({
            follower_username: follower_username.toLowerCase(),
            follow_type: 'user'
          }).lean();
          const followingUsernames = follows.map(f => f.following_username).filter(Boolean);

          if (followingUsernames.length > 0) {
            filter.author_username = { $in: followingUsernames };
          } else {
            // Following no one
            return { data: [], total: 0, limit: parsedLimit, skip: parsedSkip, page: parsedPage };
          }
        } else if (user_email) {
          // User with this email not found
          return { data: [], total: 0, limit: parsedLimit, skip: parsedSkip, page: parsedPage };
        }
      }

      if (search) {
        filter.content = { $regex: escapeRegex(search), $options: 'i' };
      }

      const posts = await Post.find(filter)
        .sort(sort)
        .limit(parsedLimit)
        .skip(parsedSkip)
        .lean({ virtuals: true });

      const total = await Post.countDocuments(filter);

      // Get current user's likes in bulk for the fetched posts
      const user = request.user as any;
      const effectiveUsername = user?.username || user_username;
      let userLikesSet = new Set<string>();

      if (effectiveUsername) {
        const postIds = posts.map((p: any) => p._id.toString());
        userLikesSet = await getLikesForTargets(effectiveUsername.toString(), 'post', postIds);
      }

      // Add is_liked field and ID to each post
      const data = posts.map((post: any) => {
        const id = post._id.toString();
        return { 
          ...post, 
          id, 
          is_liked: userLikesSet.has(id)
        };
      });

      return {
        data,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
        page: parsedPage,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get post by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const post = await Post.findById(id).lean({ virtuals: true }) as any;

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      const user = request.user as any;

      if (post.is_active === false && user?.username !== post.author_username && user?.role !== 'super_admin') {
        return reply.code(404).send({ error: 'Post not found' });
      }

      // Add is_liked field
      const query = request.query as any;
      const effectiveUsername = user?.username || query?.user_username;
      
      let is_liked = false;
      if (effectiveUsername) {
        is_liked = await checkIfLiked(effectiveUsername.toString(), 'post', id);
      }

      return { 
        ...post, 
        id: post._id.toString(), 
        is_liked 
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create post
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createPostSchema.parse(request.body);

      // Fetch full user data to get display_name and avatar_url
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      const post = new Post({
        ...body,
        author_email: user.email,
        author_username: userData.username,
        author_name: userData.display_name || userData.username,
        author_avatar: userData.avatar_url,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      await post.save();
      return post;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Like a post
  fastify.post('/:id/like', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      return await likeTarget(user.username, 'post', id);
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Already liked') return reply.code(400).send({ error: error.message });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unlike a post
  fastify.delete('/:id/like', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      return await unlikeTarget(user.username, 'post', id);
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Like not found') return { status: 'unliked', message: 'Like already removed' };
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete post
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const post = await Post.findById(id);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      // Check ownership using username
      if (post.author_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      await Post.deleteOne({ _id: id });
      return { status: 'deleted' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update post
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const user = request.user as any;

      const post = await Post.findById(id);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      // Handle share count increment (allowed for everyone)
      if (body.$inc && body.$inc.shares_count === 1) {
        return await Post.findByIdAndUpdate(id, { $inc: { shares_count: 1 } }, { new: true });
      }

      // Other updates require ownership
      if (post.author_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Filter counters and sensitive fields from body
      const { likes_count, comments_count, shares_count, author_username, author_email, ...safeBody } = body;
      return await Post.findByIdAndUpdate(id, safeBody, { new: true });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
