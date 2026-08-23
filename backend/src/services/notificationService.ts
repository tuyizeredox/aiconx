import { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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

// Native push (Android/iOS apps via Capacitor) delivered through Firebase Cloud Messaging.
let fcmEnabled = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    fcmEnabled = true;
  } catch (error) {
    console.error('⚠️  Failed to initialize firebase-admin from FIREBASE_SERVICE_ACCOUNT_JSON — native push disabled.', error);
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set — native (FCM) push notifications are disabled.');
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

const INVALID_FCM_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

/**
 * Deliver a native push via FCM to every token on file for a user, pruning
 * any tokens Firebase reports as invalid/unregistered.
 */
async function deliverFcmPush(
  username: string,
  tokens: string[],
  notification: Partial<INotification>,
  fastify: FastifyInstance
) {
  if (!fcmEnabled || tokens.length === 0) return;

  const dataPayload: Record<string, string> = {
    link: notification.link || '/',
    type: notification.type || '',
    ...Object.fromEntries(
      Object.entries(notification.metadata || {}).map(([key, value]) => [key, String(value)])
    ),
  };

  try {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body || '',
      },
      data: dataPayload,
    });

    const staleTokens = response.responses
      .map((res, idx: number) => (!res.success && INVALID_FCM_TOKEN_CODES.has(res.error?.code || '') ? tokens[idx] : null))
      .filter((token): token is string => Boolean(token));

    if (staleTokens.length > 0) {
      await User.updateOne({ username }, { $pull: { push_tokens: { $in: staleTokens } } });
    }
  } catch (error) {
    fastify.log.error(error, 'Error delivering FCM push notification');
  }
}

export class NotificationService {
  /**
   * Send a push notification to all of a user's registered devices
   * (web push subscriptions). Respects the recipient's notification preferences.
   */
  static async sendPushNotification(recipientUsername: string, notification: INotification, fastify: FastifyInstance) {
    try {
      if (!webPushEnabled && !fcmEnabled) return;
      if (!(await shouldSendNotification(recipientUsername, notification.type))) {
        return;
      }

      const user = await User.findOne({ username: recipientUsername.toLowerCase() }).select('push_subscriptions push_tokens');

      if (!user) return;

      const hasWebPush = webPushEnabled && user.push_subscriptions && user.push_subscriptions.length > 0;
      const hasNativePush = fcmEnabled && user.push_tokens && user.push_tokens.length > 0;

      if (!hasWebPush && !hasNativePush) return;

      const payload = buildPushPayload(notification);

      await Promise.all([
        ...(hasWebPush
          ? user.push_subscriptions!.map((subscription) =>
              deliverWebPush(user.username, subscription as any, payload, fastify)
            )
          : []),
        ...(hasNativePush ? [deliverFcmPush(user.username, user.push_tokens!, notification, fastify)] : []),
      ]);

      fastify.log.info(
        {
          recipient: recipientUsername,
          webDevices: user.push_subscriptions?.length || 0,
          nativeDevices: user.push_tokens?.length || 0,
          type: notification.type,
        },
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
      if (!webPushEnabled && !fcmEnabled) return;

      const eligibleUsernames = (
        await Promise.all(
          recipientUsernames.map(async (username) => ((await shouldSendNotification(username, notificationData.type || '')) ? username : null))
        )
      ).filter((username): username is string => Boolean(username));

      if (eligibleUsernames.length === 0) return;

      const users = await User.find({
        username: { $in: eligibleUsernames.map(u => u.toLowerCase()) },
        $or: [
          { push_subscriptions: { $exists: true, $not: { $size: 0 } } },
          { push_tokens: { $exists: true, $not: { $size: 0 } } },
        ],
      }).select('username push_subscriptions push_tokens');

      if (users.length === 0) return;

      const payload = buildPushPayload(notificationData);

      await Promise.all([
        ...users.flatMap((user) =>
          (user.push_subscriptions || []).map((subscription) =>
            deliverWebPush(user.username, subscription as any, payload, fastify)
          )
        ),
        ...(fcmEnabled
          ? users
              .filter((user) => user.push_tokens && user.push_tokens.length > 0)
              .map((user) => deliverFcmPush(user.username, user.push_tokens!, notificationData, fastify))
          : []),
      ]);

      fastify.log.info({ users_count: users.length, type: notificationData.type }, 'Bulk push notifications delivered');
    } catch (error) {
      fastify.log.error(error, 'Error sending bulk push notifications');
    }
  }
}
