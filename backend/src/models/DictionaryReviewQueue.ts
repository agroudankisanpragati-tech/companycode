import mongoose, { Document, Schema } from 'mongoose';
import { DictionaryCategory } from './LanguageDictionary';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export interface IDictionaryReviewQueue extends Document {
  rawInput: string;
  normalizedKey: string;
  suggestedEnglish?: string;
  detectedLang?: string;
  pageContext?: DictionaryCategory;
  status: ReviewStatus;
  mergeTargetId?: mongoose.Types.ObjectId;  // if merged into existing entry
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DictionaryReviewQueueSchema = new Schema<IDictionaryReviewQueue>(
  {
    rawInput:         { type: String, required: true },
    normalizedKey:    { type: String, required: true, index: true },
    suggestedEnglish: String,
    detectedLang:     String,
    pageContext:      String,
    status:           { type: String, enum: ['pending','approved','rejected','merged'], default: 'pending', index: true },
    mergeTargetId:    { type: Schema.Types.ObjectId, ref: 'LanguageDictionary' },
    reviewedBy:       String,
    reviewNote:       String,
  },
  { timestamps: true }
);

export const DictionaryReviewQueue = mongoose.model<IDictionaryReviewQueue>(
  'DictionaryReviewQueue',
  DictionaryReviewQueueSchema
);
