import { FastifyInstance } from 'fastify';
import { User } from '../models/User';
import { INotification } from '../models/Notification';

type NotificationPreference = 'notif_sales' | 'notif_msg' | 'notif_follow' | 'notif_live';

function typeToPreference(type: string): NotificationPreference | null {
  switch (type) {
    case 'follow':
      return 'notif_follow';
    case 'message':
    case 'offer':
      return 'notif_msg';
    case 'order_update':
      return 'notif_sales';
    case 'live':
      return 'notif_live';
    default:
      return null;
  }
}

export async function shouldSendNotification(username: string, type: string): Promise<boolean> {
  const preferenceKey = typeToPreference(type);
  if (!preferenceKey) {
    return true;
  }

  const user = await User.findOne({ username }).select('notifications');
  const preferences = user?.notifications;

  if (!preferences) {
    return true;
  }

  return (preferences as Record<string, boolean> | undefined)?.[preferenceKey] !== false;
}

export class NotificationService {
  /**
   * Send a push notification to a user's registered devices.
   * This is a placeholder for actual FCM/APNS implementation.
   */
  static async sendPushNotification(recipientUsername: string, notification: INotification, fastify: FastifyInstance) {
    try {
      if (!(await shouldSendNotification(recipientUsername, notification.type))) {
        return;
      }

      const user = await User.findOne({ username: recipientUsername.toLowerCase() }).select('push_tokens');
      
      if (!user || !user.push_tokens || user.push_tokens.length === 0) {
        return;
      }

      fastify.log.info({ 
        recipient: recipientUsername, 
        tokens_count: user.push_tokens.length,
        type: notification.type 
      }, 'Preparing to send push notification');

      // TODO: Integrate with FCM (Firebase Cloud Messaging)
      // Example implementation with a generic push service:
      /*
      const message = {
        notification: {
          title: notification.title,
          body: notification.body || '',
        },
        data: {
          type: notification.type,
          link: notification.link || '',
          ...notification.metadata
        },
        tokens: user.push_tokens
      };
      
      await fcm.sendMulticast(message);
      */

      fastify.log.info(`[MOCK PUSH] Sent to ${recipientUsername}: ${notification.title}`);
    } catch (error) {
      fastify.log.error(error, 'Error sending push notification');
    }
  }

  /**
   * Helper to send push notifications to multiple users in bulk
   */
  static async sendBulkPushNotifications(recipientUsernames: string[], notificationData: Partial<INotification>, fastify: FastifyInstance) {
    try {
      const users = await User.find({ 
        username: { $in: recipientUsernames.map(u => u.toLowerCase()) },
        push_tokens: { $exists: true, $not: { $size: 0 } }
      }).select('username push_tokens');

      if (users.length === 0) return;

      fastify.log.info({ 
        users_count: users.length,
        type: notificationData.type 
      }, 'Preparing to send bulk push notifications');

      // Group tokens for bulk sending if supported by provider
      // const allTokens = users.flatMap(u => u.push_tokens || []);
      
      // For now, we'll just log
      for (const user of users) {
        fastify.log.info(`[MOCK PUSH] Sent to ${user.username}: ${notificationData.title}`);
      }
    } catch (error) {
      fastify.log.error(error, 'Error sending bulk push notifications');
    }
  }
}
