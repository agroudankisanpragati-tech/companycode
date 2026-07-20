/**
 * SpeechCacheEntry Model — Phase 6
 *
 * Caches common speech responses (TTS text + metadata) so they can be
 * served offline or without repeated AI/translation calls.
 *
 * Security rules:
 * - Raw audio is NEVER stored here (only text + metadata).
 * - Audio blobs are stored externally only if explicitly enabled.
 * - This model stores only the text payload and pronunciation hints.
 *
 * TTL: 7 days (MongoDB TTL index on lastAccessedAt).
 */
import mongoose, { Document } from 'mongoose';
export interface ISpeechCacheEntry extends Document {
    /** Normalized source text key */
    textKey: string;
    /** Target language BCP-47 code */
    langBcp47: string;
    /** App language code (hi, mwr, en, …) */
    langCode: string;
    /** Text ready for TTS (cleaned, pronunciation-corrected) */
    ttsText: string;
    /** Display text (Hindi for non-English, English for English) */
    displayText: string;
    /** Page context this was generated for */
    pageContext?: string;
    /** Number of times served from cache */
    hitCount: number;
    lastAccessedAt: Date;
    createdAt: Date;
}
export declare const SpeechCacheEntry: mongoose.Model<ISpeechCacheEntry, {}, {}, {}, mongoose.Document<unknown, {}, ISpeechCacheEntry, {}, {}> & ISpeechCacheEntry & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SpeechCacheEntry.d.ts.map