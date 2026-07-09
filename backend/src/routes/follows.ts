import { FastifyInstance } from 'fastify';
import { Follow, IFollow } from '../models/Follow';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Community } from '../models/Community';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

// Helper to parse pagination
const getPagination = (query: any) => {
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = Math.max(parseInt(query.skip) || 0, 0);
  return { limit, skip };
};

export async function followRoutes(fastify: FastifyInstance) {
  // Get follows for a user
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        follower_username,
        following_username,
        follow_type,
      } = query;

      const { limit, skip } = getPagination(query);

      // Build filter object
      const filter: any = {};

      if (follower_username) filter.follower_username = follower_username;
      if (following_username) filter.following_username = following_username;
      if (follow_type) filter.follow_type = follow_type;

      const follows = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip)
        .select('follower_username following_username follow_type target_id created_at')
        .lean();

      const total = await Follow.countDocuments(filter);

      return reply.send({
        data: follows,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Follow a user/store/community
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { following_username: string; follow_type?: string; target_id?: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized: User username not found in token' });
      }

      const { following_username, follow_type = 'user', target_id } = body;
      
      fastify.log.info({ follow_type, following_username, target_id, user: user.username }, 'Processing follow request');

      // Validate follow_type
      const validTypes = ['user', 'store', 'community'];
      if (!validTypes.includes(follow_type)) {
        return reply.code(400).send({ error: 'Invalid follow_type. Must be user, store, or community' });
      }

      // Basic validation for required fields
      if (follow_type === 'user' && !following_username) {
        return reply.code(400).send({ error: 'following_username is required for follow_type: user' });
      }

      // Validate target_id for store/community
      if ((follow_type === 'store' || follow_type === 'community') && !target_id) {
        return reply.code(400).send({ error: `target_id is required for follow_type: ${follow_type}` });
      }

      // Prevent self-following
      if (follow_type === 'user' && following_username?.toLowerCase() === user.username.toLowerCase()) {
        return reply.code(400).send({ error: 'You cannot follow yourself' });
      }

      const lowerFollowingUsername = following_username?.toLowerCase();

      // Check if target exists
      let targetUser = null;
      let targetExists = false;
      let targetEntity: any = null;

      try {
        switch (follow_type) {
          case 'user':
            targetUser = await User.findOne({ username: lowerFollowingUsername });
            targetExists = !!targetUser;
            targetEntity = targetUser;
            break;
          case 'store':
            targetEntity = await Store.findById(target_id);
            targetExists = !!targetEntity;
            break;
          case 'community':
            targetEntity = await Community.findById(target_id);
            targetExists = !!targetEntity;
            break;
        }
      } catch (err: any) {
        fastify.log.error(err, 'Error finding follow target');
        // Handle invalid ObjectId format
        if (err.name === 'CastError') {
          return reply.code(400).send({ error: `Invalid target_id format: ${target_id}` });
        }
        throw err;
      }

      if (!targetExists) {
        return reply.code(404).send({ error: `${follow_type} not found` });
      }

      // For stores and communities, ensure following_username is set correctly if missing
      let finalFollowingUsername = lowerFollowingUsername;
      if (follow_type === 'store' && targetEntity) {
        finalFollowingUsername = targetEntity.owner_username || lowerFollowingUsername;
      } else if (follow_type === 'community' && targetEntity) {
        finalFollowingUsername = targetEntity.owner_username || lowerFollowingUsername;
      }
      
      // Ensure finalFollowingUsername is lowercased (it should be already if from DB, but just in case)
      if (finalFollowingUsername) {
        finalFollowingUsername = finalFollowingUsername.toLowerCase();
      } else if (follow_type === 'user') {
         // This should not happen if lowerFollowingUsername was present
         return reply.code(400).send({ error: 'following_username is required' });
      }

      fastify.log.info({ finalFollowingUsername }, 'Target resolved');

      // Check if already following
      const existingFollow = await Follow.findOne({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        target_id: target_id || null
      });

      if (existingFollow) {
        return reply.code(409).send({ error: 'You are already following this entity' });
      }

      const follow = new Follow({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        target_id: target_id || null,
      });

      await follow.save();
      fastify.log.info({ follow_id: follow._id }, 'Follow saved');

      // Get current user's display name if not in token
      let currentUserDisplayName = user.display_name;
      if (!currentUserDisplayName) {
        const currentUser = await User.findOne({ username: user.username });
        currentUserDisplayName = currentUser?.display_name || user.username;
      }

      // Update counts and notifications in a background-safe way
      const updatePromise = (async () => {
        try {
          await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: 1 } });
          
          let recipientUsername = targetUser?.username;
          let title = `${currentUserDisplayName} started following you`;
          let link = `/profile?username=${user.username}`;

          if (follow_type === 'user') {
            if (finalFollowingUsername) {
              await User.findOneAndUpdate({ username: finalFollowingUsername }, { $inc: { follower_count: 1 } });
              recipientUsername = finalFollowingUsername;
            }
          } else if (follow_type === 'store' && target_id) {
            if (targetEntity) {
              await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: 1 } });
              recipientUsername = targetEntity.owner_username;
              title = `${currentUserDisplayName} started following your store: ${targetEntity.name}`;
              link = `/StoreDetail?id=${targetEntity._id}`;
            }
          } else if (follow_type === 'community' && target_id) {
            if (targetEntity) {
              await Community.findByIdAndUpdate(target_id, { $inc: { member_count: 1 } });
              recipientUsername = targetEntity.owner_username;
              title = `${currentUserDisplayName} joined your community: ${targetEntity.name}`;
              link = `/CommunityDetail?id=${targetEntity._id}`;
            }
          }

          fastify.log.info({ recipientUsername }, 'Updating notification');

          // Create notification for the target
          if (recipientUsername && recipientUsername !== user.username) {
            try {
              const notification = new Notification({
                recipient_username: recipientUsername,
                type: 'follow',
                title,
                sender_username: user.username,
                sender_name: currentUserDisplayName,
                link,
                metadata: {
                  follow_id: follow._id,
                  follow_type,
                  target_id
                }
              });
              await notification.save();

              // Emit notification via socket
              fastify.io?.to(`user:${recipientUsername}`).emit('notification:new', notification);
              NotificationService.sendPushNotification(recipientUsername, notification, fastify);
            } catch (notifErr: any) {
              fastify.log.error(notifErr, 'Failed to create/emit notification');
            }
          }

          // Emit real-time events to relevant users only
          const io = fastify.io;
          if (io) {
            try {
              // Emit to follower
              io.to(`user:${user.username}`).emit('follow:created', {
                follow: follow.toObject()
              });
              // Emit to followed user (if applicable)
              if (recipientUsername) {
                io.to(`user:${recipientUsername}`).emit('follow:created', {
                  follow: follow.toObject()
                });
              }
            } catch (socketErr: any) {
              fastify.log.error(socketErr, 'Failed to emit socket events');
            }
          }
        } catch (countErr: any) {
          fastify.log.error(countErr, 'Error in background updates (counts/notifications)');
        }
      })();

      // Don't wait for background updates to respond to user
      // But we can await it if we want to be sure. Let's not await to keep it fast.
      // Actually, for better reliability and avoiding 500s from background issues, 
      // we already have the inner try-catch.
      
      return reply.code(201).send(follow);
    } catch (error: any) {
      fastify.log.error(error, 'Follow handler failed');
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({ 
        error: 'Internal server error', 
        message: error.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Unfollow a user/store/community
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized: User username not found in token' });
      }

      // For stores and communities, ensure following_username is set correctly if missing
      let finalFollowingUsername = following_username?.toLowerCase();
      if ((follow_type === 'store' || follow_type === 'community') && target_id && !finalFollowingUsername) {
        try {
          const targetEntity = follow_type === 'store' 
            ? await Store.findById(target_id) 
            : await Community.findById(target_id);
          if (targetEntity) {
            finalFollowingUsername = targetEntity.owner_username?.toLowerCase();
          }
        } catch (err: any) {
          // Handle invalid ObjectId format
          if (err.name === 'CastError') {
            return reply.code(400).send({ error: `Invalid target_id format: ${target_id}` });
          }
          throw err;
        }
      } else if (finalFollowingUsername) {
        finalFollowingUsername = finalFollowingUsername.toLowerCase();
      }

      const follow = await Follow.findOneAndDelete({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        target_id: target_id || null
      });

      if (!follow) {
        return reply.code(404).send({ error: 'Follow relationship not found' });
      }

      // Update counts in background
      (async () => {
        try {
          await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: -1 } });
          
          let recipientUsername = finalFollowingUsername;
          if (follow_type === 'user') {
            if (finalFollowingUsername) {
              await User.findOneAndUpdate({ username: finalFollowingUsername }, { $inc: { follower_count: -1 } });
            }
          } else if (follow_type === 'store' && target_id) {
            const store = await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: -1 } });
            recipientUsername = store?.owner_username?.toLowerCase() || finalFollowingUsername;
          } else if (follow_type === 'community' && target_id) {
            const community = await Community.findByIdAndUpdate(target_id, { $inc: { member_count: -1 } });
            recipientUsername = community?.owner_username?.toLowerCase() || finalFollowingUsername;
          }

          // Emit real-time events to relevant users only
          const io = fastify.io;
          if (io) {
            io.to(`user:${user.username}`).emit('follow:deleted', {
              follow_id: follow._id,
              following_username: finalFollowingUsername,
              follow_type,
              target_id: target_id || null
            });
            if (recipientUsername) {
              io.to(`user:${recipientUsername}`).emit('follow:deleted', {
                follow_id: follow._id,
                following_username: finalFollowingUsername,
                follow_type,
                target_id: target_id || null
              });
            }
          }
        } catch (countErr: any) {
          fastify.log.error(countErr, 'Error in background unfollow updates');
        }
      })();

      return reply.send({ message: 'Successfully unfollowed' });
    } catch (error: any) {
      fastify.log.error(error, 'Unfollow handler failed');
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({ 
        error: 'Internal server error', 
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Check if user is following
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized: User username not found in token' });
      }

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const follow = await Follow.findOne({
        follower_username: user.username,
        ...(following_username && { following_username: following_username.toLowerCase() }),
        follow_type,
        target_id: target_id || null
      });

      // Check if target is following current user back
      let is_followed_by = false;
      if (follow_type === 'user' && following_username) {
        const backFollow = await Follow.findOne({
          follower_username: following_username.toLowerCase(),
          following_username: user.username.toLowerCase(),
          follow_type: 'user'
        });
        is_followed_by = !!backFollow;
      }

      return reply.send({ is_following: !!follow, is_followed_by });
    } catch (error: any) {
      fastify.log.error(error, 'Check follow handler failed');
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Get followers of a user/store/community
  fastify.get('/followers', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const { limit, skip } = getPagination(query);

      const filter: any = {
        follow_type,
        ...(following_username && { following_username: following_username.toLowerCase() }),
        ...(target_id && { target_id })
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      // Fetch user details for each follower
      const followersWithDetails = await Promise.all(
        followers.map(async (follow) => {
          if (follow_type === 'user') {
            const user = await User.findOne({ username: follow.follower_username })
              .select('username display_name avatar_url is_verified')
              .lean();
            return {
              ...follow,
              user
            };
          }
          return follow;
        })
      );

      const total = await Follow.countDocuments(filter);

      return reply.send({
        followers: followersWithDetails,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error: any) {
      fastify.log.error(error, 'Get followers handler failed');
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Get following list of a user
  fastify.get('/following', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { follower_username, follow_type } = query;

      if (!follower_username) {
        return reply.code(400).send({ error: 'follower_username is required' });
      }

      const { limit, skip } = getPagination(query);

      const filter: any = { follower_username: follower_username.toLowerCase() };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      // Fetch user details for each followed user
      const followingWithDetails = await Promise.all(
        following.map(async (follow) => {
          if (follow.follow_type === 'user') {
            const user = await User.findOne({ username: follow.following_username })
              .select('username display_name avatar_url is_verified')
              .lean();
            return {
              ...follow,
              user
            };
          }
          return follow;
        })
      );

      const total = await Follow.countDocuments(filter);

      return reply.send({
        following: followingWithDetails,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error: any) {
      fastify.log.error(error, 'Get following handler failed');
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Get follow counts for a user/store/community
  fastify.get('/counts', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const filter: any = {
        follow_type,
        ...(following_username && { following_username: following_username.toLowerCase() }),
        ...(target_id && { target_id })
      };

      const followerCount = await Follow.countDocuments(filter);

      // For user follows, also get following count
      let followingCount = 0;
      if (follow_type === 'user' && following_username) {
        followingCount = await Follow.countDocuments({
          follower_username: following_username.toLowerCase(),
          follow_type: 'user'
        });
      }

      return reply.send({
        follower_count: followerCount,
        following_count: followingCount
      });
    } catch (error: any) {
      fastify.log.error(error, 'Get follow counts handler failed');
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Get my follows (following)
  fastify.get('/me/following', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const user = request.user as any;
      const { follow_type } = query;

      const { limit, skip } = getPagination(query);

      const filter: any = { follower_username: user.username };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      return reply.send({
        following,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get my followers
  fastify.get('/me/followers', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const user = request.user as any;
      const { follow_type = 'user' } = query;

      const { limit, skip } = getPagination(query);

      const filter: any = {
        following_username: user.username,
        follow_type
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      return reply.send({
        followers,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}