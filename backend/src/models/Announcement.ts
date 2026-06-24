import mongoose, { Document, Schema } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  target: 'all' | 'vendors' | 'users';
  is_active: boolean;
  expires_at?: Date;
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info',
  },
  target: {
    type: String,
    enum: ['all', 'vendors', 'users'],
    default: 'all',
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  expires_at: {
    type: Date,
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Index for performance
AnnouncementSchema.index({ is_active: 1, target: 1, expires_at: 1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
