import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem extends Document {
  _id: mongoose.Types.ObjectId;
  user_username: string;
  product_id: string;
  product_title: string;
  product_image?: string;
  product_price: number;
  store_id: string;
  store_name?: string;
  quantity: number;
  selected_color?: string;
  selected_size?: string;
  selected_options?: { name: string; value: string }[];
  selected_image?: string;
  affiliate_username?: string;
  created_at: Date;
  updated_at: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  user_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  product_id: {
    type: String,
    required: true,
  },
  product_title: {
    type: String,
    required: true,
  },
  product_image: {
    type: String,
  },
  product_price: {
    type: Number,
    required: true,
    min: 0,
  },
  store_id: {
    type: String,
    required: true,
  },
  store_name: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  selected_color: {
    type: String,
    trim: true,
  },
  selected_size: {
    type: String,
    trim: true,
  },
  selected_options: [{
    name: { type: String, trim: true },
    value: { type: String, trim: true },
    _id: false,
  }],
  selected_image: {
    type: String,
  },
  affiliate_username: {
    type: String,
    lowercase: true,
    trim: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
CartItemSchema.index({ user_username: 1 });
CartItemSchema.index({ product_id: 1 });
CartItemSchema.index({ store_id: 1 });

export const CartItem = mongoose.model<ICartItem>('CartItem', CartItemSchema);