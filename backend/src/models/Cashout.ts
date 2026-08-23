import mongoose, { Schema, Document } from 'mongoose';

export interface ICashout extends Document {
  type: 'profit' | 'orders';
  amount: number;
  currency: string;
  phoneNumber: string;
  provider: 'mtn' | 'airtel';
  note?: string;
  transactionId?: string;
  gatewayResponse?: any;
  requestedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CashoutSchema = new Schema<ICashout>({
  // 'profit' draws from the platform's own commission/subscription earnings;
  // 'orders' draws from gross received order revenue. Kept as two separate
  // pools so cashing one out never overlaps the other's available balance.
  type: {
    type: String,
    enum: ['profit', 'orders'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    default: 'RWF',
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    enum: ['mtn', 'airtel'],
    required: true,
  },
  note: {
    type: String,
  },
  transactionId: {
    type: String,
  },
  gatewayResponse: {
    type: Schema.Types.Mixed,
  },
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

CashoutSchema.index({ createdAt: -1 });
CashoutSchema.index({ type: 1, createdAt: -1 });

export const Cashout = mongoose.model<ICashout>('Cashout', CashoutSchema);
