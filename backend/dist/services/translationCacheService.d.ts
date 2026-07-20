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
/**
 * Get a cached translation or compute + store it.
 * @param sourceText  Original text to translate
 * @param targetLang  Target language BCP-47 code
 * @param sourceLang  Optional source language hint
 */
export declare function getCachedTranslation(sourceText: string, targetLang: string, sourceLang?: string): Promise<string>;
/**
 * Batch translate multiple texts to the same target language.
 * Checks cache for each individually to maximize cache hits.
 */
export declare function batchGetCachedTranslations(texts: string[], targetLang: string): Promise<Record<string, string>>;
/**
 * Invalidate a specific cache entry (e.g. after dictionary update).
 */
export declare function invalidateCacheEntry(sourceText: string, targetLang: string): Promise<void>;
/**
 * Get cache statistics for admin dashboard.
 */
export declare function getCacheStats(): Promise<{
    l1Size: number;
    l2Size: number;
    topHits: Array<{
        sourceKey: string;
        targetLang: string;
        hitCount: number;
    }>;
}>;
/**
 * Clear L1 in-process cache (L2 MongoDB cache is unaffected).
 */
export declare function clearL1Cache(): void;
//# sourceMappingURL=translationCacheService.d.ts.map