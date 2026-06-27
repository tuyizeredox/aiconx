import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Comment, IComment } from '../models/Comment';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Notification } from '../models/Notification';
import { likeTarget, unlikeTarget, getLikesForTargets } from '../services/likeService';

export async function commentRoutes(fastify: FastifyInstance) {
  // List comments for a post with pagination
  fastify.get('/', {
    preHandler: [fastify.authenticateOptional]
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        post_id,
        parent_comment_id,
        author_username,
        user_username,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (post_id) filter.post_id = post_id;
      if (parent_comment_id !== undefined) {
        if (parent_comment_id) {
          filter.parent_comment_id = parent_comment_id;
        } else {
          filter.parent_comment_id = { $exists: false };
        }
      }
      if (author_username) filter.author_username = author_username;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const comments = await Comment
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      // Fetch user avatars for all comment authors
      const authorUsernames = [...new Set(comments.map((c: any) => c.author_username))];
      const users = await User.find({ username: { $in: authorUsernames } })
        .select('username avatar_url')
        .lean();
      
      const userAvatarMap = users.reduce((acc: any, user: any) => {
        acc[user.username] = user.avatar_url;
        return acc;
      }, {});

      // Update comments with current avatar URLs
      const commentsWithAvatars = comments.map((comment: any) => ({
        ...comment,
        author_avatar: userAvatarMap[comment.author_username] || comment.author_avatar
      }));

      const total = await Comment.countDocuments(filter);

      // Add is_liked field
      const user = request.user as any;
      const effectiveUsername = user?.username || user_username;
      let userLikesSet = new Set<string>();

      if (effectiveUsername && typeof effectiveUsername === 'string') {
        const commentIds = commentsWithAvatars.map((c: any) => c._id.toString());
        userLikesSet = await getLikesForTargets(effectiveUsername, 'comment', commentIds);
      }

      const commentsWithLikeStatus = commentsWithAvatars.map((comment: any) => ({
        ...comment,
        id: comment._id.toString(),
        is_liked: userLikesSet.has(comment._id.toString())
      }));

      reply.send({
        comments: commentsWithLikeStatus,
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

  // Get comment by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      reply.send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create comment
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IComment>;
      const user = request.user as any;

      // Validate required fields
      if (!body.post_id || !body.content) {
        return reply.code(400).send({ error: 'Missing required fields: post_id, content' });
      }

      // Fetch full user data to get display_name and avatar_url
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      const comment = new Comment({
        ...body,
        author_username: userData.username,
        author_name: userData.display_name || userData.username,
        author_avatar: userData.avatar_url,
      });

      await comment.save();

      // Increment comments count on post if it's a top-level comment or directly on a post
      if (body.post_id) {
        await Post.findByIdAndUpdate(body.post_id, { $inc: { comments_count: 1 } });
      }

      // Emit real-time event
      fastify.io?.emit('comment:created', {
        comment: comment.toObject(),
        post_id: body.post_id
      });

      try {
        const post = await Post.findById(body.post_id).select('author_username').lean();
        const postAuthor = post?.author_username;

        if (postAuthor && postAuthor !== userData.username) {
          const postAuthorUser = await User.findOne({ username: postAuthor }).select('display_name').lean();
          const displayName = postAuthorUser?.display_name || postAuthor;
          const commentNotification = new Notification({
            recipient_username: postAuthor,
            type: 'comment',
            title: `${displayName}, ${userData.display_name || userData.username} commented on your post`,
            body: comment.content?.substring(0, 100) || '',
            link: `/PostDetail?id=${body.post_id}`,
            sender_username: userData.username,
            sender_name: userData.display_name || userData.username,
            metadata: {
              post_id: body.post_id,
              comment_id: comment._id,
              parent_comment_id: body.parent_comment_id || null
            }
          });
          await commentNotification.save();
          fastify.io?.to(`user:${postAuthor}`).emit('notification:new', commentNotification);
        }

        if (body.parent_comment_id) {
          const parentComment = await Comment.findById(body.parent_comment_id).select('author_username').lean();
          const parentAuthor = parentComment?.author_username;
          if (parentAuthor && parentAuthor !== userData.username && parentAuthor !== postAuthor) {
            const parentAuthorUser = await User.findOne({ username: parentAuthor }).select('display_name').lean();
            const parentDisplayName = parentAuthorUser?.display_name || parentAuthor;
            const replyNotification = new Notification({
              recipient_username: parentAuthor,
              type: 'comment',
              title: `${parentDisplayName}, ${userData.display_name || userData.username} replied to your comment`,
              body: comment.content?.substring(0, 100) || '',
              link: `/PostDetail?id=${body.post_id}`,
              sender_username: userData.username,
              sender_name: userData.display_name || userData.username,
              metadata: {
                post_id: body.post_id,
                comment_id: comment._id,
                parent_comment_id: body.parent_comment_id
              }
            });
            await replyNotification.save();
            fastify.io?.to(`user:${parentAuthor}`).emit('notification:new', replyNotification);
          }
        }
      } catch (notifErr) {
        fastify.log.error(notifErr, 'Failed to create comment notification');
      }

      reply.code(201).send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update comment
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IComment>;
      const user = request.user as any;

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Check if user owns the comment
      const isOwner = comment.author_username === user.username;
      if (!isOwner) {
        return reply.code(403).send({ error: 'You can only update your own comments' });
      }

      // Update allowed fields
      const allowedUpdates = ['content'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IComment;
        if (body[key] !== undefined) {
          (comment as any)[key] = body[key];
        }
      });

      await comment.save();

      // Emit real-time event
      fastify.io?.emit('comment:updated', {
        comment: comment.toObject(),
        post_id: comment.post_id
      });

      reply.send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete comment
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Check if user owns the comment
      const isOwner = comment.author_username === user.username;
      if (!isOwner) {
        return reply.code(403).send({ error: 'You can only delete your own comments' });
      }

      // Delete the comment and all its replies
      const deletedCount = await Comment.countDocuments({
        $or: [
          { _id: id },
          { parent_comment_id: id }
        ]
      });

      await Comment.deleteMany({
        $or: [
          { _id: id },
          { parent_comment_id: id }
        ]
      });

      // Decrement comments count on post
      if (comment.post_id) {
        await Post.findByIdAndUpdate(comment.post_id, { $inc: { comments_count: -deletedCount } });
      }

      // Emit real-time event
      fastify.io?.emit('comment:deleted', {
        comment_id: id,
        post_id: comment.post_id
      });

      reply.send({ message: 'Comment and replies deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get comment thread (comment + all replies)
  fastify.get('/:id/thread', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Get all replies
      const replies = await Comment
        .find({ parent_comment_id: id })
        .sort({ created_at: 1 })
        .lean({ virtuals: true });

      // Fetch user avatars for all comment authors (parent + replies)
      const authorUsernames = [...new Set([
        comment.author_username,
        ...replies.map((r: any) => r.author_username)
      ])];
      
      const users = await User.find({ username: { $in: authorUsernames } })
        .select('username avatar_url')
        .lean();
      
      const userAvatarMap = users.reduce((acc: any, user: any) => {
        acc[user.username] = user.avatar_url;
        return acc;
      }, {});

      // Update comment and replies with current avatar URLs
      const commentWithAvatar = {
        ...comment.toObject(),
        author_avatar: userAvatarMap[comment.author_username] || comment.author_avatar
      };

      const repliesWithAvatars = replies.map((reply: any) => ({
        ...reply,
        author_avatar: userAvatarMap[reply.author_username] || reply.author_avatar
      }));

      reply.send({
        comment: commentWithAvatar,
        replies: repliesWithAvatars,
        total_replies: replies.length
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}