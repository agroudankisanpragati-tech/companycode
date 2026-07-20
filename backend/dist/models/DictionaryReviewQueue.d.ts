import mongoose, { Document } from 'mongoose';
import { DictionaryCategory } from './LanguageDictionary';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged';
export interface IDictionaryReviewQueue extends Document {
    rawInput: string;
    normalizedKey: string;
    suggestedEnglish?: string;
    detectedLang?: string;
    pageContext?: DictionaryCategory;
    status: ReviewStatus;
    mergeTargetId?: mongoose.Types.ObjectId;
    reviewedBy?: string;
    reviewNote?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DictionaryReviewQueue: mongoose.Model<IDictionaryReviewQueue, {}, {}, {}, mongoose.Document<unknown, {}, IDictionaryReviewQueue, {}, {}> & IDictionaryReviewQueue & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DictionaryReviewQueue.d.ts.map