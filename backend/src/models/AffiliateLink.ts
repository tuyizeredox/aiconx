import mongoose, { Document, Schema } from 'mongoose';

export interface IAffiliateLink extends Document {
  _id: mongoose.Types.ObjectId;
  influencer_email?: string;
  influencer_username: string;
  influencer_name?: string;
  store_id?: string;
  store_name?: string;
  product_id: string;
  product_title?: string;
  product_price?: number;
  ref_code: string;
  commission_pct: number;
  clicks: number;
  conversions: number;
  total_commission_earned: number;
  commission_paid: number;
  status: 'active' | 'paused' | 'expired';
  created_at: Date;
  updated_at: Date;
}

const AffiliateLinkSchema = new Schema<IAffiliateLink>({
  influencer_email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
  },
  influencer_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  influencer_name: {
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
  product_id: {
    type: String,
    required: true,
  },
  product_title: {
    type: String,
    trim: true,
  },
  product_price: {
    type: Number,
    min: 0,
  },
  ref_code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  commission_pct: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  clicks: {
    type: Number,
    default: 0,
    min: 0,
  },
  conversions: {
    type: Number,
    default: 0,
    min: 0,
  },
  total_commission_earned: {
    type: Number,
    default: 0,
    min: 0,
  },
  commission_paid: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'expired'],
    default: 'active',
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
AffiliateLinkSchema.index({ influencer_username: 1 });
AffiliateLinkSchema.index({ product_id: 1 });
AffiliateLinkSchema.index({ store_id: 1 });
AffiliateLinkSchema.index({ status: 1 });

export const AffiliateLink = mongoose.model<IAffiliateLink>('AffiliateLink', AffiliateLinkSchema);