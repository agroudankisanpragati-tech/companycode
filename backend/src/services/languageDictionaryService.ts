/**
 * Language Dictionary Service
 * Central lookup engine for all term translations.
 * - Normalizes keys (case, spaces, underscores, hyphens)
 * - Prioritizes by page context (disease page → disease terms first)
 * - Queues unknown words for admin review
 * - Resolves display text per display rules:
 *     English selected → English
 *     Any other lang   → Hindi (display) + dialect (voice)
 */

import { LanguageDictionary, ILanguageDictionary, DictionaryCategory } from '../models/LanguageDictionary';
import { DictionaryReviewQueue } from '../models/DictionaryReviewQueue';

// ─── Dialect code → field name map ───────────────────────────────────────────

const DIALECT_FIELD: Record<string, keyof ILanguageDictionary> = {
  mwr: 'marwari',
  mew: 'mewari',
  dhu: 'dhundhari',
  hao: 'hadoti',
  shk: 'shekhawati',
  bag: 'bagri',
  wag: 'wagdi',
  mti: 'mewati',
  gdw: 'godwari',
  ahi: 'ahirwati',
  mlv: 'malvi',
};

// ─── Page context → category priority list ───────────────────────────────────

const CONTEXT_PRIORITY: Record<string, DictionaryCategory[]> = {
  disease:    ['diseases', 'pests', 'crops', 'agriculture'],
  soil:       ['soil', 'fertilizers', 'crops', 'agriculture'],
  government: ['government', 'agriculture', 'crops'],
  weather:    ['weather', 'agriculture', 'crops'],
  market:     ['crops', 'agriculture', 'fertilizers'],
  crop:       ['crops', 'agriculture', 'fertilizers', 'soil'],
  shop:       ['fertilizers', 'crops', 'agriculture'],
  ui:         ['ui', 'agriculture'],
};

// ─── Normalize ────────────────────────────────────────────────────────────────

export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_\-]+/g, '');
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export interface LookupResult {
  found: boolean;
  english: string;
  hindi: string;
  dialectText?: string;
  displayText: string;
  voiceText: string;
  confidence: number;
  category?: DictionaryCategory;
}

/**
 * Look up a term and return display + voice text according to display rules.
 * @param raw      Raw user input (any case/spacing)
 * @param langCode App language code ('en', 'hi', 'mwr', …)
 * @param pageCtx  Page context key ('disease', 'soil', 'government', …)
 */
export async function lookupTerm(
  raw: string,
  langCode: string,
  pageCtx?: string
): Promise<LookupResult> {
  const key = normalizeKey(raw);
  const baseQuery = { approved: true, $or: [{ normalizedKey: key }, { aliases: key }] };

  let entry: ILanguageDictionary | null = null;

  if (pageCtx && CONTEXT_PRIORITY[pageCtx]) {
    for (const cat of CONTEXT_PRIORITY[pageCtx]) {
      entry = await LanguageDictionary.findOne({ ...baseQuery, category: cat }).lean() as ILanguageDictionary | null;
      if (entry) break;
    }
  }

  if (!entry) {
    entry = await LanguageDictionary.findOne(baseQuery).lean() as ILanguageDictionary | null;
  }

  if (!entry) {
    // Queue unknown word for admin review (deduplicate)
    await DictionaryReviewQueue.updateOne(
      { normalizedKey: key, status: 'pending' },
      { $setOnInsert: { rawInput: raw, normalizedKey: key, pageContext: pageCtx as DictionaryCategory } },
      { upsert: true }
    );
    return { found: false, english: raw, hindi: raw, displayText: raw, voiceText: raw, confidence: 0 };
  }

  const isEnglish = langCode === 'en';
  const dialectField = DIALECT_FIELD[langCode];
  const dialectText = dialectField ? (entry[dialectField] as string | undefined) : undefined;

  const displayText = isEnglish ? entry.english : entry.hindi;
  const voiceText   = isEnglish ? entry.english : (dialectText || entry.hindi);

  return {
    found: true,
    english: entry.english,
    hindi: entry.hindi,
    dialectText,
    displayText,
    voiceText,
    confidence: entry.confidence,
    category: entry.category,
  };
}

/**
 * Batch lookup — returns a map of raw → LookupResult.
 */
export async function lookupTerms(
  raws: string[],
  langCode: string,
  pageCtx?: string
): Promise<Record<string, LookupResult>> {
  const results = await Promise.all(raws.map(r => lookupTerm(r, langCode, pageCtx)));
  return Object.fromEntries(raws.map((r, i) => [r, results[i]]));
}

/**
 * Resolve display text for a known English term (used by AI output post-processing).
 */
export async function resolveDisplayText(
  englishTerm: string,
  langCode: string,
  pageCtx?: string
): Promise<string> {
  const result = await lookupTerm(englishTerm, langCode, pageCtx);
  return result.displayText;
}
