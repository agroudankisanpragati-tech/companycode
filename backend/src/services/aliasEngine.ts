/**
 * Alias Engine — Phase 5
 *
 * Handles smart dictionary growth:
 * 1. Normalize unknown words (case, spaces, underscores, hyphens → single key)
 * 2. Compare with existing dictionary aliases using similarity scoring
 * 3. If similarity >= threshold → suggest merge into existing entry
 * 4. If no match → store as new Suggested Word in DictionaryReviewQueue
 * 5. NEVER auto-approve — all suggestions go to admin review
 *
 * Approved words automatically become available across all agents
 * because every agent uses lookupTerm() from languageDictionaryService.
 *
 * Alias examples handled:
 *   "Black Gram" / "BlackGram" / "Black_Gram" / "black-gram" → "blackgram"
 *   Dialect variations → same normalized key, different display fields
 */

import { LanguageDictionary } from '../models/LanguageDictionary';
import { DictionaryReviewQueue } from '../models/DictionaryReviewQueue';
import { normalizeKey } from './languageDictionaryService';

// ─── Similarity threshold ─────────────────────────────────────────────────────
const MERGE_THRESHOLD = 0.75;   // suggest merge if similarity >= this
const QUEUE_THRESHOLD = 0.30;   // skip queue if similarity is too low (noise)

// ─── Similarity scoring ───────────────────────────────────────────────────────

/**
 * Compute similarity between two normalized strings.
 * Uses token overlap + substring containment.
 * Returns 0–1.
 */
export function computeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  // Token overlap (Jaccard-like)
  const tokA = new Set(a.split(/[^a-z0-9]/i).filter(Boolean));
  const tokB = new Set(b.split(/[^a-z0-9]/i).filter(Boolean));
  const intersection = [...tokA].filter(t => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  if (union === 0) return 0;

  const jaccard = intersection / union;

  // Bigram overlap bonus
  const bigrams = (s: string) => {
    const bg = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) bg.add(s.slice(i, i + 2));
    return bg;
  };
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  const bgIntersect = [...bgA].filter(bg => bgB.has(bg)).length;
  const bgUnion = new Set([...bgA, ...bgB]).size;
  const bigramScore = bgUnion > 0 ? bgIntersect / bgUnion : 0;

  return Math.min(1, (jaccard * 0.5) + (bigramScore * 0.5));
}

// ─── Alias match result ───────────────────────────────────────────────────────

export interface AliasMatchResult {
  action: 'exact_match' | 'suggest_merge' | 'queue_new' | 'skip_noise';
  normalizedInput: string;
  /** Set when action is suggest_merge */
  matchedEntryId?: string;
  matchedKey?: string;
  similarity?: number;
}

/**
 * Process an unknown word through the alias engine.
 *
 * Steps:
 * 1. Normalize the input
 * 2. Check for exact match in dictionary (already handled by lookupTerm — skip if found)
 * 3. Scan all aliases for similarity
 * 4. Decide: exact_match | suggest_merge | queue_new | skip_noise
 * 5. Upsert into DictionaryReviewQueue (never auto-approve)
 */
export async function processUnknownWord(
  rawInput: string,
  pageContext?: string,
  detectedLang?: string,
  suggestedEnglish?: string
): Promise<AliasMatchResult> {
  const normalized = normalizeKey(rawInput);

  if (!normalized || normalized.length < 2) {
    return { action: 'skip_noise', normalizedInput: normalized };
  }

  // Step 1: Check exact match in approved dictionary
  const exact = await LanguageDictionary.findOne({
    approved: true,
    $or: [{ normalizedKey: normalized }, { aliases: normalized }],
  }).lean();

  if (exact) {
    return { action: 'exact_match', normalizedInput: normalized };
  }

  // Step 2: Scan all dictionary entries for similarity
  // Fetch only normalizedKey + aliases to keep memory low
  const allEntries = await LanguageDictionary.find({ approved: true })
    .select('_id normalizedKey aliases')
    .lean();

  let bestScore = 0;
  let bestEntry: any = null;

  for (const entry of allEntries) {
    // Compare against normalizedKey
    const s1 = computeSimilarity(normalized, entry.normalizedKey);
    if (s1 > bestScore) { bestScore = s1; bestEntry = entry; }

    // Compare against each alias
    for (const alias of entry.aliases || []) {
      const s2 = computeSimilarity(normalized, alias);
      if (s2 > bestScore) { bestScore = s2; bestEntry = entry; }
    }
  }

  // Step 3: Decide action
  if (bestScore < QUEUE_THRESHOLD) {
    // Too dissimilar — likely noise or a completely new domain term
    // Still queue it so admin can review
    await upsertReviewQueue(rawInput, normalized, pageContext, detectedLang, suggestedEnglish, undefined, undefined);
    return { action: 'skip_noise', normalizedInput: normalized };
  }

  if (bestScore >= MERGE_THRESHOLD && bestEntry) {
    // High similarity — suggest merging into existing entry
    await upsertReviewQueue(
      rawInput, normalized, pageContext, detectedLang, suggestedEnglish,
      bestEntry._id.toString(), bestScore
    );
    return {
      action: 'suggest_merge',
      normalizedInput: normalized,
      matchedEntryId: bestEntry._id.toString(),
      matchedKey: bestEntry.normalizedKey,
      similarity: bestScore,
    };
  }

  // Medium similarity — queue as new word for admin review
  await upsertReviewQueue(rawInput, normalized, pageContext, detectedLang, suggestedEnglish, undefined, bestScore);
  return { action: 'queue_new', normalizedInput: normalized, similarity: bestScore };
}

// ─── Queue upsert helper ──────────────────────────────────────────────────────

async function upsertReviewQueue(
  rawInput: string,
  normalizedKey: string,
  pageContext?: string,
  detectedLang?: string,
  suggestedEnglish?: string,
  suggestedMergeTargetId?: string,
  similarity?: number
): Promise<void> {
  try {
    await DictionaryReviewQueue.updateOne(
      { normalizedKey, status: 'pending' },
      {
        $setOnInsert: {
          rawInput,
          normalizedKey,
          pageContext,
          detectedLang,
          suggestedEnglish,
          suggestedMergeTargetId,
          similarityScore: similarity,
          status: 'pending',
        },
      },
      { upsert: true }
    );
  } catch {
    // Dedup constraint — already queued, ignore
  }
}

// ─── Batch processing ─────────────────────────────────────────────────────────

/**
 * Process multiple unknown words in parallel.
 * Used by the memory engine after each conversation turn.
 */
export async function processBatchUnknownWords(
  words: string[],
  pageContext?: string,
  detectedLang?: string
): Promise<AliasMatchResult[]> {
  return Promise.all(
    words.map(w => processUnknownWord(w, pageContext, detectedLang))
  );
}

/**
 * Extract candidate unknown words from a message.
 * Filters out common stop words and very short tokens.
 */
export function extractCandidateWords(message: string): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
    'and', 'or', 'but', 'if', 'then', 'so', 'yet', 'nor', 'not', 'no',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
    'what', 'how', 'when', 'where', 'why', 'who', 'which', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them',
    'mera', 'meri', 'mere', 'aap', 'kya', 'kaise', 'kab', 'kahan',
  ]);

  return message
    .split(/[\s,।.!?;:]+/)
    .map(w => w.replace(/[^a-zA-Z\u0900-\u097F]/g, '').trim())
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
}
