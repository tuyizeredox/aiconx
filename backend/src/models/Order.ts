import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product_id: string;
  product_title: string;
  product_image?: string;
  quantity: number;
  price: number;
  selected_color?: string;
  selected_size?: string;
  selected_options?: { name: string; value: string }[];
  selected_image?: string;
  inventory_deducted?: boolean;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  buyer_username: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  vendor_username: string;
  store_id: string;
  store_name?: string;
  items: IOrderItem[];
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  delivery_fee: number;
  delivery_method: 'shipping' | 'delivery' | 'pickup';
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  shipping_address?: string;
  shipping_country?: string;
  estimated_delivery?: string;
  pickup_instructions?: string;
  tracking_number?: string;
  order_note?: string;
   affiliate_username?: string;
   affiliate_commission: number;
   affiliate_link_id?: string;
   affiliate_commission_credited: boolean;
   payment_method: 'card' | 'paypal' | 'crypto' | 'bank_transfer' | 'mobile_money' | 'itecpay' | 'mtn' | 'airtel' | 'spenn';
   payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
   payment_reference?: string;
   payment_provider?: 'stripe' | 'itecpay';
  stock_restored: boolean;
  created_at: Date;
  updated_at: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
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
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
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
  inventory_deducted: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  buyer_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  buyer_name: {
    type: String,
    trim: true,
  },
  buyer_email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  buyer_phone: {
    type: String,
    trim: true,
  },
  vendor_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  store_id: {
    type: String,
    required: true,
  },
  store_name: {
    type: String,
    trim: true,
  },
  items: [OrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  shipping_fee: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount_amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  delivery_fee: {
    type: Number,
    default: 0,
    min: 0,
  },
  delivery_method: {
    type: String,
    enum: ['shipping', 'delivery', 'pickup'],
    default: 'shipping',
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },
  shipping_address: {
    type: String,
  },
  shipping_country: {
    type: String,
    uppercase: true,
    minlength: 2,
    maxlength: 2,
  },
  estimated_delivery: {
    type: String,
  },
  pickup_instructions: {
    type: String,
  },
  tracking_number: {
    type: String,
  },
  order_note: {
    type: String,
    trim: true,
  },
  affiliate_username: {
    type: String,
    lowercase: true,
    trim: true,
  },
  affiliate_commission: {
    type: Number,
    default: 0,
    min: 0,
  },
  affiliate_link_id: {
    type: String,
  },
  affiliate_commission_credited: {
    type: Boolean,
    default: false,
  },
   payment_method: {
     type: String,
     enum: ['card', 'paypal', 'crypto', 'bank_transfer', 'itecpay', 'mobile_money', 'mtn', 'airtel', 'spenn'],
     default: 'itecpay',
   },
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  payment_reference: {
    type: String,
    trim: true,
  },
   payment_provider: {
     type: String,
     enum: ['stripe', 'itecpay'],
     default: 'itecpay',
   },
  stock_restored: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
OrderSchema.index({ buyer_username: 1, created_at: -1 });
OrderSchema.index({ vendor_username: 1, created_at: -1 });
OrderSchema.index({ store_id: 1, created_at: -1 });
OrderSchema.index({ status: 1, created_at: -1 });
OrderSchema.index({ payment_status: 1 });
OrderSchema.index({ affiliate_username: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);