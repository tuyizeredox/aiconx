import mongoose, { Schema, Document } from 'mongoose';

export interface IWithdrawal extends Document {
   vendor_username: string; // holds either the vendor's or the affiliate's username, per payee_type
   payee_type: 'vendor' | 'affiliate';
   store_id?: string;
   store_name?: string;
   amount: number;
   payment_method: 'bank_transfer' | 'paypal' | 'mobile_money' | 'itecpay';
   bank_account_name?: string;
   bank_account_number?: string;
   bank_name?: string;
   routing_number?: string;
   paypal_email?: string;
   mobile_money_number?: string;
   status: 'pending' | 'processing' | 'completed' | 'rejected';
   notes?: string;
   processed_at?: Date;
   created_at: Date;
   updated_at: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>({
  vendor_username: {
    type: String,
    required: true,
    index: true
  },
  payee_type: {
    type: String,
    enum: ['vendor', 'affiliate'],
    default: 'vendor',
  },
  store_id: {
    type: String,
    index: true
  },
  store_name: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 1, // real floor lives in Settings.min_withdrawal_amount, enforced in the route
  },
   payment_method: {
     type: String,
     enum: ['bank_transfer', 'paypal', 'mobile_money', 'itecpay'],
     default: 'bank_transfer',
     required: true
   },
  bank_account_name: {
    type: String,
  },
  bank_account_number: {
    type: String,
  },
  bank_name: {
    type: String,
  },
  routing_number: {
    type: String
  },
  paypal_email: {
    type: String
  },
  mobile_money_number: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String
  },
  processed_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
WithdrawalSchema.index({ vendor_username: 1, status: 1 });
WithdrawalSchema.index({ vendor_username: 1, created_at: -1 });
WithdrawalSchema.index({ status: 1, created_at: -1 });
WithdrawalSchema.index({ store_id: 1, status: 1 });

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);