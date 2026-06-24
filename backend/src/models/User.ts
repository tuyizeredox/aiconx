import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  is_verified: boolean;
  notifications?: {
    notif_sales: boolean;
    notif_msg: boolean;
    notif_follow: boolean;
    notif_live: boolean;
  };
  preferences?: {
    theme: 'light' | 'dark';
    language: string;
  };
  is_2fa_enabled: boolean;
  two_factor_secret?: string;
  email_verification_code?: string;
  email_verification_expiry?: Date;
  phone_number?: string;
  is_phone_verified: boolean;
  phone_verification_code?: string;
  phone_verification_expiry?: Date;
  reset_token?: string;
  reset_token_expiry?: Date;
  google_id?: string;
  role: 'user' | 'vendor' | 'super_admin';
  is_blocked: boolean;
  follower_count: number;
  following_count: number;
  unread_messages_count: number;
  is_online: boolean;
  last_seen_at: Date;
  push_tokens?: string[];
  saved_addresses?: Array<{
    label?: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    is_default: boolean;
  }>;
  current_challenge?: string;
  current_challenge_expires_at?: Date;
  authenticators: Array<{
    credentialID: string;
    credentialPublicKey: string;
    counter: number;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports?: string[];
  }>;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function(this: any) {
      return !this.google_id;
    },
    select: false,
  },
  display_name: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  google_id: {
    type: String,
    unique: true,
    sparse: true,
  },
  bio: {
    type: String,
    maxlength: 500,
  },
  avatar_url: {
    type: String,
  },
  banner_url: {
    type: String,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  notifications: {
    notif_sales: { type: Boolean, default: true },
    notif_msg: { type: Boolean, default: true },
    notif_follow: { type: Boolean, default: true },
    notif_live: { type: Boolean, default: false },
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'en' },
  },
  is_2fa_enabled: {
    type: Boolean,
    default: false,
  },
  two_factor_secret: {
    type: String,
    select: false,
  },
  email_verification_code: {
    type: String,
    select: false,
  },
  email_verification_expiry: {
    type: Date,
    select: false,
  },
  phone_number: {
    type: String,
    trim: true,
  },
  is_phone_verified: {
    type: Boolean,
    default: false,
  },
  phone_verification_code: {
    type: String,
    select: false,
  },
  phone_verification_expiry: {
    type: Date,
    select: false,
  },
  reset_token: {
    type: String,
    select: false,
  },
  reset_token_expiry: {
    type: Date,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'vendor', 'super_admin'],
    default: 'user',
  },
  is_blocked: {
    type: Boolean,
    default: false,
  },
  follower_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  following_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  unread_messages_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  is_online: {
    type: Boolean,
    default: false,
  },
  last_seen_at: {
    type: Date,
    default: null,
  },
  push_tokens: [{
    type: String,
    trim: true,
  }],
  saved_addresses: [{
    label: { type: String, trim: true, default: 'Default' },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'NG' },
    phone: { type: String, trim: true },
    is_default: { type: Boolean, default: false },
  }],
  current_challenge: {
    type: String,
    select: false,
  },
  current_challenge_expires_at: {
    type: Date,
    select: false,
  },
  authenticators: [{
    credentialID: { type: String, required: true },
    credentialPublicKey: { type: String, required: true },
    counter: { type: Number, required: true },
    credentialDeviceType: { type: String, required: true },
    credentialBackedUp: { type: Boolean, required: true },
    transports: [String],
  }],
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
UserSchema.index({ created_at: -1 });
UserSchema.index({ push_tokens: 1 });
UserSchema.index({ is_blocked: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ is_online: 1 });
UserSchema.index({ username: 'text', email: 'text', display_name: 'text' });

export const User = mongoose.model<IUser>('User', UserSchema);