import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorSubscription extends Document {
  vendor_username: string;
  store_id?: string;
  plan: 'free' | 'pro' | 'elite';
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  billing_cycle: 'monthly' | 'annual';
  pending_plan?: 'pro' | 'elite';
  pending_billing_cycle?: 'monthly' | 'annual';
  pending_amount?: number;
  started_at: Date;
  expires_at?: Date;
  custom_domain?: string;
  payment_method?: string;
  payment_reference?: string;
  last_payment_date?: Date;
  amount?: number;
  comped?: boolean;
  granted_by?: string;
  created_at: Date;
  updated_at: Date;
}

const VendorSubscriptionSchema = new Schema<IVendorSubscription>({
  vendor_username: {
    type: String,
    required: true,
    index: true
  },
  store_id: {
    type: String,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'elite'],
    default: 'free',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'active'
  },
  billing_cycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly'
  },
  pending_plan: {
    type: String,
    enum: ['pro', 'elite'],
    default: null
  },
  pending_billing_cycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: null
  },
  pending_amount: {
    type: Number
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  expires_at: {
    type: Date
  },
  custom_domain: {
    type: String,
    sparse: true,
    unique: true
  },
  payment_method: {
    type: String
  },
  payment_reference: {
    type: String,
    sparse: true,
    unique: true
  },
  last_payment_date: {
    type: Date
  },
  amount: {
    type: Number,
    default: 0
  },
  // Set when a super admin manually grants a plan via /admin/users/:id/subscription
  // instead of the vendor paying for it. Revenue/cashout aggregations must exclude
  // these — no money actually changed hands — even though `amount` may later get
  // synced to the plan's list price for display purposes (see GET /admin/subscriptions).
  comped: {
    type: Boolean,
    default: false
  },
  granted_by: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
VendorSubscriptionSchema.index({ store_id: 1, status: 1 });
VendorSubscriptionSchema.index({ status: 1, expires_at: 1 });

// Ensure one active subscription per vendor/store
VendorSubscriptionSchema.index(
  { vendor_username: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

export const VendorSubscription = mongoose.model<IVendorSubscription>('VendorSubscription', VendorSubscriptionSchema);