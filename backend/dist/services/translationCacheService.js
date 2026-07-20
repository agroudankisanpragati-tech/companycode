"use strict";
/**
 * Persistent Translation Cache Service — Phase 5
 *
 * Two-layer cache:
 *   L1: In-process Map (fast, lost on restart) — from speechTranslationPipeline.ts
 *   L2: MongoDB TranslationCache (persistent, survives restarts, 30-day TTL)
 *
 * This service wraps both layers. All existing callers of translateObject()
 * are NOT changed — this is an additive layer called by the memory engine.
 *
 * Rules:
 * - Check L1 first (zero DB cost)
 * - On L1 miss, check L2 (one DB read)
 * - On L2 miss, call AI translation, store in both L1 and L2
 * - Never duplicate translations for the same source+lang pair
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedTranslation = getCachedTranslation;
exports.batchGetCachedTranslations = batchGetCachedTranslations;
exports.invalidateCacheEntry = invalidateCacheEntry;
exports.getCacheStats = getCacheStats;
exports.clearL1Cache = clearL1Cache;
const TranslationCache_1 = require("../models/TranslationCache");
const languageDictionaryService_1 = require("./languageDictionaryService");
const translationService_1 = require("./translationService");
// ─── L1 in-process cache (shared with speechTranslationPipeline) ──────────────
const L1_CACHE = new Map();
function l1Key(sourceKey, targetLang) {
    return `${sourceKey}::${targetLang}`;
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Get a cached translation or compute + store it.
 * @param sourceText  Original text to translate
 * @param targetLang  Target language BCP-47 code
 * @param sourceLang  Optional source language hint
 */
async function getCachedTranslation(sourceText, targetLang, sourceLang) {
    if (!sourceText?.trim())
        return sourceText;
    const sourceKey = (0, languageDictionaryService_1.normalizeKey)(sourceText);
    const key = l1Key(sourceKey, targetLang);
    // L1 check
    if (L1_CACHE.has(key))
        return L1_CACHE.get(key);
    // L2 check
    try {
        const cached = await TranslationCache_1.TranslationCache.findOneAndUpdate({ sourceKey, targetLang }, { $inc: { hitCount: 1 }, $set: { lastAccessedAt: new Date() } }, { new: true }).lean();
        if (cached) {
            L1_CACHE.set(key, cached.translatedText);
            return cached.translatedText;
        }
    }
    catch {
        // DB unavailable — fall through to AI
    }
    // Cache miss — call AI translation
    let translated = sourceText;
    try {
        const result = await (0, translationService_1.translateObject)({ text: sourceText }, targetLang);
        translated = result.text || sourceText;
    }
    catch {
        return sourceText; // graceful fallback
    }
    // Store in both layers
    L1_CACHE.set(key, translated);
    try {
        await TranslationCache_1.TranslationCache.updateOne({ sourceKey, targetLang }, {
            $setOnInsert: {
                sourceKey,
                targetLang,
                translatedText: translated,
                sourceLang,
                hitCount: 1,
                lastAccessedAt: new Date(),
            },
        }, { upsert: true });
    }
    catch {
        // Duplicate key race — already stored by concurrent request, ignore
    }
    return translated;
}
/**
 * Batch translate multiple texts to the same target language.
 * Checks cache for each individually to maximize cache hits.
 */
async function batchGetCachedTranslations(texts, targetLang) {
    const results = {};
    await Promise.all(texts.map(async (text) => {
        results[text] = await getCachedTranslation(text, targetLang);
    }));
    return results;
}
/**
 * Invalidate a specific cache entry (e.g. after dictionary update).
 */
async function invalidateCacheEntry(sourceText, targetLang) {
    const sourceKey = (0, languageDictionaryService_1.normalizeKey)(sourceText);
    L1_CACHE.delete(l1Key(sourceKey, targetLang));
    await TranslationCache_1.TranslationCache.deleteOne({ sourceKey, targetLang });
}
/**
 * Get cache statistics for admin dashboard.
 */
async function getCacheStats() {
    const [l2Size, topHits] = await Promise.all([
        TranslationCache_1.TranslationCache.countDocuments(),
        TranslationCache_1.TranslationCache.find().sort({ hitCount: -1 }).limit(10)
            .select('sourceKey targetLang hitCount').lean(),
    ]);
    return {
        l1Size: L1_CACHE.size,
        l2Size,
        topHits: topHits.map(h => ({
            sourceKey: h.sourceKey,
            targetLang: h.targetLang,
            hitCount: h.hitCount,
        })),
    };
}
/**
 * Clear L1 in-process cache (L2 MongoDB cache is unaffected).
 */
function clearL1Cache() {
    L1_CACHE.clear();
}
//# sourceMappingURL=translationCacheService.js.map