import mongoose, { Document, Schema } from 'mongoose';

export interface IStory extends Document {
  _id: mongoose.Types.ObjectId;
  author_email: string;
  author_username: string;
  author_name?: string;
  author_avatar?: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'text';
  caption?: string;
  bg_color: string;
  views_count: number;
  likes_count: number;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const StorySchema = new Schema<IStory>({
  author_email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
  },
  author_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  author_name: {
    type: String,
    trim: true,
  },
  author_avatar: {
    type: String,
  },
  media_url: {
    type: String,
  },
  media_type: {
    type: String,
    required: true,
    enum: ['image', 'video', 'text'],
    default: 'image',
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 2200,
  },
  bg_color: {
    type: String,
    default: '#6366f1',
  },
  views_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  likes_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  expires_at: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  },
  is_active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
StorySchema.index({ author_email: 1, created_at: -1 });
StorySchema.index({ author_username: 1, created_at: -1 });
StorySchema.index({ expires_at: 1 });
StorySchema.index({ is_active: 1, expires_at: 1, created_at: -1 }); // Compound index for listing
StorySchema.index({ created_at: -1 });

// Pre-save middleware to set expiration
StorySchema.pre('save', function(next) {
  if (this.isNew && !this.expires_at) {
    this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

export const Story = mongoose.model<IStory>('Story', StorySchema);