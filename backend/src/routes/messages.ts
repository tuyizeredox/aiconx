import { FastifyInstance } from 'fastify';
import { Message, IMessage } from '../models/Message';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { checkPaymentSolicitation } from '../utils/chatSafety';
import { z } from 'zod';

const sendMessageSchema = z.object({
  conversation_id: z.string().optional(),
  recipient_username: z.string().min(1),
  content: z.string().min(1),
  message_type: z.enum(['text', 'image', 'product_share', 'order_update', 'offer']).default('text'),
  image_url: z.string().optional(),
  product_id: z.string().optional(),
  product_data: z.object({
    title: z.string(),
    price: z.number(),
    image: z.string().optional(),
  }).optional(),
  offer_amount: z.number().optional(),
  order_id: z.string().nullable().optional(),
  reply_to_content: z.string().optional(),
  reply_to_name: z.string().optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  // List messages with filtering (for sender/receiver queries)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const query = request.query as any;
      const { 
        sender_username, receiver_username,
        sort = '-created_at', limit = 50, skip = 0 
      } = query;
      const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 50);
      const parsedSkip = Math.max(parseInt(skip) || 0, 0);

      // Build filter
      const filter: any = {};
      
      if (sender_username) filter.sender_username = sender_username;
      if (receiver_username) filter.receiver_username = receiver_username;
      
      // If none is provided, default to current user's messages
      if (!sender_username && !receiver_username) {
        filter.$or = [
          { sender_username: user.username },
          { receiver_username: user.username }
        ];
      }

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const messages = await Message.find(filter)
        .sort(sortObj)
        .limit(parsedLimit)
        .skip(parsedSkip)
        .select('conversation_id sender_username sender_name receiver_username content message_type image_url product_id product_data offer_amount order_id reply_to_content reply_to_name is_read read_at is_edited is_pinned created_at')
        .lean();

      const total = await Message.countDocuments(filter);

      return {
        data: messages,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // List conversations
  fastify.get('/conversations', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      
      // Aggregate to get unique conversations with last message
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender_username: user.username },
              { receiver_username: user.username }
            ],
            deleted_for: { $ne: user.username }
          }
        },
        {
          $sort: { created_at: -1 }
        },
        {
          $group: {
            _id: "$conversation_id",
            last_message_content: { $first: "$content" },
            last_message_at: { $first: "$created_at" },
            last_message_type: { $first: "$message_type" },
            other_user_username: { 
              $first: {
                $cond: [{ $eq: ["$sender_username", user.username] }, "$receiver_username", "$sender_username"]
              }
            },
            unread_count: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ["$receiver_username", user.username] },
                    { $eq: ["$is_read", false] }
                  ]},
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $sort: { last_message_at: -1 }
        }
      ]);

      // Populate other user's info with a single batch query
      const otherUsernames = conversations.map(c => c.other_user_username);
      const otherUsers = await User.find(
        { username: { $in: otherUsernames } },
        'display_name avatar_url username'
      ).lean();
      
      const userMap = otherUsers.reduce((acc: any, u) => {
        acc[u.username] = u;
        return acc;
      }, {});
      
      const populatedConversations = conversations.map((conv) => {
        const otherUser = userMap[conv.other_user_username];
        return {
          ...conv,
          other_user_name: otherUser?.display_name || otherUser?.username || conv.other_user_username,
          other_user_avatar: otherUser?.avatar_url,
          // Keep the aggregated username even if the account was deleted/renamed,
          // so the conversation stays openable/deletable instead of turning into undefined.
          other_user_username: otherUser?.username || conv.other_user_username
        };
      });

      return populatedConversations;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get messages for conversation
  fastify.get('/:conversationId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user as any;
      const messages = await Message.find({
        conversation_id: conversationId,
        deleted_for: { $ne: user.username }
      })
        .sort({ created_at: 1 })
        .lean();

      return messages;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Send message
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = sendMessageSchema.parse(request.body);

      // Offers are a structured, in-app feature (numeric amount tied to an order),
      // not free-form text soliciting off-platform payment, so they're exempt from
      // the anti-solicitation heuristic below.
      if (body.message_type !== 'offer') {
        const safetyCheck = checkPaymentSolicitation(body.content);
        if (safetyCheck.blocked) {
          return reply.code(400).send({
            error: 'Message blocked',
            message: "For your safety, payment details and off-platform payment requests can't be sent in chat. All purchases go through checkout.",
          });
        }
      }

      // If no conversation_id, create one from both usernames
      const usernames = [user.username, body.recipient_username].sort();
      const conversationId = body.conversation_id || `chat_${usernames[0]}_${usernames[1]}`;

      // Fetch full user data to get display_name
      const userData = await User.findOne({ email: user.email }).lean();
      if (!userData) {
        return reply.code(400).send({ error: 'User not found' });
      }

      const message = new Message({
        ...body,
        conversation_id: conversationId,
        sender_username: user.username,
        sender_name: userData.display_name || user.username,
        receiver_username: body.recipient_username,
        created_at: new Date(),
        updated_at: new Date()
      });

      await message.save();

      // Increment recipient's unread count
      if (body.recipient_username) {
        await User.updateOne(
          { username: body.recipient_username },
          { $inc: { unread_messages_count: 1 } }
        );
      }
      
// Emit real-time event via Socket.IO if available
      if (body.recipient_username) {
        fastify.io?.to(`user:${body.recipient_username}`).emit('new-message', message.toObject());
        fastify.io?.to(`user:${body.recipient_username}`).emit('chat:new', message.toObject());
      }

      try {
        if (body.recipient_username && body.recipient_username !== user.username) {
          const senderName = user.display_name || user.username;
          const newMessage = new Notification({
            recipient_username: body.recipient_username,
            type: body.message_type === 'offer' ? 'offer' : 'message',
            title: body.message_type === 'offer' ? 'New Offer Received' : `New message from ${senderName}`,
            body: message.content?.substring(0, 100) || '',
            link: `/Chat`,
            sender_username: user.username,
            sender_name: senderName,
            metadata: {
              conversation_id: conversationId,
              message_id: message._id,
              message_type: body.message_type
            }
          });
          await newMessage.save();
          fastify.io?.to(`user:${body.recipient_username}`).emit('notification:new', newMessage);
          NotificationService.sendPushNotification(body.recipient_username, newMessage, fastify);
        }
      } catch (notifErr: any) {
        fastify.log.error(notifErr, 'Failed to create message notification');
      }

      // Invalidate conversation cache for both parties
      fastify.io?.to(`user:${body.recipient_username}`).emit('conversation:update', {
        conversation_id: message.conversation_id,
        last_message_content: message.content,
        last_message_at: message.created_at,
        last_message_type: message.message_type
      });
      fastify.io?.to(`user:${user.username}`).emit('conversation:update', {
        conversation_id: message.conversation_id,
        last_message_content: message.content,
        last_message_at: message.created_at,
        last_message_type: message.message_type
      });

      return message;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update message (e.g., mark as read)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const updateData = request.body as any;

      const message = await Message.findOneAndUpdate(
        { _id: id, $or: [{ receiver_username: user.username }, { sender_username: user.username }] },
        { ...updateData, updated_at: new Date() },
        { new: true }
      );

      if (!message) {
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

      return message;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark message as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const message = await Message.findOneAndUpdate(
        { _id: id, receiver_username: user.username, is_read: false },
        { is_read: true, read_at: new Date(), updated_at: new Date() },
        { new: true }
      );

      if (!message) {
        // Check if message exists but is already read
        const existingMessage = await Message.findOne({ _id: id, receiver_username: user.username });
        if (existingMessage) {
          return existingMessage;
        }
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

      // Decrement user's unread count (clamped at 0 to avoid violating the schema's min constraint)
      await User.updateOne(
        { username: user.username },
        [{ $set: { unread_messages_count: { $max: [0, { $subtract: ['$unread_messages_count', 1] }] } } }]
      );

      return message;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark all messages in a conversation as read
  fastify.patch('/conversation/:conversationId/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user as any;

      const result = await Message.updateMany(
        { conversation_id: conversationId, receiver_username: user.username, is_read: false },
        { is_read: true, read_at: new Date(), updated_at: new Date() }
      );

      if (result.modifiedCount > 0) {
        // Decrement user's unread count by the number of messages marked as read (clamped at 0)
        await User.updateOne(
          { username: user.username },
          [{ $set: { unread_messages_count: { $max: [0, { $subtract: ['$unread_messages_count', result.modifiedCount] }] } } }]
        );
      }

      return { success: true, count: result.modifiedCount };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete message
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const message = await Message.findOne({
        _id: id,
        $or: [
          { sender_username: user.username },
          { receiver_username: user.username }
        ]
      });

      if (!message) {
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

      const wasUnread = !message.is_read;

      await Message.deleteOne({ _id: id });

      if (wasUnread) {
        // Decrement recipient's count (could be me OR the other user), clamped at 0
        await User.updateOne(
          { username: message.receiver_username },
          [{ $set: { unread_messages_count: { $max: [0, { $subtract: ['$unread_messages_count', 1] }] } } }]
        );
      }

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Delete a conversation (hides it for the current user only; the other party keeps their history)
  fastify.delete('/conversation/:conversationId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user as any;

      const unreadCount = await Message.countDocuments({
        conversation_id: conversationId,
        receiver_username: user.username,
        is_read: false,
        deleted_for: { $ne: user.username }
      });

      const result = await Message.updateMany(
        {
          conversation_id: conversationId,
          $or: [
            { sender_username: user.username },
            { receiver_username: user.username }
          ]
        },
        { $addToSet: { deleted_for: user.username } }
      );

      if (unreadCount > 0) {
        await User.updateOne(
          { username: user.username },
          [{ $set: { unread_messages_count: { $max: [0, { $subtract: ['$unread_messages_count', unreadCount] }] } } }]
        );
      }

      return { success: true, count: result.modifiedCount };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}
