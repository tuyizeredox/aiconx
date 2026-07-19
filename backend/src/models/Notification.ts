import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient_username: string;
  type: 'like' | 'comment' | 'follow' | 'order_update' | 'message' | 'mention' | 'repost' | 'community' | 'promotion' | 'offer' | 'subscription_limit' | 'product_added' | 'verification' | 'moderation';
  title: string;
  body?: string;
  link?: string;
  sender_username?: string;
  sender_name?: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'follow', 'order_update', 'message', 'mention', 'repost', 'community', 'promotion', 'offer', 'subscription_limit', 'product_added', 'verification', 'moderation'],
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    trim: true,
  },
  link: {
    type: String,
  },
  sender_username: {
    type: String,
    lowercase: true,
    trim: true,
  },
  sender_name: {
    type: String,
    trim: true,
  },
  is_read: {
    type: Boolean,
    default: false,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
NotificationSchema.index({ recipient_username: 1, created_at: -1 });
NotificationSchema.index({ recipient_username: 1, is_read: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ sender_username: 1 });
NotificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 7_776_000 }); // TTL: 90 days

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);