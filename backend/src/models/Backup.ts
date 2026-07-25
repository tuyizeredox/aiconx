import mongoose, { Document, Schema } from 'mongoose';

export interface IBackup extends Document {
  _id: mongoose.Types.ObjectId;
  filename: string;
  provider: 's3' | 'local';
  location: string; // S3 key, or absolute local file path
  size_bytes?: number;
  collections_count?: number;
  documents_count?: number;
  status: 'running' | 'success' | 'failed';
  error_message?: string;
  triggered_by: 'cron' | 'manual';
  triggered_by_user?: mongoose.Types.ObjectId;
  started_at: Date;
  finished_at?: Date;
}

const BackupSchema = new Schema<IBackup>({
  filename: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    enum: ['s3', 'local'],
    required: true,
  },
  location: {
    type: String,
    default: '',
  },
  size_bytes: {
    type: Number,
  },
  collections_count: {
    type: Number,
  },
  documents_count: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['running', 'success', 'failed'],
    default: 'running',
  },
  error_message: {
    type: String,
  },
  triggered_by: {
    type: String,
    enum: ['cron', 'manual'],
    required: true,
  },
  triggered_by_user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  started_at: {
    type: Date,
    required: true,
    default: Date.now,
  },
  finished_at: {
    type: Date,
  },
});

BackupSchema.index({ started_at: -1 });
BackupSchema.index({ status: 1, started_at: -1 });

export const Backup = mongoose.model<IBackup>('Backup', BackupSchema);
