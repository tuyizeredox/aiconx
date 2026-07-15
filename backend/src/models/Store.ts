import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  owner_username: string;
  owner_name?: string;
  logo_url?: string;
  banner_url?: string;
  category: string;
  status: 'active' | 'pending' | 'suspended';
  is_verified: boolean;
  follower_count: number;
  product_count: number;
  total_sales: number;
  rating_avg: number;
  
   // Payment Settings
   payment_method?: 'bank_transfer' | 'paypal' | 'mobile_money' | 'itecpay' | 'other';
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  routing_number?: string;
  paypal_email?: string;
  mobile_money_number?: string;
  
  // Delivery Settings
  delivery_settings: {
    shipping_enabled: boolean;
    delivery_enabled: boolean;
    pickup_enabled: boolean;
    delivery_fee: number;
    delivery_radius_km?: number;
    min_order_for_delivery?: number;
    free_delivery_above?: number;
    delivery_time_est?: string; // e.g. "30-60 mins"
    pickup_instructions?: string;
  };
  
  // Additional Store Info
  phone_number?: string;
  address?: string;
  website_url?: string;
  custom_domain?: string;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
  
  created_at: Date;
  updated_at: Date;
}

const StoreSchema = new Schema<IStore>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner_username: {
    type: String,
    required: true,
    trim: true,
  },
  owner_name: {
    type: String,
    trim: true,
  },
  logo_url: {
    type: String,
  },
  banner_url: {
    type: String,
  },
  category: {
    type: String,
    enum: ['fashion', 'electronics', 'home', 'beauty', 'sports', 'food', 'art', 'books', 'handmade', 'other'],
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'pending',
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  follower_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  product_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  total_sales: {
    type: Number,
    default: 0,
    min: 0,
  },
  rating_avg: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  
   // Payment Settings
   payment_method: {
     type: String,
     enum: ['bank_transfer', 'paypal', 'itecpay', 'mobile_money', 'other'],
     default: 'bank_transfer',
   },
  bank_name: { type: String },
  bank_account_name: { type: String },
  bank_account_number: { type: String },
  routing_number: { type: String },
  paypal_email: { type: String },
  mobile_money_number: { type: String },
  
  // Delivery Settings
  delivery_settings: {
    shipping_enabled: { type: Boolean, default: true },
    delivery_enabled: { type: Boolean, default: false },
    pickup_enabled: { type: Boolean, default: false },
    delivery_fee: { type: Number, default: 0, min: 0 },
    delivery_radius_km: { type: Number, min: 0 },
    min_order_for_delivery: { type: Number, default: 0, min: 0 },
    free_delivery_above: { type: Number, min: 0 },
    delivery_time_est: { type: String, trim: true },
    pickup_instructions: { type: String, trim: true },
  },
  
  // Additional Store Info
  phone_number: { type: String },
  address: { type: String },
  website_url: { type: String },
  custom_domain: { type: String, unique: true, sparse: true },
  social_links: {
    facebook: { type: String },
    instagram: { type: String },
    twitter: { type: String },
    tiktok: { type: String },
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
// unique: every plan currently caps a vendor at 1 store (see PLAN_LIMITS.stores in
// middleware/subscription.ts); drop this constraint if multi-store plans are introduced.
StoreSchema.index({ owner_username: 1 }, { unique: true });
StoreSchema.index({ status: 1 });
StoreSchema.index({ category: 1, status: 1 });
StoreSchema.index({ follower_count: -1 });
StoreSchema.index({ rating_avg: -1 });
StoreSchema.index({ name: 'text' }); // For text search

export const Store = mongoose.model<IStore>('Store', StoreSchema);