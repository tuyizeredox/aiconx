import mongoose, { Schema, Document } from 'mongoose';

export interface ISentimentSummary extends Document {
  product_id: string;
  overall_sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  sentiment_score: number; // 0-100
  pros: string[];
  cons: string[];
  summary_text: string;
  review_count_analyzed: number;
  last_updated: Date;
  created_at: Date;
  updated_at: Date;
}

const SentimentSummarySchema = new Schema<ISentimentSummary>({
  product_id: {
    type: String,
    required: true,
    index: true
  },
  overall_sentiment: {
    type: String,
    enum: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'],
    required: true
  },
  sentiment_score: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  pros: [{
    type: String
  }],
  cons: [{
    type: String
  }],
  summary_text: {
    type: String,
    required: true
  },
  review_count_analyzed: {
    type: Number,
    default: 0
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for efficient queries
SentimentSummarySchema.index({ product_id: 1, last_updated: -1 });

export const SentimentSummary = mongoose.model<ISentimentSummary>('SentimentSummary', SentimentSummarySchema);