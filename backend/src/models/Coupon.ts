import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  store_id?: string;
  vendor_username: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  uses_count: number;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CouponSchema = new Schema<ICoupon>({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    unique: true,
  },
  store_id: {
    type: String,
  },
  vendor_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  discount_type: {
    type: String,
    required: true,
    enum: ['percentage', 'flat'],
    default: 'percentage',
  },
  discount_value: {
    type: Number,
    required: true,
    min: 0,
  },
  min_order_amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  max_uses: {
    type: Number,
    default: 0,
    min: 0,
  },
  uses_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  expires_at: {
    type: Date,
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
});

// Indexes for performance
CouponSchema.index({ vendor_username: 1 });
CouponSchema.index({ store_id: 1 });
CouponSchema.index({ is_active: 1, expires_at: 1 });
CouponSchema.index({ expires_at: 1 });

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);