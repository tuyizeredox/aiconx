import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversation_id: string;
  sender_email?: string;
  sender_username: string;
  sender_name?: string;
  receiver_email?: string;
  receiver_username: string;
  content: string;
  message_type: 'text' | 'image' | 'product_share' | 'order_update' | 'offer';
  image_url?: string;
  product_id?: string;
  product_data?: {
    title: string;
    price: number;
    image?: string;
  };
  offer_amount?: number;
  order_id?: string;
  reply_to_content?: string;
  reply_to_name?: string;
  is_read: boolean;
  read_at?: Date;
  is_edited: boolean;
  is_pinned: boolean;
  reactions?: Record<string, number>;
  deleted_for?: string[];
  created_at: Date;
  updated_at: Date;
}

const MessageSchema = new Schema<IMessage>({
  conversation_id: {
    type: String,
    required: true,
  },
  sender_email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  sender_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  sender_name: {
    type: String,
    trim: true,
  },
  receiver_email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  receiver_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  message_type: {
    type: String,
    enum: ['text', 'image', 'product_share', 'order_update', 'offer'],
    default: 'text',
  },
  image_url: {
    type: String,
  },
  product_id: {
    type: String,
  },
  product_data: {
    title: String,
    price: Number,
    image: String,
  },
  offer_amount: {
    type: Number,
    min: 0,
  },
  order_id: {
    type: String,
  },
  reply_to_content: {
    type: String,
  },
  reply_to_name: {
    type: String,
  },
  is_read: {
    type: Boolean,
    default: false,
  },
  read_at: {
    type: Date,
  },
  is_edited: {
    type: Boolean,
    default: false,
  },
  is_pinned: {
    type: Boolean,
    default: false,
  },
  reactions: {
    type: Map,
    of: Number,
    default: {},
  },
  deleted_for: {
    type: [String],
    default: [],
    index: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
MessageSchema.index({ conversation_id: 1, created_at: 1 });
MessageSchema.index({ sender_username: 1, created_at: -1 });
MessageSchema.index({ receiver_username: 1, created_at: -1 });
MessageSchema.index({ sender_username: 1, receiver_username: 1, created_at: -1 });
MessageSchema.index({ is_read: 1, receiver_username: 1 });
MessageSchema.index({ message_type: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);