import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  author_username: string;
  author_email?: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  media_urls: string[];
  media_type: 'image' | 'video' | 'text' | 'product_review';
  tagged_products: string[];
  affiliate_links: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  community_id?: string;
  is_sponsored: boolean;
  visibility: 'public' | 'followers' | 'community';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const PostSchema = new Schema<IPost>({
  author_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  author_email: {
    type: String,
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
    required: false,
    default: '',
  },
  media_urls: [{
    type: String,
  }],
  media_type: {
    type: String,
    enum: ['image', 'video', 'text', 'product_review'],
    default: 'text',
  },
  tagged_products: [{
    type: String,
  }],
  affiliate_links: [{
    type: String,
  }],
  likes_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  comments_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  shares_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  community_id: {
    type: String,
  },
  is_sponsored: {
    type: Boolean,
    default: false,
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'community'],
    default: 'public',
  },
  is_active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for id
PostSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Indexes for performance
PostSchema.index({ author_username: 1, created_at: -1 });
PostSchema.index({ community_id: 1, created_at: -1 });
PostSchema.index({ visibility: 1, created_at: -1 });
PostSchema.index({ is_active: 1, created_at: -1 });
PostSchema.index({ is_sponsored: 1, created_at: -1 });
PostSchema.index({ tagged_products: 1 });
PostSchema.index({ likes_count: -1 });
PostSchema.index({ created_at: -1 });
PostSchema.index({ content: 'text' }); // For text search

export const Post = mongoose.model<IPost>('Post', PostSchema);