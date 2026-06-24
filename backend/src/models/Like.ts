import mongoose, { Document, Schema } from 'mongoose';

export interface ILike extends Document {
  _id: mongoose.Types.ObjectId;
  user_username: string;
  target_type: 'post' | 'comment' | 'product' | 'review' | 'story' | 'live_session';
  target_id: string;
  created_at: Date;
}

const LikeSchema = new Schema<ILike>({
  user_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  target_type: {
    type: String,
    required: true,
    enum: ['post', 'comment', 'product', 'review', 'story', 'live_session'],
  },
  target_id: {
    type: String,
    required: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false, // Likes don't need updated_at
  },
});

// Virtual for id
LikeSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Indexes for performance
LikeSchema.index({ user_username: 1, target_type: 1, target_id: 1 }, { unique: true });
LikeSchema.index({ target_type: 1, target_id: 1, created_at: -1 });
LikeSchema.index({ user_username: 1, created_at: -1 });

export const Like = mongoose.model<ILike>('Like', LikeSchema);