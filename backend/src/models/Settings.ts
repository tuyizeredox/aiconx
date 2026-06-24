import mongoose, { Document, Schema } from 'mongoose';

export interface IPlanPrices {
  free: { monthly: number; annual: number };
  pro: { monthly: number; annual: number };
  elite: { monthly: number; annual: number };
}

export interface ISettings extends Document {
  maintenance_mode: boolean;
  maintenance_message?: string;
  allow_registration: boolean;
  min_withdrawal_amount: number;
  platform_fee_percent: number;
  subscription_mode: boolean;
  plan_prices?: IPlanPrices;
  updated_at: Date;
}

const SettingsSchema = new Schema<ISettings>({
  maintenance_mode: {
    type: Boolean,
    default: false,
  },
  maintenance_message: {
    type: String,
    default: 'Aicon X is currently under maintenance. Please check back later.',
  },
  allow_registration: {
    type: Boolean,
    default: true,
  },
  min_withdrawal_amount: {
    type: Number,
    default: 10,
  },
  platform_fee_percent: {
    type: Number,
    default: 5,
  },
  subscription_mode: {
    type: Boolean,
    default: false,
  },
  plan_prices: {
    type: new mongoose.Schema({
      free: { monthly: { type: Number, default: 0 }, annual: { type: Number, default: 0 } },
      pro:  { monthly: { type: Number, default: 29000 }, annual: { type: Number, default: 23000 } },
      elite:{ monthly: { type: Number, default: 79000 }, annual: { type: Number, default: 63000 } },
    }, { _id: false }),
    default: () => ({
      free:  { monthly: 0,     annual: 0 },
      pro:   { monthly: 29000, annual: 23000 },
      elite: { monthly: 79000, annual: 63000 },
    }),
  },
}, {
  timestamps: {
    createdAt: false,
    updatedAt: 'updated_at',
  },
});

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);