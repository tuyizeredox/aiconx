import mongoose, { Document, Schema } from 'mongoose';

export interface ICall extends Document {
  _id: mongoose.Types.ObjectId;
  conversation_id?: string;
  caller_username: string;
  caller_name?: string;
  callee_username: string;
  callee_name?: string;
  call_type: 'voice' | 'video';
  status: 'ringing' | 'answered' | 'rejected' | 'ended' | 'missed';
  started_at?: Date;
  ended_at?: Date;
  duration?: number;
  created_at: Date;
  updated_at: Date;
}

const CallSchema = new Schema<ICall>({
  conversation_id: {
    type: String,
  },
  caller_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  caller_name: {
    type: String,
    trim: true,
  },
  callee_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  callee_name: {
    type: String,
    trim: true,
  },
  call_type: {
    type: String,
    enum: ['voice', 'video'],
    default: 'voice',
  },
  status: {
    type: String,
    enum: ['ringing', 'answered', 'rejected', 'ended', 'missed'],
    default: 'ringing',
  },
  started_at: {
    type: Date,
  },
  ended_at: {
    type: Date,
  },
  duration: {
    type: Number,
    min: 0,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
CallSchema.index({ caller_username: 1, created_at: -1 });
CallSchema.index({ callee_username: 1, created_at: -1 });
CallSchema.index({ status: 1 });
CallSchema.index({ conversation_id: 1 });

export const Call = mongoose.model<ICall>('Call', CallSchema);