import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlistItem extends Document {
  user_username: string;
  product_id: string;
  product_title: string;
  product_image?: string;
  product_price: number;
  compare_at_price?: number;
  store_id: string;
  store_name: string;
  vendor_username: string;
  /**
   * Stock state as of the last reminder sweep. Only a false -> true
   * transition is worth telling the shopper about, so the sweep needs to
   * remember what it saw last time.
   */
  last_known_in_stock?: boolean;
  created_at: Date;
  updated_at: Date;
}

const WishlistItemSchema = new Schema<IWishlistItem>({
  user_username: {
    type: String,
    required: true,
    index: true
  },
  product_id: {
    type: String,
    required: true,
    index: true
  },
  product_title: {
    type: String,
    required: true
  },
  product_image: {
    type: String
  },
  product_price: {
    type: Number,
    required: true,
    min: 0
  },
  compare_at_price: {
    type: Number,
    min: 0
  },
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
  last_known_in_stock: {
    type: Boolean
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
WishlistItemSchema.index({ user_username: 1, product_id: 1 }, { unique: true });
WishlistItemSchema.index({ user_username: 1, created_at: -1 });
WishlistItemSchema.index({ store_id: 1, created_at: -1 });

export const WishlistItem = mongoose.model<IWishlistItem>('WishlistItem', WishlistItemSchema);