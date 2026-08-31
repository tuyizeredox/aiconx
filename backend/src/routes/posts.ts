import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Post, IPost } from '../models/Post';
import { User } from '../models/User';
import { Follow } from '../models/Follow';
import { CommunityMember } from '../models/CommunityMember';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { z } from 'zod';
import { likeTarget, unlikeTarget, getLikesForTargets } from '../services/likeService';
import { Like } from '../models/Like';
import { Product } from '../models/Product';
import { AffiliateLink } from '../models/AffiliateLink';
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

// How many "liked by" faces a card shows. Mirrors the default on
// GET /likes/known-likers, which this replaces for the feed.
const KNOWN_LIKERS_LIMIT = 3;

function toObjectIds(ids: string[]) {
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

/**
 * Resolves everything a feed card renders, for a whole page of posts, in a
 * fixed number of queries.
 *
 * Each card used to fetch its own follow state, known likers, tagged products
 * and affiliate link. A ten-post page therefore opened forty to seventy round
 * trips, all of them competing with that same feed's images and video for the
 * browser's handful of connections - the posts appeared slowly and the video
 * in them started later still. None of that work is per-post in nature, so it
 * is batched here instead: the client renders a page from this one response.
 *
 * The added fields are additive. A client that predates them still works, and
 * still falls back to its own per-card requests (see PostCard).
 */
async function enrichPostsForViewer(posts: any[], effectiveUsername?: string | null) {
  const viewer = effectiveUsername ? String(effectiveUsername).toLowerCase() : null;

  const repostOfIds = [...new Set(posts.map((p: any) => p.repost_of).filter(Boolean))] as string[];
  const originalsMap = new Map<string, any>();
  if (repostOfIds.length > 0) {
    const originals = await Post.find({ _id: { $in: toObjectIds(repostOfIds) } }).lean({ virtuals: true });
    for (const original of originals as any[]) {
      originalsMap.set(original._id.toString(), original);
    }
  }

  // A repost renders its original's media, tags and counts, so the original is
  // the thing that has to be enriched. Both are collected and treated as one
  // set, then the resolved data is attached to whichever object the client
  // will actually read it off.
  const subjects: any[] = [...posts, ...originalsMap.values()];
  const subjectIds = [...new Set(subjects.map((p) => p._id.toString()))];

  /* ------------------------------------------------ viewer-relative state */

  let userLikesSet = new Set<string>();
  let userRepostsSet = new Set<string>();
  let followingSet = new Set<string>();

  if (viewer) {
    const [likes, myReposts, follows] = await Promise.all([
      getLikesForTargets(viewer, 'post', subjectIds),
      Post.find({ author_username: viewer, repost_of: { $in: subjectIds } }).select('repost_of').lean(),
      Follow.find({ follower_username: viewer, follow_type: 'user' }).select('following_username').lean(),
    ]);
    userLikesSet = likes;
    userRepostsSet = new Set((myReposts as any[]).map((r) => r.repost_of));
    followingSet = new Set((follows as any[]).map((f) => f.following_username).filter(Boolean));
  }

  /* ------------------------------------------------------------- products */

  // Only the first affiliate link is ever rendered on a card, so only the
  // first is resolved.
  const linkIds = [...new Set(subjects.map((p) => p.affiliate_links?.[0]).filter(Boolean))] as string[];
  const linksById = new Map<string, any>();
  if (linkIds.length > 0) {
    const links = await AffiliateLink.find({ _id: { $in: toObjectIds(linkIds) } }).lean();
    for (const link of links as any[]) {
      linksById.set(link._id.toString(), { ...link, id: link._id.toString() });
    }
  }

  const taggedIds = subjects.flatMap((p) => (p.tagged_products || []).filter(Boolean)) as string[];
  const affiliateProductIds = [...linksById.values()].map((l) => String(l.product_id)).filter(Boolean);
  const productIds = [...new Set([...taggedIds, ...affiliateProductIds])];

  const productsById = new Map<string, any>();
  if (productIds.length > 0) {
    const products = await Product.find({ _id: { $in: toObjectIds(productIds) } }).lean({ virtuals: true });
    for (const product of products as any[]) {
      productsById.set(product._id.toString(), { ...product, id: product._id.toString() });
    }
  }

  /* --------------------------------------------------------- known likers */

  // "Liked by @a, @b and 12 others". People the viewer follows come first; any
  // remaining slots are filled with the most-followed other likers, so a post
  // with no likes from the viewer's network still shows recognisable names.
  // Three queries for the whole page, rather than three per post.
  const knownLikersByPost = new Map<string, any[]>();
  if (viewer) {
    const likedIds = subjects.filter((p) => (p.likes_count || 0) > 0).map((p) => p._id.toString());

    if (likedIds.length > 0) {
      const likes = await Like.find({ target_type: 'post', target_id: { $in: likedIds } })
        .select('target_id user_username created_at')
        .sort({ created_at: -1 })
        .lean();

      const followed = new Map<string, string[]>();
      const strangersByPost = new Map<string, string[]>();
      for (const like of likes as any[]) {
        const username = like.user_username;
        if (!username || username === viewer) continue;
        const bucket = followingSet.has(username) ? followed : strangersByPost;
        const forPost = bucket.get(like.target_id) || [];
        if (forPost.length < 200 && !forPost.includes(username)) {
          forPost.push(username);
          bucket.set(like.target_id, forPost);
        }
      }

      // Rank the page's non-followed likers once, together, by follower count.
      const strangers = [...new Set([...strangersByPost.values()].flat())];
      const popularity = new Map<string, number>();
      if (strangers.length > 0) {
        const ranked = await Follow.aggregate([
          { $match: { following_username: { $in: strangers }, follow_type: 'user' } },
          { $group: { _id: '$following_username', follower_count: { $sum: 1 } } },
        ]);
        for (const row of ranked as any[]) popularity.set(row._id, row.follower_count);
      }

      const picked = new Map<string, string[]>();
      const allPicked = new Set<string>();
      for (const postId of likedIds) {
        const mine = (followed.get(postId) || []).slice(0, KNOWN_LIKERS_LIMIT);
        const remaining = KNOWN_LIKERS_LIMIT - mine.length;
        const fill = remaining > 0
          ? (strangersByPost.get(postId) || [])
              .slice()
              .sort((a, b) => (popularity.get(b) || 0) - (popularity.get(a) || 0))
              .slice(0, remaining)
          : [];
        const usernames = [...mine, ...fill];
        if (usernames.length === 0) continue;
        picked.set(postId, usernames);
        usernames.forEach((u) => allPicked.add(u));
      }

      if (allPicked.size > 0) {
        const users = await User.find({ username: { $in: [...allPicked] } })
          .select('username display_name avatar_url')
          .lean();
        const byUsername = new Map((users as any[]).map((u) => [u.username, u]));
        for (const [postId, usernames] of picked) {
          knownLikersByPost.set(postId, usernames.map((u) => byUsername.get(u)).filter(Boolean));
        }
      }
    }
  }

  /* --------------------------------------------------------------- attach */

  const decorate = (subject: any) => {
    const id = subject._id.toString();
    const link = linksById.get(subject.affiliate_links?.[0]) || null;
    const affiliateProduct = link?.product_id ? productsById.get(String(link.product_id)) || null : null;
    return {
      ...subject,
      id,
      is_liked: userLikesSet.has(id),
      is_reposted: userRepostsSet.has(id),
      is_following_author: viewer ? followingSet.has(subject.author_username) : false,
      tagged_products_data: (subject.tagged_products || [])
        .map((pid: string) => productsById.get(String(pid)))
        .filter(Boolean),
      affiliate_link_data: link,
      affiliate_product_data: affiliateProduct,
      known_likers: knownLikersByPost.get(id) || [],
    };
  };

  return posts.map((post: any) => {
    const original = post.repost_of ? originalsMap.get(post.repost_of) : null;
    return {
      ...decorate(post),
      original_post: post.repost_of ? (original ? decorate(original) : null) : undefined,
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
      // Shared links and crawlers put arbitrary strings on this route; an id
      // that is not an ObjectId is a miss, not a server error.
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.code(404).send({ error: 'Post not found' });
      }
      const post = await Post.findById(id).lean({ virtuals: true }) as any;

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      const user = request.user as any;
      const isAuthor = !!user?.username && user.username === post.author_username;
      const isAdmin = user?.role === 'super_admin';

      if (post.is_active === false && !isAuthor && !isAdmin) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      // A restricted post is reachable by id even though the feed never lists
      // it, so the audience is enforced here too. This is checked against the
      // *authenticated* identity only: `user_username` below is a caller-
      // supplied hint for personalising like/repost flags, and trusting it
      // here would let anyone read a follower-only post by naming one of the
      // author's followers. Link previews (api/og.js) fetch anonymously, which
      // is what keeps a private post out of a WhatsApp card.
      if (!isAuthor && !isAdmin && post.visibility && post.visibility !== 'public') {
        const viewer = user?.username;
        let permitted = false;

        if (viewer) {
          if (post.visibility === 'followers') {
            permitted = !!(await Follow.exists({
              follower_username: viewer,
              following_username: post.author_username,
              follow_type: 'user',
            }));
          } else if (post.visibility === 'community') {
            permitted = !!post.community_id && !!(await CommunityMember.exists({
              community_id: String(post.community_id),
              member_username: viewer,
            }));
          }
        }

        // 404 rather than 403: whether a restricted post exists at all is
        // itself something only its audience should be able to learn.
        if (!permitted) {
          return reply.code(404).send({ error: 'Post not found' });
        }
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
