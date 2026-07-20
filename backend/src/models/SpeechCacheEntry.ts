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

import mongoose, { Schema, Document } from 'mongoose';

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

const SpeechCacheEntrySchema = new Schema<ISpeechCacheEntry>(
  {
    textKey:        { type: String, required: true },
    langBcp47:      { type: String, required: true },
    langCode:       { type: String, required: true },
    ttsText:        { type: String, required: true },
    displayText:    { type: String, required: true },
    pageContext:    { type: String },
    hitCount:       { type: Number, default: 1 },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index — one entry per text+lang pair
SpeechCacheEntrySchema.index({ textKey: 1, langBcp47: 1 }, { unique: true });

// TTL — auto-expire after 7 days of no access
SpeechCacheEntrySchema.index(
  { lastAccessedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

export const SpeechCacheEntry = mongoose.model<ISpeechCacheEntry>(
  'SpeechCacheEntry',
  SpeechCacheEntrySchema
);
