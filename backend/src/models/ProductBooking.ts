import mongoose, { Document, Schema } from 'mongoose';

/**
 * A shopper's claim on a product that's currently out of stock.
 *
 * A booking is a notify-me, not a sale: no money moves and no stock is
 * reserved. When the vendor restocks, everyone waiting is notified and buys
 * in the normal way — first to check out wins. Reserving stock instead would
 * mean holding inventory for people who may never pay, and would need an
 * expiry/refund flow that nothing here asks for.
 */
export interface IProductBooking extends Document {
  _id: mongoose.Types.ObjectId;
  product_id: string;
  product_title?: string;
  product_image?: string;
  // Price when the booking was made, so the shopper can see if it moved.
  product_price?: number;
  store_id?: string;
  store_name?: string;
  vendor_username: string;
  user_username: string;
  user_name?: string;
  quantity: number;
  selected_color?: string;
  selected_size?: string;
  selected_options: { name: string; value: string }[];
  selected_image?: string;
  status: 'waiting' | 'notified' | 'cancelled';
  notified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const ProductBookingSchema = new Schema<IProductBooking>({
  product_id: {
    type: String,
    required: true,
  },
  product_title: { type: String, trim: true },
  product_image: { type: String },
  product_price: { type: Number, min: 0 },
  store_id: { type: String },
  store_name: { type: String, trim: true },
  vendor_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  user_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  user_name: { type: String, trim: true },
  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },
  selected_color: { type: String, trim: true },
  selected_size: { type: String, trim: true },
  selected_options: [{
    name: { type: String, trim: true },
    value: { type: String, trim: true },
    _id: false,
  }],
  selected_image: { type: String },
  status: {
    type: String,
    enum: ['waiting', 'notified', 'cancelled'],
    default: 'waiting',
  },
  notified_at: { type: Date },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Restock notification scans one product's queue, oldest first.
ProductBookingSchema.index({ product_id: 1, status: 1, created_at: 1 });
ProductBookingSchema.index({ user_username: 1, status: 1 });
ProductBookingSchema.index({ vendor_username: 1, status: 1 });

// One live booking per shopper per product. A shopper who wants a different
// variant cancels and books again, rather than stacking duplicate alerts for
// the same restock. Cancelled/notified rows are excluded so the same product
// can be booked again later.
ProductBookingSchema.index(
  { product_id: 1, user_username: 1 },
  { unique: true, partialFilterExpression: { status: 'waiting' } }
);

ProductBookingSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const ProductBooking = mongoose.model<IProductBooking>('ProductBooking', ProductBookingSchema);
