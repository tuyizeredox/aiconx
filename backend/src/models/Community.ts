import mongoose, { Document, Schema } from 'mongoose';

export interface ICommunity extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  cover_image?: string;
  icon_url?: string;
  category?: 'fashion' | 'tech' | 'fitness' | 'food' | 'art' | 'music' | 'gaming' | 'travel' | 'diy' | 'other';
  owner_username: string;
  member_count: number;
  post_count: number;
  featured_products: string[];
  pinned_post_ids: string[];
  rules?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

const CommunitySchema = new Schema<ICommunity>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  cover_image: {
    type: String,
  },
  icon_url: {
    type: String,
  },
  category: {
    type: String,
    enum: ['fashion', 'tech', 'fitness', 'food', 'art', 'music', 'gaming', 'travel', 'diy', 'other'],
  },
  owner_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  member_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  post_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  featured_products: [{
    type: String,
  }],
  pinned_post_ids: [{
    type: String,
  }],
  rules: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  is_public: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
CommunitySchema.index({ owner_username: 1 });
CommunitySchema.index({ category: 1 });
CommunitySchema.index({ is_public: 1 });
CommunitySchema.index({ member_count: -1 });
CommunitySchema.index({ created_at: -1 });

export const Community = mongoose.model<ICommunity>('Community', CommunitySchema);