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

import mongoose, { Schema, Document } from 'mongoose';

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

const TranslationCacheSchema = new Schema<ITranslationCache>(
  {
    sourceKey:      { type: String, required: true },
    targetLang:     { type: String, required: true },
    translatedText: { type: String, required: true },
    sourceLang:     { type: String },
    hitCount:       { type: Number, default: 1 },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index — one translation per source+lang pair
TranslationCacheSchema.index({ sourceKey: 1, targetLang: 1 }, { unique: true });

// TTL index — auto-expire after 30 days of no access
TranslationCacheSchema.index({ lastAccessedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const TranslationCache = mongoose.model<ITranslationCache>(
  'TranslationCache',
  TranslationCacheSchema
);
