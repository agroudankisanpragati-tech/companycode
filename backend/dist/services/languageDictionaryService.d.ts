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
import { DictionaryCategory } from '../models/LanguageDictionary';
export declare function normalizeKey(raw: string): string;
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
export declare function lookupTerm(raw: string, langCode: string, pageCtx?: string): Promise<LookupResult>;
/**
 * Batch lookup — returns a map of raw → LookupResult.
 */
export declare function lookupTerms(raws: string[], langCode: string, pageCtx?: string): Promise<Record<string, LookupResult>>;
/**
 * Resolve display text for a known English term (used by AI output post-processing).
 */
export declare function resolveDisplayText(englishTerm: string, langCode: string, pageCtx?: string): Promise<string>;
//# sourceMappingURL=languageDictionaryService.d.ts.map