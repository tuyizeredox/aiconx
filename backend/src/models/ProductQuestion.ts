import mongoose, { Document, Schema } from 'mongoose';

/**
 * A public question a shopper asked about a product, plus the vendor's answer.
 *
 * Answers live on the question document rather than in a separate collection
 * because only the product's vendor can answer, and only once — a thread model
 * would add moderation surface (buyer-to-buyer replies) that nothing in the
 * product page asks for yet.
 */
export interface IProductQuestion extends Document {
  _id: mongoose.Types.ObjectId;
  product_id: string;
  store_id?: string;
  vendor_username: string;
  asker_username: string;
  asker_name?: string;
  question: string;
  answer?: string;
  answered_by?: string;
  answered_at?: Date;
  helpful_count: number;
  status: 'published' | 'hidden';
  created_at: Date;
  updated_at: Date;
}

const ProductQuestionSchema = new Schema<IProductQuestion>({
  product_id: {
    type: String,
    required: true,
  },
  store_id: {
    type: String,
  },
  vendor_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  asker_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  asker_name: {
    type: String,
    trim: true,
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  answer: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  answered_by: {
    type: String,
    lowercase: true,
    trim: true,
  },
  answered_at: {
    type: Date,
  },
  helpful_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['published', 'hidden'],
    default: 'published',
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// The product page lists answered questions first, newest within each group.
ProductQuestionSchema.index({ product_id: 1, status: 1, answered_at: -1, created_at: -1 });
// Lets a vendor find everything waiting on them across their catalog.
ProductQuestionSchema.index({ vendor_username: 1, answer: 1 });

ProductQuestionSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const ProductQuestion = mongoose.model<IProductQuestion>('ProductQuestion', ProductQuestionSchema);
