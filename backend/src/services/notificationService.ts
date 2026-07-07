import { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { User } from '../models/User';
import { INotification } from '../models/Notification';

type NotificationPreference = 'notif_sales' | 'notif_msg' | 'notif_follow' | 'notif_live';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@vetora.app';

const webPushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (webPushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY as string, VAPID_PRIVATE_KEY as string);
} else {
  console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — web push notifications are disabled.');
}

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

/**
 * Deliver a web push payload to a single subscription, removing it from the
 * user's record if the push service reports it as gone (410/404).
 */
async function deliverWebPush(
  username: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  fastify: FastifyInstance
) {
  try {
    await webpush.sendNotification(subscription as any, payload);
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await User.updateOne(
        { username },
        { $pull: { push_subscriptions: { endpoint: subscription.endpoint } } }
      );
    } else {
      fastify.log.error(error, 'Error delivering web push notification');
    }
  }
}

function buildPushPayload(notification: Partial<INotification>) {
  return JSON.stringify({
    title: notification.title,
    body: notification.body || '',
    link: notification.link || '/',
    type: notification.type,
    ...notification.metadata,
  });
}

export class NotificationService {
  /**
   * Send a push notification to all of a user's registered devices
   * (web push subscriptions). Respects the recipient's notification preferences.
   */
  static async sendPushNotification(recipientUsername: string, notification: INotification, fastify: FastifyInstance) {
    try {
      if (!webPushEnabled) return;
      if (!(await shouldSendNotification(recipientUsername, notification.type))) {
        return;
      }

      const user = await User.findOne({ username: recipientUsername.toLowerCase() }).select('push_subscriptions');

      if (!user || !user.push_subscriptions || user.push_subscriptions.length === 0) {
        return;
      }

      const payload = buildPushPayload(notification);

      await Promise.all(
        user.push_subscriptions.map((subscription) =>
          deliverWebPush(user.username, subscription as any, payload, fastify)
        )
      );

      fastify.log.info(
        { recipient: recipientUsername, devices: user.push_subscriptions.length, type: notification.type },
        'Push notification delivered'
      );
    } catch (error) {
      fastify.log.error(error, 'Error sending push notification');
    }
  }

  /**
   * Helper to send push notifications to multiple users in bulk
   */
  static async sendBulkPushNotifications(recipientUsernames: string[], notificationData: Partial<INotification>, fastify: FastifyInstance) {
    try {
      if (!webPushEnabled) return;

      const eligibleUsernames = (
        await Promise.all(
          recipientUsernames.map(async (username) => ((await shouldSendNotification(username, notificationData.type || '')) ? username : null))
        )
      ).filter((username): username is string => Boolean(username));

      if (eligibleUsernames.length === 0) return;

      const users = await User.find({
        username: { $in: eligibleUsernames.map(u => u.toLowerCase()) },
        push_subscriptions: { $exists: true, $not: { $size: 0 } }
      }).select('username push_subscriptions');

      if (users.length === 0) return;

      const payload = buildPushPayload(notificationData);

      await Promise.all(
        users.flatMap((user) =>
          (user.push_subscriptions || []).map((subscription) =>
            deliverWebPush(user.username, subscription as any, payload, fastify)
          )
        )
      );

      fastify.log.info({ users_count: users.length, type: notificationData.type }, 'Bulk push notifications delivered');
    } catch (error) {
      fastify.log.error(error, 'Error sending bulk push notifications');
    }
  }
}
