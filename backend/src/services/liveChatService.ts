import { LiveChatMessage, ILiveChatMessage } from '../models/LiveChatMessage';
import { LiveSession } from '../models/LiveSession';
import { io } from '../websocket/socket';
import { Report } from '../models/Report';

// Simple rate limiter storage
const messageCooldowns = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 message per second

// Cleanup old cooldowns every minute
setInterval(() => {
  const now = Date.now();
  for (const [username, lastTs] of messageCooldowns.entries()) {
    if (now - lastTs > RATE_LIMIT_MS * 10) {
      messageCooldowns.delete(username);
    }
  }
}, 60000);

// Basic profanity list (expand as needed)
const BANNED_WORDS = ['badword1', 'badword2', 'spam'];

export class LiveChatService {
  /**
   * Filter profanity
   */
  static filterProfanity(content: string): string {
    let filtered = content;
    for (const word of BANNED_WORDS) {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }

  /**
   * Send a chat message
   */
  static async sendMessage(data: {
    session_id: string;
    user_username: string;
    user_name?: string;
    content: string;
    message_type?: ILiveChatMessage['message_type'];
    product_id?: string;
    product_title?: string;
    reply_to?: string;
  }) {
    // Rate limit check
    const now = Date.now();
    const lastMessage = messageCooldowns.get(data.user_username) || 0;
    if (now - lastMessage < RATE_LIMIT_MS) {
      throw new Error('You are sending messages too fast');
    }
    messageCooldowns.set(data.user_username, now);

    // Check if user is banned
    const session = await LiveSession.findById(data.session_id);
    if (!session) throw new Error('Session not found');
    
    if (session.banned_users.includes(data.user_username.toLowerCase())) {
      throw new Error('You are banned from this chat');
    }

    // Filter profanity
    const filteredContent = this.filterProfanity(data.content);

    const message = new LiveChatMessage({
      ...data,
      content: filteredContent,
      message_type: data.message_type || 'chat'
    });

    await message.save();

    // Emit to socket
    io?.to(`live-session-${data.session_id}`).emit('live-chat-message', {
      message: message.toObject(),
      session_id: data.session_id
    });

    return message;
  }

  /**
   * Pin or unpin a message
   */
  static async togglePinMessage(messageId: string, moderatorUsername: string, pin: boolean) {
    const message = await LiveChatMessage.findById(messageId);
    if (!message) throw new Error('Message not found');

    const session = await LiveSession.findById(message.session_id);
    if (!session) throw new Error('Session not found');

    // Check if authorized (host or moderator)
    const isAuthorized = 
      session.host_username === moderatorUsername || 
      session.moderators.includes(moderatorUsername.toLowerCase());
    
    if (!isAuthorized) throw new Error('Unauthorized to pin messages');

    message.is_pinned = pin;
    await message.save();

    // Send system message about pinning
    await this.sendMessage({
      session_id: message.session_id,
      user_username: 'system',
      user_name: 'System',
      content: `Message ${pin ? 'pinned' : 'unpinned'}`,
      message_type: pin ? 'pin' : 'unpin'
    });

    // Emit update
    io?.to(`live-session-${message.session_id}`).emit('live-chat-message-updated', {
      message_id: messageId,
      session_id: message.session_id,
      updates: { is_pinned: pin }
    });

    return message;
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId: string, username: string) {
    const message = await LiveChatMessage.findById(messageId);
    if (!message) throw new Error('Message not found');

    const session = await LiveSession.findById(message.session_id);
    if (!session) throw new Error('Session not found');

    // Check if authorized (author, host, or moderator)
    const isAuthor = message.user_username === username;
    const isHost = session.host_username === username;
    const isModerator = session.moderators.includes(username.toLowerCase());

    if (!isAuthor && !isHost && !isModerator) {
      throw new Error('Unauthorized to delete this message');
    }

    message.is_deleted = true;
    message.deleted_by = username;
    await message.save();

    // Emit deletion
    io?.to(`live-session-${message.session_id}`).emit('live-chat-message-deleted', {
      message_id: messageId,
      session_id: message.session_id,
      deleted_by: isHost || isModerator ? 'moderator' : 'author'
    });

    return message;
  }

  /**
   * Like a message
   */
  static async likeMessage(messageId: string, username: string) {
    const message = await LiveChatMessage.findOneAndUpdate(
      { 
        _id: messageId, 
        is_deleted: false,
        liked_by: { $ne: username.toLowerCase() }
      },
      { 
        $inc: { likes_count: 1 },
        $addToSet: { liked_by: username.toLowerCase() }
      },
      { new: true }
    );

    if (!message) {
      const existing = await LiveChatMessage.findById(messageId);
      if (!existing) throw new Error('Message not found');
      if (existing.is_deleted) throw new Error('Message is deleted');
      throw new Error('You already liked this message');
    }

    // Emit like event
    io?.to(`live-session-${message.session_id}`).emit('live-chat-message-liked', {
      message_id: messageId,
      session_id: message.session_id,
      likes_count: message.likes_count
    });

    return message;
  }

  /**
   * Ban or unban a user
   */
  static async toggleBanUser(sessionId: string, moderatorUsername: string, targetUsername: string, ban: boolean) {
    const session = await LiveSession.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Only host or moderator can ban
    const isHost = session.host_username === moderatorUsername;
    const isModerator = session.moderators.includes(moderatorUsername.toLowerCase());
    
    if (!isHost && !isModerator) throw new Error('Unauthorized to ban users');

    // Hierarchy guards
    const targetLower = targetUsername.toLowerCase();
    if (targetLower === session.host_username.toLowerCase()) {
      throw new Error('Cannot ban the session host');
    }

    if (session.moderators.includes(targetLower) && !isHost) {
      throw new Error('Only the host can ban a moderator');
    }

    const update = ban 
      ? { $addToSet: { banned_users: targetLower } }
      : { $pull: { banned_users: targetLower } };

    await LiveSession.findByIdAndUpdate(sessionId, update);

    // Emit ban event
    io?.to(`live-session-${sessionId}`).emit('user-chat-ban-status', {
      session_id: sessionId,
      username: targetUsername,
      is_banned: ban
    });

    // Send system message
    await this.sendMessage({
      session_id: sessionId,
      user_username: 'system',
      user_name: 'System',
      content: `User ${targetUsername} has been ${ban ? 'banned' : 'unbanned'} from chat`,
      message_type: 'system'
    });
  }

  /**
   * Report a message
   */
  static async reportMessage(messageId: string, reporterId: string, reason: string, description?: string) {
    const message = await LiveChatMessage.findById(messageId);
    if (!message) throw new Error('Message not found');

    const report = new Report({
      reporter_id: reporterId,
      target_id: messageId,
      target_type: 'live_chat_message',
      reason,
      description: description || `Reported message from ${message.user_username}: ${message.content}`
    });

    await report.save();
    return report;
  }
}
