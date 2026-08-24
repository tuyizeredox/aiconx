// Chat messages raise a notification *and* bump the conversation's unread
// count, which the messages icon in the header already shows. Counting them on
// the bell too reports the same event twice, so the badges here ignore them —
// they still show up in the notification list, they just don't add to the
// number.
const UNCOUNTED_TYPES = new Set(["message"]);

export function countsTowardBadge(notification) {
  return !UNCOUNTED_TYPES.has(notification?.type);
}

export function countUnread(notifications = []) {
  return notifications.filter((n) => !n?.is_read && countsTowardBadge(n)).length;
}
