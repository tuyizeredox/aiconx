import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  images: string[];
  videos: string[];
  colors: { name: string; hex?: string; image?: string }[];
  sizes: string[];
  custom_options: { name: string; values: string[] }[];
  category: string;
  tags: string[];
  store_id: string;
  store_name?: string;
  vendor_username: string;
  vendor_plan: 'free' | 'pro' | 'elite';
  plan_priority: number;
  inventory_count: number;
  status: 'active' | 'draft' | 'sold_out' | 'archived';
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  views_count: number;
  clicks_count: number;
  add_to_cart_count: number;
  checkout_start_count: number;
  affiliate_enabled: boolean;
  affiliate_commission_pct: number;
  created_at: Date;
  updated_at: Date;
}

const ProductSchema = new Schema<IProduct>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  compare_at_price: {
    type: Number,
    min: 0,
  },
  currency: {
    type: String,
    default: 'RWF',
    uppercase: true,
  },
  images: [{
    type: String,
  }],
  videos: [{
    type: String,
  }],
  colors: [{
    name: { type: String, required: true, trim: true },
    hex: { type: String, trim: true },
    image: { type: String },
    _id: false,
  }],
  sizes: [{
    type: String,
    trim: true,
  }],
  custom_options: [{
    name: { type: String, required: true, trim: true },
    values: [{ type: String, trim: true }],
    _id: false,
  }],
  category: {
    type: String,
    enum: ['fashion', 'electronics', 'home', 'beauty', 'sports', 'food', 'art', 'books', 'handmade', 'other'],
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  store_id: {
    type: String,
    required: true,
  },
  store_name: {
    type: String,
    trim: true,
  },
  vendor_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  vendor_plan: {
    type: String,
    enum: ['free', 'pro', 'elite'],
    default: 'free',
  },
  plan_priority: {
    type: Number,
    default: 0, // 0: free, 1: pro, 2: elite
  },
  inventory_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['active', 'draft', 'sold_out', 'archived'],
    default: 'active',
  },
  rating_avg: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  rating_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  sales_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  views_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  clicks_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  add_to_cart_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  checkout_start_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  affiliate_enabled: {
    type: Boolean,
    default: true,
  },
  affiliate_commission_pct: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
ProductSchema.index({ vendor_username: 1, status: 1 });
ProductSchema.index({ plan_priority: -1, status: 1 });
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ store_id: 1 });
ProductSchema.index({ status: 1, sales_count: -1 });
ProductSchema.index({ status: 1, rating_avg: -1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ created_at: -1 });
ProductSchema.index({ title: 'text', description: 'text' }); // For text search

// Virtual for id
ProductSchema.virtual('id').get(function() {
  return this._id.toString();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);