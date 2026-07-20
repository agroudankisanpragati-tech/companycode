/**
 * TranslationCache Model — Phase 5
 *
 * Persistent translation cache stored in MongoDB.
 * Extends the in-process Map cache in speechTranslationPipeline.ts
 * so translations survive server restarts.
 *
 * Key: normalizedSourceText + targetLang (compound unique index)
 * TTL: 30 days (auto-expire via MongoDB TTL index)
 */
import mongoose, { Document } from 'mongoose';
export interface ITranslationCache extends Document {
    /** Normalized source text (lowercase, trimmed) */
    sourceKey: string;
    /** Target language BCP-47 code */
    targetLang: string;
    /** Translated text */
    translatedText: string;
    /** Source language detected */
    sourceLang?: string;
    /** Number of times this cache entry was hit */
    hitCount: number;
    /** Last time this entry was accessed */
    lastAccessedAt: Date;
    createdAt: Date;
}
export declare const TranslationCache: mongoose.Model<ITranslationCache, {}, {}, {}, mongoose.Document<unknown, {}, ITranslationCache, {}, {}> & ITranslationCache & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=TranslationCache.d.ts.map