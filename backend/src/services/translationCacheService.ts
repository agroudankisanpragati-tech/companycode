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

import { TranslationCache } from '../models/TranslationCache';
import { normalizeKey } from './languageDictionaryService';
import { translateObject } from './translationService';

// ─── L1 in-process cache (shared with speechTranslationPipeline) ──────────────
const L1_CACHE = new Map<string, string>();

function l1Key(sourceKey: string, targetLang: string): string {
  return `${sourceKey}::${targetLang}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get a cached translation or compute + store it.
 * @param sourceText  Original text to translate
 * @param targetLang  Target language BCP-47 code
 * @param sourceLang  Optional source language hint
 */
export async function getCachedTranslation(
  sourceText: string,
  targetLang: string,
  sourceLang?: string
): Promise<string> {
  if (!sourceText?.trim()) return sourceText;

  const sourceKey = normalizeKey(sourceText);
  const key = l1Key(sourceKey, targetLang);

  // L1 check
  if (L1_CACHE.has(key)) return L1_CACHE.get(key)!;

  // L2 check
  try {
    const cached = await TranslationCache.findOneAndUpdate(
      { sourceKey, targetLang },
      { $inc: { hitCount: 1 }, $set: { lastAccessedAt: new Date() } },
      { new: true }
    ).lean();

    if (cached) {
      L1_CACHE.set(key, cached.translatedText);
      return cached.translatedText;
    }
  } catch {
    // DB unavailable — fall through to AI
  }

  // Cache miss — call AI translation
  let translated = sourceText;
  try {
    const result = await translateObject({ text: sourceText }, targetLang);
    translated = result.text || sourceText;
  } catch {
    return sourceText; // graceful fallback
  }

  // Store in both layers
  L1_CACHE.set(key, translated);
  try {
    await TranslationCache.updateOne(
      { sourceKey, targetLang },
      {
        $setOnInsert: {
          sourceKey,
          targetLang,
          translatedText: translated,
          sourceLang,
          hitCount: 1,
          lastAccessedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch {
    // Duplicate key race — already stored by concurrent request, ignore
  }

  return translated;
}

/**
 * Batch translate multiple texts to the same target language.
 * Checks cache for each individually to maximize cache hits.
 */
export async function batchGetCachedTranslations(
  texts: string[],
  targetLang: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    texts.map(async (text) => {
      results[text] = await getCachedTranslation(text, targetLang);
    })
  );
  return results;
}

/**
 * Invalidate a specific cache entry (e.g. after dictionary update).
 */
export async function invalidateCacheEntry(
  sourceText: string,
  targetLang: string
): Promise<void> {
  const sourceKey = normalizeKey(sourceText);
  L1_CACHE.delete(l1Key(sourceKey, targetLang));
  await TranslationCache.deleteOne({ sourceKey, targetLang });
}

/**
 * Get cache statistics for admin dashboard.
 */
export async function getCacheStats(): Promise<{
  l1Size: number;
  l2Size: number;
  topHits: Array<{ sourceKey: string; targetLang: string; hitCount: number }>;
}> {
  const [l2Size, topHits] = await Promise.all([
    TranslationCache.countDocuments(),
    TranslationCache.find().sort({ hitCount: -1 }).limit(10)
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
export function clearL1Cache(): void {
  L1_CACHE.clear();
}
