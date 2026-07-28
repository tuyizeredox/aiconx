import { Product, IProduct } from '../models/Product';
import { Store, IStore } from '../models/Store';
import { User, IUser } from '../models/User';
import { CartItem } from '../models/CartItem';
import { WishlistItem } from '../models/WishlistItem';
import { AffiliateLink } from '../models/AffiliateLink';
import { Review } from '../models/Review';
import { SentimentSummary } from '../models/SentimentSummary';
import { Like } from '../models/Like';
import { Bookmark } from '../models/Bookmark';
import { ProductQuestion } from '../models/ProductQuestion';
import { ProductBooking } from '../models/ProductBooking';
import { StoreReview } from '../models/StoreReview';
import { ShippingZone } from '../models/ShippingZone';
import { VendorSubscription } from '../models/VendorSubscription';
import { Withdrawal } from '../models/Withdrawal';
import { Coupon } from '../models/Coupon';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Follow } from '../models/Follow';
import { Story } from '../models/Story';
import { CommunityMember } from '../models/CommunityMember';
import { Community } from '../models/Community';
import { LiveSession } from '../models/LiveSession';
import { LiveChatMessage } from '../models/LiveChatMessage';
import { Call } from '../models/Call';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Order } from '../models/Order';
import { Report } from '../models/Report';
import { deleteFile } from './storageService';

/**
 * Best-effort translation of a stored media URL back into the key/public_id
 * that storageService.deleteFile() needs. Object storage cleanup must never
 * block the underlying DB delete — a failure here just leaves an orphaned
 * file, which is recoverable, whereas failing the whole delete is not.
 */
function extractStorageRef(url: string): { provider: 's3' | 'cloudinary'; ref: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('cloudinary.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const uploadIdx = parts.findIndex((p) => p === 'upload');
      if (uploadIdx === -1) return null;
      let rest = parts.slice(uploadIdx + 1);
      if (rest[0] && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
      if (rest.length === 0) return null;
      const withExt = rest.join('/');
      const publicId = withExt.replace(/\.[^/.]+$/, '');
      return { provider: 'cloudinary', ref: publicId };
    }
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    if (!key) return null;
    return { provider: 's3', ref: key };
  } catch {
    return null;
  }
}

async function deleteMediaUrls(urls: Array<string | undefined | null>): Promise<void> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))];
  await Promise.all(
    unique.map(async (url) => {
      const info = extractStorageRef(url);
      if (!info) return;
      try {
        await deleteFile(info.ref, info.provider);
      } catch (err) {
        console.warn(`[cascade] Failed to delete media file ${url}:`, err);
      }
    })
  );
}

/**
 * Deletes a product and every record that references it — cart/wishlist
 * entries, reviews, affiliate links, sentiment summaries, likes/bookmarks,
 * and its uploaded images/videos. Without this, "deleting" a product from
 * the admin panel just removed the Product document while leaving it
 * effectively alive everywhere else (in carts, wishlists, review pages).
 */
export async function deleteProductCascade(product: IProduct): Promise<void> {
  const productId = product._id.toString();

  await Promise.all([
    CartItem.deleteMany({ product_id: productId }),
    WishlistItem.deleteMany({ product_id: productId }),
    AffiliateLink.deleteMany({ product_id: productId }),
    Review.deleteMany({ product_id: productId }),
    SentimentSummary.deleteMany({ product_id: productId }),
    Like.deleteMany({ target_type: 'product', target_id: productId }),
    Bookmark.deleteMany({ target_type: 'product', target_id: productId }),
    ProductQuestion.deleteMany({ product_id: productId }),
    ProductBooking.deleteMany({ product_id: productId }),
  ]);

  await deleteMediaUrls([
    ...(product.images || []),
    ...(product.videos || []),
    ...((product.colors || []).map((c) => c.image)),
  ]);

  if (product.store_id) {
    await Store.findByIdAndUpdate(product.store_id, { $inc: { product_count: -1 } });
  }

  await Product.deleteOne({ _id: product._id });
}

/**
 * Deletes a store, all of its products (via deleteProductCascade), and every
 * store-scoped record: reviews, shipping zones, coupons, subscriptions,
 * withdrawal requests, affiliate links, and uploaded logo/banner/ID images.
 * Orders placed against the store are intentionally left intact — they are
 * the buyer's purchase history and the platform's financial record, not the
 * vendor's data to take with them when the store disappears.
 */
export async function deleteStoreCascade(store: IStore): Promise<void> {
  const storeId = store._id.toString();

  const products = await Product.find({ store_id: storeId });
  for (const product of products) {
    await deleteProductCascade(product);
  }

  await Promise.all([
    StoreReview.deleteMany({ store_id: storeId }),
    ShippingZone.deleteMany({ store_id: storeId }),
    Coupon.deleteMany({ store_id: storeId }),
    VendorSubscription.deleteMany({ vendor_username: store.owner_username }),
    Withdrawal.deleteMany({ store_id: storeId }),
    AffiliateLink.deleteMany({ store_id: storeId }),
  ]);

  await deleteMediaUrls([store.logo_url, store.banner_url, store.identity_document_image_url]);

  await Store.deleteOne({ _id: store._id });
}

export interface UserDeletionSummary {
  store_deleted: boolean;
  products_deleted: number;
  posts_deleted: number;
  orders_anonymized: number;
}

/**
 * Deletes a user account and everything tied to it: their store (and its
 * products/orders-untouched via deleteStoreCascade), social content (posts,
 * comments, likes, follows, bookmarks, stories, messages, notifications,
 * live sessions/chat, calls), marketplace activity (cart, wishlist, reviews,
 * affiliate links, withdrawals), and owned communities. Orders where this
 * user was the buyer are kept (the vendor's side needs them for accounting)
 * but personal fields are scrubbed so no identifying data survives.
 */
export async function deleteUserCascade(user: IUser): Promise<UserDeletionSummary> {
  const username = user.username;
  const summary: UserDeletionSummary = {
    store_deleted: false,
    products_deleted: 0,
    orders_anonymized: 0,
    posts_deleted: 0,
  };

  const store = await Store.findOne({ owner_username: username });
  if (store) {
    const productCount = await Product.countDocuments({ store_id: store._id.toString() });
    summary.products_deleted = productCount;
    summary.store_deleted = true;
    await deleteStoreCascade(store);
  }

  const ownedCommunities = await Community.find({ owner_username: username });
  for (const community of ownedCommunities) {
    await CommunityMember.deleteMany({ community_id: community._id.toString() });
    await deleteMediaUrls([community.cover_image, community.icon_url]);
    await Community.deleteOne({ _id: community._id });
  }

  const posts = await Post.find({ author_username: username });
  const postIds = posts.map((p) => p._id.toString());
  summary.posts_deleted = posts.length;
  if (postIds.length > 0) {
    await Promise.all([
      Comment.deleteMany({ post_id: { $in: postIds } }),
      Like.deleteMany({ target_type: 'post', target_id: { $in: postIds } }),
      Bookmark.deleteMany({ target_type: 'post', target_id: { $in: postIds } }),
      Post.deleteMany({ repost_of: { $in: postIds } }),
    ]);
    for (const post of posts) {
      await deleteMediaUrls([...(post.media_urls || []), ...(post.thumbnail_urls || [])]);
    }
  }

  const liveSessions = await LiveSession.find({ host_username: username });
  for (const session of liveSessions) {
    await LiveChatMessage.deleteMany({ session_id: session._id.toString() });
    await deleteMediaUrls([session.thumbnail]);
  }

  const stories = await Story.find({ author_username: username });
  for (const story of stories) {
    await deleteMediaUrls([story.media_url]);
  }

  await Promise.all([
    Post.deleteMany({ author_username: username }),
    Comment.deleteMany({ author_username: username }),
    Like.deleteMany({ user_username: username }),
    Bookmark.deleteMany({ user_username: username }),
    Follow.deleteMany({ $or: [{ follower_username: username }, { following_username: username }] }),
    Story.deleteMany({ author_username: username }),
    CommunityMember.deleteMany({ member_username: username }),
    LiveSession.deleteMany({ host_username: username }),
    Call.deleteMany({ $or: [{ caller_username: username }, { callee_username: username }] }),
    Review.deleteMany({ reviewer_username: username }),
    StoreReview.deleteMany({ reviewer_username: username }),
    CartItem.deleteMany({ user_username: username }),
    WishlistItem.deleteMany({ user_username: username }),
    AffiliateLink.deleteMany({ influencer_username: username }),
    ProductQuestion.deleteMany({ asker_username: username }),
    ProductBooking.deleteMany({ user_username: username }),
    Withdrawal.deleteMany({ vendor_username: username }),
    Message.deleteMany({ $or: [{ sender_username: username }, { receiver_username: username }] }),
    Notification.deleteMany({ $or: [{ recipient_username: username }, { sender_username: username }] }),
    Report.deleteMany({ reporter_id: user._id }),
  ]);

  await deleteMediaUrls([user.avatar_url, user.banner_url]);

  const orderResult = await Order.updateMany(
    { buyer_username: username },
    {
      $set: {
        buyer_name: 'Deleted User',
      },
      $unset: {
        buyer_email: '',
        buyer_phone: '',
        shipping_address: '',
      },
    }
  );
  summary.orders_anonymized = orderResult.modifiedCount;

  await User.deleteOne({ _id: user._id });

  return summary;
}
