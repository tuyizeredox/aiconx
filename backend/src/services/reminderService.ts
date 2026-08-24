import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { CartItem } from '../models/CartItem';
import { WishlistItem } from '../models/WishlistItem';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { Follow } from '../models/Follow';
import { dispatchNotifications, NotificationInput } from './notificationDispatcher';

/**
 * The reminder engine.
 *
 * Everything in this file is a *generated* notification: nobody did anything
 * to trigger it. A sweep looks at what each shopper already did — a cart left
 * behind, a wishlisted item that just got cheaper, something bought two months
 * ago that's probably running out — and raises the nudge that's useful now.
 *
 * Three properties keep that from turning into spam:
 *
 *  - every reminder carries a dedupe_key, so a sweep running every half hour
 *    delivers each nudge exactly once no matter how many times it re-sees the
 *    same cart or order;
 *  - reminders are bounded by *windows*, not just a "since" cutoff — an order
 *    is eligible for a review nudge between 3 and 14 days after delivery, and
 *    never again;
 *  - nothing goes out during quiet hours, and each job is capped per sweep.
 *
 * Delivery itself (in-app record, socket, web push, FCM) is the dispatcher's
 * job; jobs here only decide *what* to say and *to whom*.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SWEEP_INTERVAL_MS = num(process.env.REMINDER_SWEEP_INTERVAL_MS, 30 * MINUTE);
// Give the server room to finish booting (and Mongo to connect) before the
// first sweep runs.
const STARTUP_DELAY_MS = num(process.env.REMINDER_STARTUP_DELAY_MS, 2 * MINUTE);

// Shoppers have no timezone on file, so reminders are held to daytime in the
// platform's home timezone (CAT/UTC+2) rather than firing at 3am local.
const UTC_OFFSET_HOURS = num(process.env.REMINDER_UTC_OFFSET_HOURS, 2);
const QUIET_START_HOUR = num(process.env.REMINDER_QUIET_START_HOUR, 21);
const QUIET_END_HOUR = num(process.env.REMINDER_QUIET_END_HOUR, 8);

// A cart is "abandoned" after a day, and stops being worth mentioning after a
// week — past that the shopper has moved on.
const CART_IDLE_MS = num(process.env.REMINDER_CART_IDLE_MS, DAY);
const CART_MAX_AGE_MS = num(process.env.REMINDER_CART_MAX_AGE_MS, 7 * DAY);

// Price has to move enough to be worth a notification.
const MIN_PRICE_DROP_PCT = num(process.env.REMINDER_MIN_PRICE_DROP_PCT, 5);

// Long enough to have used the thing, short enough to still remember it.
const REVIEW_MIN_AGE_MS = num(process.env.REMINDER_REVIEW_MIN_AGE_MS, 3 * DAY);
const REVIEW_MAX_AGE_MS = num(process.env.REMINDER_REVIEW_MAX_AGE_MS, 14 * DAY);

// Delivered but not confirmed — the vendor's payout is waiting on this.
const CONFIRM_MIN_AGE_MS = num(process.env.REMINDER_CONFIRM_MIN_AGE_MS, 2 * DAY);
const CONFIRM_MAX_AGE_MS = num(process.env.REMINDER_CONFIRM_MAX_AGE_MS, 14 * DAY);

// "You bought this a while back — need another?"
const REORDER_MIN_AGE_MS = num(process.env.REMINDER_REORDER_MIN_AGE_MS, 45 * DAY);
const REORDER_MAX_AGE_MS = num(process.env.REMINDER_REORDER_MAX_AGE_MS, 120 * DAY);

// How far back purchase history is read when matching new arrivals to taste.
const TASTE_LOOKBACK_MS = num(process.env.REMINDER_TASTE_LOOKBACK_MS, 90 * DAY);

// Per-sweep caps, so one sweep can never fan out unboundedly.
const MAX_PER_JOB = num(process.env.REMINDER_MAX_PER_JOB, 200);
const SCAN_LIMIT = num(process.env.REMINDER_SCAN_LIMIT, 1000);

// Products/orders are only re-scanned this far back when the sweep has no
// cursor yet (first run after a restart).
const MAX_CATCHUP_MS = num(process.env.REMINDER_MAX_CATCHUP_MS, DAY);

interface SweepContext {
  now: Date;
  /** Start of the window this sweep is responsible for (change-driven jobs). */
  since: Date;
}

type Job = (fastify: FastifyInstance, context: SweepContext) => Promise<NotificationInput[]>;

/** Local-day stamp (YYYY-MM-DD) used to cap "one of these per day" reminders. */
function dayKey(now: Date): string {
  return new Date(now.getTime() + UTC_OFFSET_HOURS * HOUR).toISOString().slice(0, 10);
}

function isQuietHours(now: Date): boolean {
  if (QUIET_START_HOUR === QUIET_END_HOUR) return false;
  const localHour = new Date(now.getTime() + UTC_OFFSET_HOURS * HOUR).getUTCHours();
  // The quiet window normally wraps midnight (e.g. 21:00 -> 08:00).
  return QUIET_START_HOUR > QUIET_END_HOUR
    ? localHour >= QUIET_START_HOUR || localHour < QUIET_END_HOUR
    : localHour >= QUIET_START_HOUR && localHour < QUIET_END_HOUR;
}

function formatPrice(amount: number, currency = 'RWF'): string {
  return currency + ' ' + Math.round(amount).toLocaleString('en-US');
}

function truncate(text: string, max = 60): string {
  const clean = (text || '').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '...' : clean;
}

function productLink(productId: unknown): string {
  return '/productdetail?id=' + String(productId);
}

/**
 * "Sofa and 2 more" — the phrasing every job uses when a reminder covers
 * several items.
 */
function listItems(titles: string[]): string {
  const [first, second, ...rest] = titles;
  if (!second) return truncate(first || 'your item');
  if (rest.length === 0) return truncate(first, 40) + ' and ' + truncate(second, 40);
  return truncate(first, 40) + ' and ' + (rest.length + 1) + ' more';
}

/* ------------------------------------------------------------------ *
 * Job: the cart someone walked away from
 * ------------------------------------------------------------------ */
async function abandonedCartReminders(_fastify: FastifyInstance, { now }: SweepContext): Promise<NotificationInput[]> {
  const items = await CartItem.find({
    updated_at: {
      $lt: new Date(now.getTime() - CART_IDLE_MS),
      $gt: new Date(now.getTime() - CART_MAX_AGE_MS),
    },
  })
    .sort({ updated_at: 1 })
    .limit(SCAN_LIMIT)
    .lean();

  const byUser = new Map<string, any[]>();
  for (const item of items as any[]) {
    const bucket = byUser.get(item.user_username);
    if (bucket) bucket.push(item);
    else byUser.set(item.user_username, [item]);
  }

  const reminders: NotificationInput[] = [];

  for (const [username, cart] of byUser) {
    if (reminders.length >= MAX_PER_JOB) break;

    const total = cart.reduce((sum, item) => sum + item.product_price * item.quantity, 0);
    const names = listItems(cart.map((item) => item.product_title));
    const plural = cart.length > 1 ? 's' : '';

    reminders.push({
      recipient_username: username,
      type: 'cart_reminder',
      title: 'You left ' + cart.length + ' item' + plural + ' in your cart',
      body: names + ' — ' + formatPrice(total) + ' total. Finish checking out before it sells out.',
      link: '/cart',
      metadata: {
        item_count: cart.length,
        product_id: String(cart[0].product_id),
        product_image: cart[0].product_image,
      },
      // Keyed on the oldest item, so one abandoned cart earns one reminder —
      // adding more items later doesn't restart the nagging.
      dedupe_key: 'cart:' + cart[0]._id,
    });
  }

  return reminders;
}

/* ------------------------------------------------------------------ *
 * Job: wishlisted things that got cheaper or came back in stock
 *
 * Driven from products that actually changed since the last sweep, so this
 * costs one indexed query instead of a walk over every wishlist row.
 * ------------------------------------------------------------------ */
async function wishlistReminders(fastify: FastifyInstance, { now, since }: SweepContext): Promise<NotificationInput[]> {
  const changed = await Product.find({ updated_at: { $gte: since } })
    .select('title price compare_at_price currency inventory_count status images store_name vendor_username')
    .sort({ updated_at: -1 })
    .limit(SCAN_LIMIT)
    .lean();

  if (changed.length === 0) return [];

  const productsById = new Map(changed.map((product: any) => [String(product._id), product]));

  const watched = await WishlistItem.find({ product_id: { $in: [...productsById.keys()] } })
    .limit(SCAN_LIMIT)
    .lean();

  const reminders: NotificationInput[] = [];
  const snapshotUpdates: any[] = [];
  const today = dayKey(now);

  for (const item of watched as any[]) {
    const product: any = productsById.get(String(item.product_id));
    if (!product) continue;

    const inStock = product.status === 'active' && (product.inventory_count ?? 0) > 0;
    const dropPct = item.product_price > 0
      ? ((item.product_price - product.price) / item.product_price) * 100
      : 0;

    const wantsPriceDrop = product.status === 'active' && dropPct >= MIN_PRICE_DROP_PCT;
    // Only a genuine out-of-stock -> in-stock transition is news. An item
    // first seen in stock just records its state and says nothing.
    const wantsRestock = item.last_known_in_stock === false && inStock;

    // Hitting the per-sweep cap must not silently swallow the news: leave the
    // snapshot untouched so the next sweep still sees the drop or the restock.
    if ((wantsPriceDrop || wantsRestock) && reminders.length >= MAX_PER_JOB) continue;

    if (wantsPriceDrop) {
      reminders.push({
        recipient_username: item.user_username,
        type: 'wishlist_price_drop',
        title: 'Price drop: ' + truncate(product.title, 45),
        body: 'Now ' + formatPrice(product.price, product.currency) + ', down ' + Math.round(dropPct) +
          '% from ' + formatPrice(item.product_price, product.currency) + '. It is on your wishlist.',
        link: productLink(item.product_id),
        metadata: {
          product_id: String(item.product_id),
          product_image: item.product_image || product.images?.[0],
          old_price: item.product_price,
          new_price: product.price,
        },
        // Same product at the same price is the same news.
        dedupe_key: 'price-drop:' + item.product_id + ':' + Math.round(product.price),
      });
    }

    if (wantsRestock) {
      reminders.push({
        recipient_username: item.user_username,
        type: 'back_in_stock',
        title: 'Back in stock: ' + truncate(product.title, 45),
        body: truncate(product.title, 60) + ' is available again at ' + (product.store_name || 'the store') +
          '. Grab it before it goes.',
        link: productLink(item.product_id),
        metadata: {
          product_id: String(item.product_id),
          product_image: item.product_image || product.images?.[0],
        },
        dedupe_key: 'back-in-stock:' + item.product_id + ':' + today,
      });
    }

    const needsSnapshotUpdate =
      item.last_known_in_stock !== inStock ||
      item.product_price !== product.price ||
      item.compare_at_price !== product.compare_at_price;

    if (needsSnapshotUpdate) {
      snapshotUpdates.push({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              last_known_in_stock: inStock,
              product_price: product.price,
              compare_at_price: product.compare_at_price,
            },
          },
        },
      });
    }
  }

  // Re-baseline the wishlist snapshot: the next price drop is measured from
  // today's price, and the wishlist page stops showing a stale one.
  if (snapshotUpdates.length > 0) {
    try {
      await WishlistItem.bulkWrite(snapshotUpdates, { ordered: false });
    } catch (error) {
      fastify.log.error(error, '[reminders] Failed to refresh wishlist snapshots');
    }
  }

  return reminders;
}

/* ------------------------------------------------------------------ *
 * Job: "did it arrive?" — delivered orders awaiting buyer confirmation
 * ------------------------------------------------------------------ */
async function orderConfirmationReminders(_fastify: FastifyInstance, { now }: SweepContext): Promise<NotificationInput[]> {
  const orders = await Order.find({
    status: 'delivered',
    buyer_confirmation_status: 'pending',
    delivered_at: {
      $lt: new Date(now.getTime() - CONFIRM_MIN_AGE_MS),
      $gt: new Date(now.getTime() - CONFIRM_MAX_AGE_MS),
    },
  })
    .select('buyer_username store_name items delivered_at')
    .limit(MAX_PER_JOB)
    .lean();

  return (orders as any[]).map((order) => ({
    recipient_username: order.buyer_username,
    type: 'delivery_reminder' as const,
    title: 'Did your order arrive?',
    body: 'Confirm you received ' + listItems(order.items.map((item: any) => item.product_title)) +
      ' so ' + (order.store_name || 'the vendor') + ' can be paid.',
    link: '/orders',
    metadata: {
      order_id: String(order._id),
      product_image: order.items?.[0]?.product_image,
    },
    dedupe_key: 'confirm:' + order._id,
  }));
}

/* ------------------------------------------------------------------ *
 * Job: review nudges for delivered orders
 * ------------------------------------------------------------------ */
async function reviewReminders(_fastify: FastifyInstance, { now }: SweepContext): Promise<NotificationInput[]> {
  const orders = await Order.find({
    status: 'delivered',
    delivered_at: {
      $lt: new Date(now.getTime() - REVIEW_MIN_AGE_MS),
      $gt: new Date(now.getTime() - REVIEW_MAX_AGE_MS),
    },
  })
    .select('buyer_username store_name items delivered_at')
    .limit(SCAN_LIMIT)
    .lean();

  if (orders.length === 0) return [];

  // One query for every review that could disqualify any of these orders,
  // rather than one per order.
  const buyers = [...new Set((orders as any[]).map((order) => order.buyer_username))];
  const productIds = [
    ...new Set((orders as any[]).flatMap((order) => order.items.map((item: any) => String(item.product_id)))),
  ];

  const reviews = await Review.find({
    reviewer_username: { $in: buyers },
    product_id: { $in: productIds },
  })
    .select('reviewer_username product_id')
    .lean();

  const reviewed = new Set((reviews as any[]).map((review) => review.reviewer_username + '|' + review.product_id));

  const reminders: NotificationInput[] = [];

  for (const order of orders as any[]) {
    if (reminders.length >= MAX_PER_JOB) break;

    const unreviewed = order.items.filter(
      (item: any) => !reviewed.has(order.buyer_username + '|' + String(item.product_id))
    );
    if (unreviewed.length === 0) continue;

    reminders.push({
      recipient_username: order.buyer_username,
      type: 'review_reminder',
      title: 'How was ' + truncate(unreviewed[0].product_title, 40) + '?',
      body: 'Leave a quick review' + (unreviewed.length > 1 ? ' of your ' + unreviewed.length + ' items' : '') +
        ' — it helps other shoppers and the vendor.',
      link: productLink(unreviewed[0].product_id),
      metadata: {
        order_id: String(order._id),
        product_id: String(unreviewed[0].product_id),
        product_image: unreviewed[0].product_image,
      },
      dedupe_key: 'review:' + order._id,
    });
  }

  return reminders;
}

/* ------------------------------------------------------------------ *
 * Job: reorder nudges — bought a while ago, probably running out
 * ------------------------------------------------------------------ */
async function reorderReminders(_fastify: FastifyInstance, { now }: SweepContext): Promise<NotificationInput[]> {
  const orders = await Order.find({
    status: 'delivered',
    delivered_at: {
      $lt: new Date(now.getTime() - REORDER_MIN_AGE_MS),
      $gt: new Date(now.getTime() - REORDER_MAX_AGE_MS),
    },
  })
    .select('buyer_username store_name items delivered_at')
    .limit(SCAN_LIMIT)
    .lean();

  if (orders.length === 0) return [];

  const buyers = [...new Set((orders as any[]).map((order) => order.buyer_username))];

  // Anything already bought again since the window opened is not a reorder
  // candidate — the shopper is ahead of us.
  const recentOrders = await Order.find({
    buyer_username: { $in: buyers },
    created_at: { $gte: new Date(now.getTime() - REORDER_MIN_AGE_MS) },
    status: { $ne: 'cancelled' },
  })
    .select('buyer_username items.product_id')
    .lean();

  const boughtSince = new Set(
    (recentOrders as any[]).flatMap((order) =>
      order.items.map((item: any) => order.buyer_username + '|' + String(item.product_id))
    )
  );

  const candidateIds = [
    ...new Set((orders as any[]).flatMap((order) => order.items.map((item: any) => String(item.product_id)))),
  ];

  const buyableProducts = await Product.find({
    _id: { $in: candidateIds.filter((id) => mongoose.isValidObjectId(id)) },
    status: 'active',
    inventory_count: { $gt: 0 },
  })
    .select('title price currency images')
    .lean();

  const buyable = new Map((buyableProducts as any[]).map((product) => [String(product._id), product]));

  const reminders: NotificationInput[] = [];

  for (const order of orders as any[]) {
    if (reminders.length >= MAX_PER_JOB) break;

    const item = order.items.find(
      (candidate: any) =>
        buyable.has(String(candidate.product_id)) &&
        !boughtSince.has(order.buyer_username + '|' + String(candidate.product_id))
    );
    if (!item) continue;

    const product: any = buyable.get(String(item.product_id));
    const weeksAgo = Math.round((now.getTime() - new Date(order.delivered_at).getTime()) / (7 * DAY));

    reminders.push({
      recipient_username: order.buyer_username,
      type: 'reorder_reminder',
      title: 'Running low on ' + truncate(item.product_title, 40) + '?',
      body: 'You bought it about ' + weeksAgo + ' weeks ago. It is in stock at ' +
        formatPrice(product.price, product.currency) + ' — reorder in a tap.',
      link: productLink(item.product_id),
      metadata: {
        order_id: String(order._id),
        product_id: String(item.product_id),
        product_image: item.product_image || product.images?.[0],
      },
      dedupe_key: 'reorder:' + order._id + ':' + item.product_id,
    });
  }

  return reminders;
}

/* ------------------------------------------------------------------ *
 * Job: new arrivals matched to what someone actually bought before
 *
 * Followers already hear about a vendor's new products the moment they're
 * posted (see routes/products.ts). This covers everyone else: shoppers whose
 * purchase history says they'd care, capped at one a day so it stays a signal.
 * ------------------------------------------------------------------ */
async function newArrivalRecommendations(_fastify: FastifyInstance, { now, since }: SweepContext): Promise<NotificationInput[]> {
  const newProducts = await Product.find({
    status: 'active',
    inventory_count: { $gt: 0 },
    created_at: { $gte: since },
  })
    .select('title price currency category store_id store_name vendor_username images created_at')
    .sort({ created_at: -1 })
    .limit(MAX_PER_JOB)
    .lean();

  if (newProducts.length === 0) return [];

  const pastOrders = await Order.find({
    created_at: { $gte: new Date(now.getTime() - TASTE_LOOKBACK_MS) },
    status: { $ne: 'cancelled' },
  })
    .select('buyer_username store_id items.product_id')
    .sort({ created_at: -1 })
    .limit(SCAN_LIMIT)
    .lean();

  if (pastOrders.length === 0) return [];

  // Categories aren't denormalised onto order items, so resolve them once for
  // every product these shoppers bought.
  const purchasedIds = [
    ...new Set((pastOrders as any[]).flatMap((order) => order.items.map((item: any) => String(item.product_id)))),
  ];

  const purchasedProducts = await Product.find({
    _id: { $in: purchasedIds.filter((id) => mongoose.isValidObjectId(id)) },
  })
    .select('category')
    .lean();

  const categoryOf = new Map((purchasedProducts as any[]).map((product) => [String(product._id), product.category]));

  interface Taste {
    categories: Set<string>;
    stores: Set<string>;
    products: Set<string>;
  }

  const tasteByBuyer = new Map<string, Taste>();
  for (const order of pastOrders as any[]) {
    let taste = tasteByBuyer.get(order.buyer_username);
    if (!taste) {
      taste = { categories: new Set(), stores: new Set(), products: new Set() };
      tasteByBuyer.set(order.buyer_username, taste);
    }
    if (order.store_id) taste.stores.add(String(order.store_id));
    for (const item of order.items) {
      const productId = String(item.product_id);
      taste.products.add(productId);
      const category = categoryOf.get(productId);
      if (category) taste.categories.add(category);
    }
  }

  // Followers were already told directly — don't say it twice.
  const follows = await Follow.find({
    follower_username: { $in: [...tasteByBuyer.keys()] },
    follow_type: { $in: ['user', 'store'] },
  })
    .select('follower_username following_username target_id follow_type')
    .lean();

  const followed = new Set(
    (follows as any[]).map((follow) =>
      follow.follow_type === 'store'
        ? follow.follower_username + '|store:' + follow.target_id
        : follow.follower_username + '|user:' + follow.following_username
    )
  );

  const today = dayKey(now);
  const reminders: NotificationInput[] = [];

  for (const [buyer, taste] of tasteByBuyer) {
    if (reminders.length >= MAX_PER_JOB) break;

    let best: any = null;
    let bestScore = 0;

    for (const product of newProducts as any[]) {
      if (product.vendor_username === buyer) continue;
      if (taste.products.has(String(product._id))) continue;
      if (followed.has(buyer + '|user:' + product.vendor_username)) continue;
      if (product.store_id && followed.has(buyer + '|store:' + product.store_id)) continue;

      // A store they've bought from is a stronger signal than a category match;
      // newest wins ties, since newProducts is already sorted newest-first.
      const score =
        (product.store_id && taste.stores.has(String(product.store_id)) ? 3 : 0) +
        (product.category && taste.categories.has(product.category) ? 2 : 0);

      if (score > bestScore) {
        best = product;
        bestScore = score;
      }
    }

    if (!best) continue;

    const fromStore = Boolean(best.store_id && taste.stores.has(String(best.store_id)));

    reminders.push({
      recipient_username: buyer,
      type: 'recommendation',
      title: fromStore
        ? (best.store_name || 'A store you bought from') + ' just added ' + truncate(best.title, 35)
        : 'New in ' + best.category + ': ' + truncate(best.title, 40),
      body: formatPrice(best.price, best.currency) + ' — picked for you based on what you have bought before.',
      link: productLink(best._id),
      sender_username: best.vendor_username,
      sender_name: best.store_name,
      metadata: {
        product_id: String(best._id),
        store_id: best.store_id ? String(best.store_id) : undefined,
        product_image: best.images?.[0],
        reason: fromStore ? 'store_repurchase' : 'category_match',
      },
      // At most one new-arrival pick per shopper per day.
      dedupe_key: 'new-arrival:' + today,
    });
  }

  return reminders;
}

const JOBS: Array<{ name: string; run: Job }> = [
  { name: 'abandoned_cart', run: abandonedCartReminders },
  { name: 'wishlist', run: wishlistReminders },
  { name: 'order_confirmation', run: orderConfirmationReminders },
  { name: 'review', run: reviewReminders },
  { name: 'reorder', run: reorderReminders },
  { name: 'new_arrivals', run: newArrivalRecommendations },
];

let sweepInFlight = false;
let lastSweepAt: Date | null = null;

export interface SweepResult {
  skipped?: 'quiet_hours' | 'db_disconnected' | 'in_flight';
  delivered: number;
  byJob: Record<string, number>;
  duration_ms: number;
}

/**
 * Run every reminder job once. Safe to call at any time: jobs are idempotent
 * through their dedupe keys, and overlapping runs are refused rather than
 * queued.
 *
 * `force` bypasses the quiet-hours hold — used by the admin trigger so
 * reminders can be tested on demand.
 */
export async function runReminderSweep(fastify: FastifyInstance, { force = false } = {}): Promise<SweepResult> {
  const started = Date.now();
  const byJob: Record<string, number> = {};

  if (sweepInFlight) return { skipped: 'in_flight', delivered: 0, byJob, duration_ms: 0 };
  if (mongoose.connection.readyState !== 1) return { skipped: 'db_disconnected', delivered: 0, byJob, duration_ms: 0 };

  const now = new Date();
  if (!force && isQuietHours(now)) return { skipped: 'quiet_hours', delivered: 0, byJob, duration_ms: 0 };

  sweepInFlight = true;
  try {
    // Change-driven jobs look at everything since the last sweep. After a
    // restart there's no cursor, so fall back to a bounded catch-up window
    // instead of re-scanning history.
    const earliest = new Date(now.getTime() - MAX_CATCHUP_MS);
    const since = lastSweepAt && lastSweepAt > earliest ? lastSweepAt : earliest;
    const context: SweepContext = { now, since };

    let delivered = 0;

    for (const job of JOBS) {
      try {
        const reminders = await job.run(fastify, context);
        const sent = await dispatchNotifications(fastify, reminders);
        byJob[job.name] = sent;
        delivered += sent;
      } catch (error) {
        byJob[job.name] = 0;
        fastify.log.error(error, '[reminders] Job "' + job.name + '" failed');
      }
    }

    lastSweepAt = now;

    if (delivered > 0) {
      fastify.log.info({ delivered, byJob, duration_ms: Date.now() - started }, '[reminders] Sweep delivered reminders');
    }

    return { delivered, byJob, duration_ms: Date.now() - started };
  } finally {
    sweepInFlight = false;
  }
}

/**
 * Start the recurring sweep. Called once, after the server is listening and
 * fastify.io is attached (the dispatcher emits through it).
 */
export function startReminderService(fastify: FastifyInstance) {
  if (process.env.REMINDERS_ENABLED === 'false') {
    fastify.log.warn('[reminders] Disabled via REMINDERS_ENABLED=false');
    return;
  }

  const tick = () => {
    runReminderSweep(fastify).catch((error) => {
      fastify.log.error(error, '[reminders] Sweep failed');
    });
  };

  setTimeout(() => {
    tick();
    setInterval(tick, SWEEP_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  fastify.log.info(
    {
      interval_ms: SWEEP_INTERVAL_MS,
      quiet_hours: QUIET_START_HOUR + ':00-' + QUIET_END_HOUR + ':00 UTC+' + UTC_OFFSET_HOURS,
    },
    '[reminders] Reminder service scheduled'
  );
}
