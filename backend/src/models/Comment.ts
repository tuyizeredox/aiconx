import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  post_id: string;
  author_username: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  parent_comment_id?: string;
  likes_count: number;
  created_at: Date;
  updated_at: Date;
}

const CommentSchema = new Schema<IComment>({
  post_id: {
    type: String,
    required: true,
  },
  author_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  author_name: {
    type: String,
    trim: true,
  },
  author_avatar: {
    type: String,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  parent_comment_id: {
    type: String,
  },
  likes_count: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
CommentSchema.index({ post_id: 1, created_at: -1 });
CommentSchema.index({ author_username: 1 });
CommentSchema.index({ parent_comment_id: 1 });
CommentSchema.index({ created_at: -1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);