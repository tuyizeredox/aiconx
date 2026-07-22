import { FastifyInstance } from 'fastify';
import { Like } from '../models/Like';
import { likeTarget, unlikeTarget } from '../services/likeService';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Story } from '../models/Story';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { Follow } from '../models/Follow';

export async function likeRoutes(fastify: FastifyInstance) {
  // Get likes for a specific target
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        target_type,
        target_id,
        user_username,
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (target_type) filter.target_type = target_type;
      if (target_id) filter.target_id = target_id;
      if (user_username) filter.user_username = user_username.toLowerCase();

      const likes = await Like
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Like.countDocuments(filter);

      return reply.send({
        data: likes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch likes' 
      });
    }
  });

  // Check if user has liked a specific target
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const like = await Like.findOne({
        user_username: user.username.toLowerCase(),
        target_type,
        target_id
      });

      return reply.send({ has_liked: !!like });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to check like status' 
      });
    }
  });

  // Like a target
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { target_type: string; target_id: string };
      const user = request.user as any;
      
      if (!body || !body.target_type || !body.target_id) {
        return reply.code(400).send({ error: 'Missing required body parameters: target_type, target_id' });
      }

      const { target_type, target_id } = body;

      const result = await likeTarget(user.username, target_type, target_id);

      let targetOwnerUsername: string | null = null;
      switch (target_type) {
        case 'post': {
          const post = await Post.findById(target_id).select('author_username');
          targetOwnerUsername = post?.author_username || null;
          break;
        }
        case 'comment': {
          const commentDoc = await Comment.findById(target_id).select('author_username');
          targetOwnerUsername = commentDoc?.author_username || null;
          break;
        }
        case 'story': {
          const story = await Story.findById(target_id).select('author_username');
          targetOwnerUsername = story?.author_username || null;
          break;
        }
        case 'product': {
          const productDoc = await Product.findById(target_id).select('vendor_username store_name');
          targetOwnerUsername = productDoc?.vendor_username || null;
          break;
        }
        case 'review': {
          const review = await Review.findById(target_id).select('reviewer_username');
          targetOwnerUsername = review?.reviewer_username || null;
          break;
        }
      }

      if (targetOwnerUsername && targetOwnerUsername !== user.username) {
        try {
          const ownerUser = await User.findOne({ username: targetOwnerUsername }).select('display_name').lean();
          const senderName = user.display_name || user.username;
          const notification = new Notification({
            recipient_username: targetOwnerUsername,
            type: 'like',
            title: `${senderName} liked your ${target_type.replace('_', ' ')}`,
            body: `${senderName} liked your ${target_type}`,
            sender_username: user.username,
            sender_name: senderName,
            metadata: { target_type, target_id }
          });
          await notification.save();
          fastify.io?.to(`user:${targetOwnerUsername}`).emit('notification:new', notification);
          NotificationService.sendPushNotification(targetOwnerUsername, notification, fastify);
        } catch (notifErr) {
          fastify.log.error(notifErr, 'Failed to create like notification');
        }
      }

      // Emit generic real-time event
      fastify.io?.emit('like:created', {
        like: result.like_doc,
        target_type,
        target_id,
        user_username: user.username
      });

      // Special handling for entity-specific listeners
      switch (target_type) {
        case 'post':
          fastify.io?.emit('post_updated', {
            type: 'like',
            post_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'story':
          fastify.io?.emit('story_updated', {
            type: 'like',
            story_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'comment':
          fastify.io?.emit('comment_updated', {
            type: 'like',
            comment_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'live_session':
          fastify.io?.to(`live-session-${target_id}`).emit('live-session-liked', {
            session_id: target_id,
            likes: result.likes_count
          });
          break;
      }

      return reply.code(201).send(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: 'Target not found', message: error.message });
      }
      if (error.message.includes('Already liked')) {
        return reply.code(409).send({ error: 'Conflict', message: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Unlike a target
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required query parameters: target_type, target_id' });
      }

      const result = await unlikeTarget(user.username, target_type, target_id);

      // Emit generic real-time event
      fastify.io?.emit('like:deleted', {
        target_type,
        target_id,
        user_username: user.username
      });

      // Special handling for entity-specific updates
      switch (target_type) {
        case 'post':
          fastify.io?.emit('post_updated', {
            type: 'unlike',
            post_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'story':
          fastify.io?.emit('story_updated', {
            type: 'unlike',
            story_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'comment':
          fastify.io?.emit('comment_updated', {
            type: 'unlike',
            comment_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'live_session':
          fastify.io?.to(`live-session-${target_id}`).emit('live-session-unliked', {
            session_id: target_id,
            likes: result.likes_count
          });
          break;
      }

      return reply.send(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        // Return 200 instead of 404 for unliking something that isn't liked
        // to handle race conditions and optimistic UI gracefully
        return reply.code(200).send({ status: 'already_unliked', message: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Get likes count for a target
  fastify.get('/count', async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const count = await Like.countDocuments({ target_type, target_id });

      return reply.send({ count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get people the current user follows who also liked a target ("liked by people you follow")
  fastify.get('/known-likers', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id, limit = 3 } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const following = await Follow.find({
        follower_username: user.username,
        follow_type: 'user'
      }).select('following_username').lean();

      const followingUsernames = following.map(f => f.following_username);

      if (followingUsernames.length === 0) {
        return reply.send({ users: [], total: 0 });
      }

      const knownLikesFilter = {
        target_type,
        target_id,
        user_username: { $in: followingUsernames }
      };

      const likes = await Like
        .find(knownLikesFilter)
        .sort({ created_at: -1 })
        .limit(Math.min(parseInt(limit), 20))
        .lean();

      const total = await Like.countDocuments(knownLikesFilter);

      const usernames = likes.map(l => l.user_username);
      const users = await User.find({ username: { $in: usernames } })
        .select('username display_name avatar_url')
        .lean();

      const usersByUsername = new Map(users.map(u => [u.username, u]));
      const orderedUsers = usernames.map(u => usersByUsername.get(u)).filter(Boolean);

      return reply.send({ users: orderedUsers, total });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get user's likes
  fastify.get('/user', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        target_type,
        limit = 20,
        skip = 0
      } = query;
      const user = request.user as any;

      const filter: any = { 
        user_username: user.username.toLowerCase()
      };
      if (target_type) filter.target_type = target_type;

      const likes = await Like
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Like.countDocuments(filter);

      return reply.send({
        data: likes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}
