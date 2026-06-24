import mongoose, { Schema, Document } from 'mongoose';

export interface IShippingZone extends Document {
  vendor_username: string;
  store_id?: string;
  zone_name: string; // e.g. Domestic, Europe, Asia-Pacific
  countries: string[]; // Country codes e.g. US, CA, GB
  flat_rate: number; // Flat shipping cost in USD
  free_above: number; // Order amount above which shipping is free (0 = never free)
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ShippingZoneSchema = new Schema<IShippingZone>({
  vendor_username: {
    type: String,
    required: true,
    index: true
  },
  store_id: {
    type: String,
    index: true
  },
  zone_name: {
    type: String,
    required: true
  },
  countries: [{
    type: String,
    uppercase: true,
    minlength: 2,
    maxlength: 5 // Allow 'WORLD' for worldwide shipping
  }],
  flat_rate: {
    type: Number,
    required: true,
    min: 0
  },
  free_above: {
    type: Number,
    default: 0,
    min: 0
  },
  estimated_days_min: {
    type: Number,
    default: 3,
    min: 1
  },
  estimated_days_max: {
    type: Number,
    default: 7,
    min: 1
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
ShippingZoneSchema.index({ vendor_username: 1, is_active: 1 });
ShippingZoneSchema.index({ store_id: 1, is_active: 1 });

// Ensure zone names are unique per vendor/store
ShippingZoneSchema.index({ vendor_username: 1, zone_name: 1 }, { unique: true });
ShippingZoneSchema.index({ store_id: 1, zone_name: 1 }, { unique: true, sparse: true });

export const ShippingZone = mongoose.model<IShippingZone>('ShippingZone', ShippingZoneSchema);