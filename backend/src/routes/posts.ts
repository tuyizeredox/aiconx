import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Post, IPost } from '../models/Post';
import { User } from '../models/User';
import { Follow } from '../models/Follow';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { z } from 'zod';
import { likeTarget, unlikeTarget, getLikesForTargets } from '../services/likeService';
import { escapeRegex } from '../utils/sanitize';

const createPostSchema = z.object({
  content: z.string().default(''),
  media_urls: z.array(z.string()).default([]),
  thumbnail_urls: z.array(z.string()).default([]),
  media_type: z.enum(['image', 'video', 'text', 'product_review']).default('text'),
  // Capped at 3 to match the composer UI — sliced rather than rejected so
  // resaving an older post that predates this limit doesn't hard-fail.
  tagged_products: z.array(z.string().nullable()).transform(arr => (arr || []).filter(item => typeof item === 'string').slice(0, 3)).default([]),
  affiliate_links: z.array(z.string().nullable()).transform(arr => (arr || []).filter(item => typeof item === 'string').slice(0, 3)).default([]),
  community_id: z.string().optional().nullable(),
  visibility: z.enum(['public', 'followers', 'community']).default('public'),
  // Optional fields that can be provided but are not required
  author_email: z.string().optional().nullable(),
  author_username: z.string().optional().nullable(),
  author_name: z.string().optional().nullable(),
});

const MENTION_REGEX = /@([a-zA-Z0-9_]{3,30})/g;

// Pulls unique @usernames out of post content, case-insensitively.
function extractMentionCandidates(content: string): string[] {
  if (!content) return [];
  const matches = content.matchAll(MENTION_REGEX);
  const usernames = new Set<string>();
  for (const match of matches) usernames.add(match[1].toLowerCase());
  return Array.from(usernames);
}

// Resolves @mention candidates against real users and notifies the newly
// tagged ones (never re-notifies for a username already present in
// `alreadyTaggedUsers`, e.g. on a post edit). Returns the full resolved
// tagged_users list to persist on the post.
async function resolveAndNotifyMentions(
  content: string,
  authorUsername: string,
  authorDisplayName: string,
  postId: string,
  alreadyTaggedUsers: string[],
  fastify: FastifyInstance
): Promise<string[]> {
  const candidates = extractMentionCandidates(content).filter(u => u !== authorUsername);
  if (candidates.length === 0) return [];

  const matchedUsers = await User.find({ username: { $in: candidates } }).select('username').lean();
  const taggedUsernames = matchedUsers.map(u => u.username);
  const newlyTagged = taggedUsernames.filter(u => !alreadyTaggedUsers.includes(u));

  await Promise.all(newlyTagged.map(async (recipientUsername) => {
    try {
      const notification = new Notification({
        recipient_username: recipientUsername,
        type: 'mention',
        title: `${authorDisplayName} mentioned you in a post`,
        link: `/PostDetail?id=${postId}`,
        sender_username: authorUsername,
        sender_name: authorDisplayName,
        metadata: { post_id: postId },
      });
      await notification.save();
      fastify.io?.to(`user:${recipientUsername}`).emit('notification:new', notification);
      NotificationService.sendPushNotification(recipientUsername, notification, fastify);
    } catch (notifErr) {
      fastify.log.error(notifErr, 'Failed to create mention notification');
    }
  }));

  return taggedUsernames;
}

// Attaches is_liked / is_reposted flags and, for reposts, the original post
// they wrap, so the frontend can render "Reposted by X" without extra calls.
async function enrichPostsForViewer(posts: any[], effectiveUsername?: string | null) {
  const postIds = posts.map((p: any) => p._id.toString());

  const repostOfIds = [...new Set(posts.map((p: any) => p.repost_of).filter(Boolean))];
  const originalsMap = new Map<string, any>();
  if (repostOfIds.length > 0) {
    const originals = await Post.find({ _id: { $in: repostOfIds } }).lean({ virtuals: true });
    for (const original of originals as any[]) {
      originalsMap.set(original._id.toString(), { ...original, id: original._id.toString() });
    }
  }

  let userLikesSet = new Set<string>();
  let userRepostsSet = new Set<string>();
  if (effectiveUsername) {
    userLikesSet = await getLikesForTargets(effectiveUsername, 'post', postIds);
    const myReposts = await Post.find({ author_username: effectiveUsername.toLowerCase(), repost_of: { $in: postIds } })
      .select('repost_of')
      .lean();
    userRepostsSet = new Set(myReposts.map((r: any) => r.repost_of));
  }

  return posts.map((post: any) => {
    const id = post._id.toString();
    return {
      ...post,
      id,
      is_liked: userLikesSet.has(id),
      is_reposted: userRepostsSet.has(id),
      original_post: post.repost_of ? originalsMap.get(post.repost_of) || null : undefined,
    };
  });
}

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
        product_id,
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
      if (product_id) filter.tagged_products = product_id;
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

      // Get current user's likes/reposts in bulk for the fetched posts
      const user = request.user as any;
      const effectiveUsername = user?.username || user_username;

      const data = posts.length > 0 ? await enrichPostsForViewer(posts, effectiveUsername) : [];

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

      const query = request.query as any;
      const effectiveUsername = user?.username || query?.user_username;

      const [enriched] = await enrichPostsForViewer([post], effectiveUsername);
      return enriched;
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

      const authorDisplayName = userData.display_name || userData.username;

      const post = new Post({
        ...body,
        author_email: user.email,
        author_username: userData.username,
        author_name: authorDisplayName,
        author_avatar: userData.avatar_url,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        reposts_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      await post.save();

      try {
        post.tagged_users = await resolveAndNotifyMentions(
          body.content, userData.username, authorDisplayName, post._id.toString(), [], fastify
        );
        if (post.tagged_users.length > 0) await post.save();
      } catch (mentionErr) {
        fastify.log.error(mentionErr, 'Failed to process post mentions');
      }

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

      // If this post was itself a repost, give the original's count back
      if (post.repost_of) {
        await Post.findOneAndUpdate(
          { _id: post.repost_of, reposts_count: { $gt: 0 } },
          { $inc: { reposts_count: -1 } }
        );
      }

      // Deleting an original post removes any reposts that point to it
      await Post.deleteMany({ repost_of: id });

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

      // Filter counters and sensitive/derived fields from body
      const { likes_count, comments_count, shares_count, reposts_count, repost_of, tagged_users, author_username, author_email, ...safeBody } = body;

      // Capped at 3 to match the composer UI (see createPostSchema).
      if (Array.isArray(safeBody.tagged_products)) safeBody.tagged_products = safeBody.tagged_products.slice(0, 3);
      if (Array.isArray(safeBody.affiliate_links)) safeBody.affiliate_links = safeBody.affiliate_links.slice(0, 3);

      if (typeof safeBody.content === 'string') {
        try {
          safeBody.tagged_users = await resolveAndNotifyMentions(
            safeBody.content, user.username, user.display_name || user.username, id, post.tagged_users || [], fastify
          );
        } catch (mentionErr) {
          fastify.log.error(mentionErr, 'Failed to process post mentions on edit');
        }
      }

      return await Post.findByIdAndUpdate(id, safeBody, { new: true });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Repost — creates a new post in the reposter's feed that references the
  // original, with an optional quote caption.
  fastify.post('/:id/repost', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const body = (request.body as any) || {};

      const original = await Post.findById(id);
      if (!original || original.is_active === false) {
        return reply.code(404).send({ error: 'Post not found' });
      }
      if (original.repost_of) {
        return reply.code(400).send({ error: 'Cannot repost a repost' });
      }

      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      if (original.author_username === userData.username) {
        return reply.code(400).send({ error: 'You cannot repost your own post' });
      }

      const existing = await Post.findOne({ author_username: userData.username, repost_of: id });
      if (existing) {
        return reply.code(400).send({ error: 'Already reposted' });
      }

      const authorDisplayName = userData.display_name || userData.username;
      const content = typeof body.content === 'string' ? body.content.trim().slice(0, 2200) : '';

      const repost = new Post({
        content,
        media_urls: [],
        thumbnail_urls: [],
        media_type: 'text',
        tagged_products: [],
        tagged_users: [],
        affiliate_links: [],
        repost_of: id,
        visibility: 'public',
        author_email: user.email,
        author_username: userData.username,
        author_name: authorDisplayName,
        author_avatar: userData.avatar_url,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        reposts_count: 0,
      });
      await repost.save();

      const updatedOriginal = await Post.findByIdAndUpdate(
        id,
        { $inc: { reposts_count: 1 } },
        { new: true, select: 'reposts_count' }
      );

      if (content) {
        try {
          repost.tagged_users = await resolveAndNotifyMentions(
            content, userData.username, authorDisplayName, repost._id.toString(), [], fastify
          );
          await repost.save();
        } catch (mentionErr) {
          fastify.log.error(mentionErr, 'Failed to process repost mentions');
        }
      }

      try {
        const notification = new Notification({
          recipient_username: original.author_username,
          type: 'repost',
          title: `${authorDisplayName} reposted your post`,
          link: `/PostDetail?id=${repost._id}`,
          sender_username: userData.username,
          sender_name: authorDisplayName,
          metadata: { post_id: id, repost_id: repost._id },
        });
        await notification.save();
        fastify.io?.to(`user:${original.author_username}`).emit('notification:new', notification);
        NotificationService.sendPushNotification(original.author_username, notification, fastify);
      } catch (notifErr) {
        fastify.log.error(notifErr, 'Failed to create repost notification');
      }

      return reply.code(201).send({
        ...repost.toObject(),
        id: repost._id.toString(),
        reposts_count: updatedOriginal?.reposts_count ?? 1,
        is_reposted: true,
        original_post: { ...original.toObject(), id: original._id.toString() },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Undo a repost
  fastify.delete('/:id/repost', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const repost = await Post.findOneAndDelete({ author_username: user.username, repost_of: id });
      if (!repost) {
        return reply.code(404).send({ error: 'Repost not found' });
      }

      const updatedOriginal = await Post.findOneAndUpdate(
        { _id: id, reposts_count: { $gt: 0 } },
        { $inc: { reposts_count: -1 } },
        { new: true, select: 'reposts_count' }
      );

      return { status: 'unreposted', reposts_count: updatedOriginal?.reposts_count ?? 0, is_reposted: false };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
