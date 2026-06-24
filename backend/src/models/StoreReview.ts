import mongoose, { Schema, Document } from 'mongoose';

export interface IStoreReview extends Document {
  store_id: string;
  store_name: string;
  vendor_username: string;
  reviewer_username: string;
  reviewer_name: string;
  rating: number; // 1-5 star rating
  title: string;
  content: string;
  vendor_reply?: string;
  vendor_replied_at?: Date;
  helpful_count: number;
  is_verified_purchase: boolean;
  created_at: Date;
  updated_at: Date;
}

const StoreReviewSchema = new Schema<IStoreReview>({
  store_id: {
    type: String,
    required: true,
    index: true
  },
  store_name: {
    type: String,
    required: true
  },
  vendor_username: {
    type: String,
    required: true,
    index: true
  },
  reviewer_username: {
    type: String,
    required: true,
    index: true
  },
  reviewer_name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  vendor_reply: {
    type: String,
    maxlength: 1000
  },
  vendor_replied_at: {
    type: Date
  },
  helpful_count: {
    type: Number,
    default: 0,
    min: 0
  },
  is_verified_purchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
StoreReviewSchema.index({ store_id: 1, created_at: -1 });
StoreReviewSchema.index({ vendor_username: 1, created_at: -1 });
StoreReviewSchema.index({ reviewer_username: 1, created_at: -1 });
StoreReviewSchema.index({ store_id: 1, rating: -1 });

// Ensure one review per reviewer per store
StoreReviewSchema.index({ store_id: 1, reviewer_username: 1 }, { unique: true });

export const StoreReview = mongoose.model<IStoreReview>('StoreReview', StoreReviewSchema);