import mongoose, { ClientSession } from 'mongoose';
import { Like } from '../models/Like';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Story } from '../models/Story';
import { LiveSession } from '../models/LiveSession';
import { Product } from '../models/Product';
import { Review } from '../models/Review';

export interface LikeResult {
  status: 'liked' | 'unliked';
  likes_count: number;
  likes?: number; // Backward compatibility for live sessions
  helpful_count?: number; // Backward compatibility for reviews
  is_liked: boolean;
  target_id: string;
  target_type: string;
  like_doc?: any;
}

/**
 * Check if a target exists
 */
export async function checkTargetExists(target_type: string, target_id: string) {
  switch (target_type) {
    case 'post': return !!(await Post.findById(target_id));
    case 'comment': return !!(await Comment.findById(target_id));
    case 'product': return !!(await Product.findById(target_id));
    case 'review': return !!(await Review.findById(target_id));
    case 'story': return !!(await Story.findById(target_id));
    case 'live_session': return !!(await LiveSession.findById(target_id));
    default: return false;
  }
}

/**
 * Shared service to update likes count across different models
 */
export async function updateLikesCount(target_type: string, target_id: string, increment: number, session?: ClientSession) {
  const objId = new mongoose.Types.ObjectId(target_id);
  const options = { session, new: true, lean: true };
  
  switch (target_type) {
    case 'post':
      const post = await Post.findOneAndUpdate(
        increment < 0 ? { _id: objId, likes_count: { $gt: 0 } } : { _id: objId },
        { $inc: { likes_count: increment } },
        options
      );
      return post?.likes_count ?? (await Post.findById(target_id).session(session || null).lean())?.likes_count ?? 0;
      
    case 'comment':
      const comment = await Comment.findOneAndUpdate(
        increment < 0 ? { _id: objId, likes_count: { $gt: 0 } } : { _id: objId },
        { $inc: { likes_count: increment } },
        options
      );
      return comment?.likes_count ?? (await Comment.findById(target_id).session(session || null).lean())?.likes_count ?? 0;
      
    case 'story':
      const story = await Story.findOneAndUpdate(
        increment < 0 ? { _id: objId, likes_count: { $gt: 0 } } : { _id: objId },
        { $inc: { likes_count: increment } },
        options
      );
      return story?.likes_count ?? (await Story.findById(target_id).session(session || null).lean())?.likes_count ?? 0;
      
    case 'live_session':
      const session_doc = await LiveSession.findOneAndUpdate(
        increment < 0 ? { _id: objId, likes: { $gt: 0 } } : { _id: objId },
        { $inc: { likes: increment } },
        options
      );
      return session_doc?.likes ?? (await LiveSession.findById(target_id).session(session || null).lean())?.likes ?? 0;
      
    case 'review':
      const review = await Review.findOneAndUpdate(
        increment < 0 ? { _id: objId, helpful_count: { $gt: 0 } } : { _id: objId },
        { $inc: { helpful_count: increment } },
        options
      );
      return review?.helpful_count ?? (await Review.findById(target_id).session(session || null).lean())?.helpful_count ?? 0;
      
    default:
      return 0;
  }
}

/**
 * Handle the full like process
 */
export async function likeTarget(user_username: string, target_type: string, target_id: string): Promise<LikeResult> {
  const user_username_lower = user_username.toLowerCase();
  
  // 1. Check if target exists
  if (!(await checkTargetExists(target_type, target_id))) {
    throw new Error(`${target_type} not found`);
  }

  // 2. Check if already liked
  const existingLike = await Like.findOne({
    user_username: user_username_lower,
    target_type,
    target_id
  });

  if (existingLike) {
    throw new Error('Already liked');
  }

  // 3. Create like and update count
  const like = new Like({
    user_username: user_username_lower,
    target_type,
    target_id
  });

  await like.save();
  const likes_count = await updateLikesCount(target_type, target_id, 1);

  const result: LikeResult = {
    status: 'liked',
    likes_count,
    is_liked: true,
    target_id,
    target_type,
    like_doc: like.toObject()
  };

  if (target_type === 'live_session') {
    result.likes = likes_count;
  }
  
  if (target_type === 'review') {
    result.helpful_count = likes_count;
  }

  return result;
}

/**
 * Handle the full unlike process
 */
export async function unlikeTarget(user_username: string, target_type: string, target_id: string): Promise<LikeResult> {
  const user_username_lower = user_username.toLowerCase();

  // 1. Find and delete like
  const result = await Like.findOneAndDelete({
    user_username: user_username_lower,
    target_type,
    target_id
  });

  if (!result) {
    throw new Error('Like not found');
  }

  // 2. Update count
  const likes_count = await updateLikesCount(target_type, target_id, -1);

  const finalResult: LikeResult = {
    status: 'unliked',
    likes_count,
    is_liked: false,
    target_id,
    target_type
  };

  if (target_type === 'live_session') {
    finalResult.likes = likes_count;
  }
  
  if (target_type === 'review') {
    finalResult.helpful_count = likes_count;
  }

  return finalResult;
}

/**
 * Check if a user has liked a target
 */
export async function checkIfLiked(user_username: string, target_type: string, target_id: string): Promise<boolean> {
  if (!user_username || !target_id) return false;
  const like = await Like.findOne({
    user_username: user_username.toLowerCase(),
    target_type,
    target_id: target_id.toString()
  }).lean();
  return !!like;
}

/**
 * Get all likes for a list of targets for a specific user
 * Returns a Set of target_ids that the user has liked
 */
export async function getLikesForTargets(user_username: string, target_type: string, target_ids: string[]): Promise<Set<string>> {
  if (!user_username || !target_ids || target_ids.length === 0) return new Set();
  
  const likes = await Like.find({
    user_username: user_username.toLowerCase(),
    target_type,
    target_id: { $in: target_ids.map(id => id.toString()) }
  }).select('target_id').lean();
  
  return new Set(likes.map((l: any) => l.target_id.toString()));
}
