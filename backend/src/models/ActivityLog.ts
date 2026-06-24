import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  user_id: mongoose.Types.ObjectId;
  action: string;
  target_id?: mongoose.Types.ObjectId;
  target_type?: string;
  metadata?: any;
  ip_address?: string;
  created_at: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  target_id: {
    type: Schema.Types.ObjectId,
  },
  target_type: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
  ip_address: {
    type: String,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false,
  },
});

ActivityLogSchema.index({ created_at: -1 });
ActivityLogSchema.index({ user_id: 1, created_at: -1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 2_592_000 }); // TTL: 30 days

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
