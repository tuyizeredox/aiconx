import mongoose, { Document, Schema } from 'mongoose';

export interface ILiveSession extends Document {
  _id: mongoose.Types.ObjectId;
  host_username: string;
  host_name?: string;
  store_id?: string;
  store_name?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  category?: 'fashion' | 'electronics' | 'home' | 'beauty' | 'sports' | 'food' | 'art' | 'other';
  status: 'scheduled' | 'active' | 'ended';
  viewer_count: number;
  likes: number;
  pinned_products: Array<{
    id: string;
    title: string;
    price: number;
    image?: string;
  }>;
  moderators: string[]; // List of usernames
  banned_users: string[]; // List of usernames
  stream_key?: string;
  scheduled_at?: Date;
  started_at?: Date;
  ended_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const LiveSessionSchema = new Schema<ILiveSession>({
  host_username: {
    type: String,
    required: true,
    trim: true,
  },
  host_name: {
    type: String,
    trim: true,
  },
  store_id: {
    type: String,
  },
  store_name: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  thumbnail: {
    type: String,
  },
  category: {
    type: String,
    enum: ['fashion', 'electronics', 'home', 'beauty', 'sports', 'food', 'art', 'other'],
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended'],
    default: 'scheduled',
  },
  viewer_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  likes: {
    type: Number,
    default: 0,
    min: 0,
  },
  pinned_products: [{
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
    },
  }],
  moderators: [{
    type: String,
    lowercase: true,
    trim: true,
  }],
  banned_users: [{
    type: String,
    lowercase: true,
    trim: true,
  }],
  stream_key: {
    type: String,
    unique: true,
    sparse: true,
  },
  scheduled_at: {
    type: Date,
  },
  started_at: {
    type: Date,
  },
  ended_at: {
    type: Date,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
LiveSessionSchema.index({ host_username: 1, status: 1 });
LiveSessionSchema.index({ status: 1, scheduled_at: 1 });
LiveSessionSchema.index({ status: 1, started_at: -1 });
LiveSessionSchema.index({ category: 1 });
LiveSessionSchema.index({ store_id: 1 });

export const LiveSession = mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema);