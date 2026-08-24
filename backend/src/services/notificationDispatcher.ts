import { FastifyInstance } from 'fastify';
import { Notification, INotification, NotificationType } from '../models/Notification';
import { NotificationService, shouldSendNotification, filterByNotificationPreference } from './notificationService';

export interface NotificationInput {
  recipient_username: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  sender_username?: string;
  sender_name?: string;
  metadata?: Record<string, any>;
  /**
   * Set for generated reminders so the same nudge is only ever delivered once,
   * however often the sweep runs. Omit it for event-driven notifications,
   * where two of the same kind are two real events.
   */
  dedupe_key?: string;
}

interface DispatchOptions {
  /**
   * Skip the recipient's notification-preference check. Used by the bulk path,
   * which has already filtered the recipient list in a single query.
   */
  force?: boolean;
}

/**
 * The one way a notification reaches a person: stored for the in-app list,
 * pushed to the open tab over the socket, and pushed to the device (web push
 * + FCM) so it lands even with the app closed.
 *
 * Returns the stored notification, or `null` when nothing was delivered —
 * either the recipient has this kind switched off, or an identical
 * `dedupe_key` was already delivered to them.
 */
export async function dispatchNotification(
  fastify: FastifyInstance,
  input: NotificationInput,
  options: DispatchOptions = {}
): Promise<INotification | null> {
  const recipient = input.recipient_username.toLowerCase();

  try {
    if (!options.force && !(await shouldSendNotification(recipient, input.type))) {
      return null;
    }

    let notification: INotification | null;

    if (input.dedupe_key) {
      // Upsert rather than find-then-insert: the unique partial index on
      // (recipient_username, dedupe_key) makes this atomic, so overlapping
      // sweeps can't both decide they're the first.
      const result = await Notification.updateOne(
        { recipient_username: recipient, dedupe_key: input.dedupe_key },
        {
          $setOnInsert: {
            recipient_username: recipient,
            type: input.type,
            title: input.title,
            body: input.body,
            link: input.link,
            sender_username: input.sender_username,
            sender_name: input.sender_name,
            metadata: input.metadata,
            dedupe_key: input.dedupe_key,
            is_read: false,
            // created_at/updated_at are deliberately left to Mongoose's
            // timestamps: setting updated_at here as well would collide with
            // the $set Mongoose adds on an update and Mongo would reject the
            // whole write with a path conflict.
          },
        },
        { upsert: true }
      );

      // Already delivered — nothing more to do.
      if (!result.upsertedId) return null;

      notification = await Notification.findById(result.upsertedId);
    } else {
      notification = await new Notification({
        recipient_username: recipient,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        sender_username: input.sender_username,
        sender_name: input.sender_name,
        metadata: input.metadata,
      }).save();
    }

    if (!notification) return null;

    fastify.io?.to(`user:${recipient}`).emit('notification:new', notification);

    // Device push is best-effort: a failing push service must never fail the
    // caller that raised the notification.
    void NotificationService.sendPushNotification(recipient, notification, fastify);

    return notification;
  } catch (error: any) {
    // A duplicate-key error means a concurrent writer won the race with the
    // same dedupe key — that's the index doing its job, not a failure.
    if (error?.code === 11000) return null;
    fastify.log.error(error, 'Failed to dispatch notification');
    return null;
  }
}

const DISPATCH_CONCURRENCY = 10;

/**
 * Dispatch a batch of individually-addressed notifications. Preferences are
 * resolved for the whole batch up front (one query per type instead of one per
 * recipient), then delivery runs in small concurrent chunks so a large sweep
 * doesn't open hundreds of simultaneous push connections.
 *
 * Returns how many were actually delivered.
 */
export async function dispatchNotifications(
  fastify: FastifyInstance,
  inputs: NotificationInput[]
): Promise<number> {
  if (inputs.length === 0) return 0;

  const byType = new Map<string, NotificationInput[]>();
  for (const input of inputs) {
    const bucket = byType.get(input.type);
    if (bucket) bucket.push(input);
    else byType.set(input.type, [input]);
  }

  const allowed: NotificationInput[] = [];
  for (const [type, batch] of byType) {
    const eligible = new Set(
      (await filterByNotificationPreference(batch.map((item) => item.recipient_username), type))
        .map((username) => username.toLowerCase())
    );
    allowed.push(...batch.filter((item) => eligible.has(item.recipient_username.toLowerCase())));
  }

  let delivered = 0;
  for (let i = 0; i < allowed.length; i += DISPATCH_CONCURRENCY) {
    const chunk = allowed.slice(i, i + DISPATCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((input) => dispatchNotification(fastify, input, { force: true }))
    );
    delivered += results.filter(Boolean).length;
  }

  return delivered;
}
