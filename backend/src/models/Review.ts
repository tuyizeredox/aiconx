import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  product_id: string;
  store_id: string;
  reviewer_username: string;
  reviewer_name?: string;
  rating: number;
  title?: string;
  content?: string;
  media_urls: string[];
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

const ReviewSchema = new Schema<IReview>({
  product_id: {
    type: String,
    required: true,
  },
  store_id: {
    type: String,
    required: true,
  },
  reviewer_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  reviewer_name: {
    type: String,
    trim: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    trim: true,
  },
  content: {
    type: String,
    trim: true,
  },
  media_urls: [{
    type: String,
  }],
  is_verified_purchase: {
    type: Boolean,
    default: false,
  },
  helpful_count: {
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
ReviewSchema.index({ product_id: 1, created_at: -1 });
ReviewSchema.index({ store_id: 1, created_at: -1 });
ReviewSchema.index({ reviewer_username: 1 });
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ is_verified_purchase: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);