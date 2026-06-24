import mongoose, { Document, Schema } from 'mongoose';

export interface IBookmark extends Document {
  _id: mongoose.Types.ObjectId;
  user_username: string;
  target_type: 'post' | 'product';
  target_id: string;
  created_at: Date;
}

const BookmarkSchema = new Schema<IBookmark>({
  user_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  target_type: {
    type: String,
    required: true,
    enum: ['post', 'product'],
  },
  target_id: {
    type: String,
    required: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false,
  },
});

// Compound index for uniqueness
BookmarkSchema.index({ user_username: 1, target_type: 1, target_id: 1 }, { unique: true });
BookmarkSchema.index({ user_username: 1, created_at: -1 });

export const Bookmark = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);
