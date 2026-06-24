import mongoose, { Document, Schema } from 'mongoose';

export interface ICommunityMember extends Document {
  _id: mongoose.Types.ObjectId;
  community_id: string;
  member_username: string;
  role: 'member' | 'moderator' | 'admin';
  joined_at: Date;
}

const CommunityMemberSchema = new Schema<ICommunityMember>({
  community_id: {
    type: String,
    required: true,
  },
  member_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['member', 'moderator', 'admin'],
    default: 'member',
  },
}, {
  timestamps: {
    createdAt: 'joined_at',
    updatedAt: false, // Membership doesn't need updated_at
  },
});

// Compound indexes for performance and uniqueness
CommunityMemberSchema.index({ community_id: 1, member_username: 1 }, { unique: true });
CommunityMemberSchema.index({ member_username: 1, joined_at: -1 });
CommunityMemberSchema.index({ community_id: 1, role: 1 });

export const CommunityMember = mongoose.model<ICommunityMember>('CommunityMember', CommunityMemberSchema);