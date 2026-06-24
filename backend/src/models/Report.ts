import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reporter_id: mongoose.Types.ObjectId;
  target_id: mongoose.Types.ObjectId;
  target_type: 'user' | 'store' | 'post' | 'product' | 'comment' | 'community' | 'live_chat_message';
  reason: string;
  description?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_notes?: string;
  resolved_at?: Date;
  resolved_by?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const ReportSchema = new Schema<IReport>({
  reporter_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  target_id: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  target_type: {
    type: String,
    enum: ['user', 'store', 'post', 'product', 'comment', 'community', 'live_chat_message'],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
  },
  admin_notes: {
    type: String,
  },
  resolved_at: {
    type: Date,
  },
  resolved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

ReportSchema.index({ status: 1, created_at: -1 });
ReportSchema.index({ target_id: 1, target_type: 1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
