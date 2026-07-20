/**
 * Speech Translation Pipeline — Backend Service
 *
 * Full pipeline:
 *   Raw text (any language/dialect)
 *     → Language detection
 *     → Dictionary normalization (Phase 1 LanguageDictionary)
 *     → English internal representation (for YOLO / DB / AI)
 *     → Hindi display text
 *     → Dialect voice text
 *
 * Rules enforced here:
 *   - Backend modules (YOLO, DB, AI) ALWAYS receive English.
 *   - English selected → display English, speak English.
 *   - Any other language → display Hindi, speak selected dialect.
 *   - Unknown words → queued for admin review (via languageDictionaryService).
 *   - Translations are cached in-process (Map) to avoid redundant AI calls.
 *
 * This service is stateless and reusable by every route.
 */

import { lookupTerm, normalizeKey } from './languageDictionaryService';
import { translateObject } from './translationService';

// ─── In-process translation cache ────────────────────────────────────────────
// Key: `${normalizedText}::${targetLang}`
const TRANSLATION_CACHE = new Map<string, string>();

function cacheKey(text: string, lang: string) {
  return `${normalizeKey(text)}::${lang}`;
}

// ─── Language detection via Unicode ranges ────────────────────────────────────

const UNICODE_LANG_MAP: Array<{ range: RegExp; code: string }> = [
  { range: /[\u0900-\u097F]/, code: 'hi' },   // Devanagari → Hindi / Marwari dialects
  { range: /[\u0980-\u09FF]/, code: 'bn' },   // Bengali
  { range: /[\u0A00-\u0A7F]/, code: 'pa' },   // Gurmukhi → Punjabi
  { range: /[\u0A80-\u0AFF]/, code: 'gu' },   // Gujarati
  { range: /[\u0B00-\u0B7F]/, code: 'or' },   // Odia
  { range: /[\u0B80-\u0BFF]/, code: 'ta' },   // Tamil
  { range: /[\u0C00-\u0C7F]/, code: 'te' },   // Telugu
  { range: /[\u0C80-\u0CFF]/, code: 'kn' },   // Kannada
  { range: /[\u0D00-\u0D7F]/, code: 'ml' },   // Malayalam
  { range: /[\u0600-\u06FF]/, code: 'ur' },   // Arabic script → Urdu
];

export function detectLanguageFromText(text: string): string {
  if (!text?.trim()) return 'en';
  for (const { range, code } of UNICODE_LANG_MAP) {
    if (range.test(text)) return code;
  }
  // ASCII-dominant → English
  const asciiRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length;
  return asciiRatio > 0.7 ? 'en' : 'hi';
}

// ─── Dialect → display language mapping ──────────────────────────────────────
// All Rajasthan dialects use Devanagari script → detected as 'hi'.
// For display purposes they all show Hindi; for voice they use their dialect BCP-47.
const DIALECT_CODES = new Set([
  'raj', 'mwr', 'mew', 'dhu', 'hao', 'shk', 'bag', 'wag', 'mti', 'gdw', 'ahi', 'mlv',
]);

export function isDialect(langCode: string): boolean {
  return DIALECT_CODES.has(langCode);
}

// ─── Core pipeline types ──────────────────────────────────────────────────────

export interface PipelineInput {
  /** Raw text from STT or keyboard */
  rawText: string;
  /** App language code selected by user ('en', 'hi', 'mwr', …) */
  appLangCode: string;
  /** Page context for dictionary priority ('disease', 'soil', 'crop', …) */
  pageContext?: string;
}

export interface PipelineResult {
  /** Original raw input */
  original: string;
  /** Detected language code */
  detectedLang: string;
  /** Normalized English text — sent to YOLO / DB / AI */
  englishForBackend: string;
  /** Hindi text — shown in UI for non-English users */
  hindiDisplay: string;
  /** Text for TTS in the selected dialect */
  voiceText: string;
  /** Final display text (English if en selected, Hindi otherwise) */
  displayText: string;
  /** Whether the term was found in the dictionary */
  foundInDictionary: boolean;
  /** Confidence score from dictionary (0–1) */
  confidence: number;
}

// ─── Main pipeline function ───────────────────────────────────────────────────

export async function runSpeechTranslationPipeline(
  input: PipelineInput
): Promise<PipelineResult> {
  const { rawText, appLangCode, pageContext } = input;
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      original: rawText,
      detectedLang: appLangCode,
      englishForBackend: '',
      hindiDisplay: '',
      voiceText: '',
      displayText: '',
      foundInDictionary: false,
      confidence: 0,
    };
  }

  // Step 1: Detect language from text content
  const detectedLang = detectLanguageFromText(trimmed) || appLangCode;

  // Step 2: Dictionary lookup — normalizes key, handles aliases, queues unknowns
  const lookup = await lookupTerm(trimmed, appLangCode, pageContext);

  if (lookup.found) {
    // Step 3a: Dictionary hit — use stored translations
    const isEn = appLangCode === 'en';
    return {
      original: trimmed,
      detectedLang,
      englishForBackend: lookup.english,
      hindiDisplay: lookup.hindi,
      voiceText: lookup.voiceText,
      displayText: isEn ? lookup.english : lookup.hindi,
      foundInDictionary: true,
      confidence: lookup.confidence,
    };
  }

  // Step 3b: Not in dictionary — translate to English via AI if non-English input
  let englishForBackend = trimmed;
  let hindiDisplay = trimmed;

  if (appLangCode !== 'en') {
    // Only attempt translation when an API key is configured.
    // Without a key the pipeline still works — it passes the raw text through.
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    // Try to get English translation
    const ck = cacheKey(trimmed, 'en');
    if (TRANSLATION_CACHE.has(ck)) {
      englishForBackend = TRANSLATION_CACHE.get(ck)!;
    } else if (hasApiKey) {
      try {
        const translated = await translateObject({ text: trimmed }, 'en' as any);
        englishForBackend = translated.text || trimmed;
        TRANSLATION_CACHE.set(ck, englishForBackend);
      } catch {
        englishForBackend = trimmed;
      }
    }
    // No API key — pass raw text to backend (intent engine handles it)

    // Get Hindi display text if not already Hindi
    if (appLangCode !== 'hi' && !isDialect(appLangCode)) {
      const hk = cacheKey(trimmed, 'hi');
      if (TRANSLATION_CACHE.has(hk)) {
        hindiDisplay = TRANSLATION_CACHE.get(hk)!;
      } else if (hasApiKey) {
        try {
          const translated = await translateObject({ text: trimmed }, 'hi');
          hindiDisplay = translated.text || trimmed;
          TRANSLATION_CACHE.set(hk, hindiDisplay);
        } catch {
          hindiDisplay = trimmed;
        }
      } else {
        hindiDisplay = trimmed;
      }
    } else {
      // Devanagari input (hi or dialect) — already displayable as Hindi
      hindiDisplay = trimmed;
    }
  }

  const isEn = appLangCode === 'en';
  return {
    original: trimmed,
    detectedLang,
    englishForBackend,
    hindiDisplay,
    voiceText: isEn ? englishForBackend : hindiDisplay,
    displayText: isEn ? englishForBackend : hindiDisplay,
    foundInDictionary: false,
    confidence: 0,
  };
}

// ─── Batch pipeline ───────────────────────────────────────────────────────────

export async function runBatchPipeline(
  inputs: PipelineInput[]
): Promise<PipelineResult[]> {
  return Promise.all(inputs.map(runSpeechTranslationPipeline));
}

// ─── Translate English backend output → display language ─────────────────────
// Used after AI/DB returns English content, to prepare it for display.

export async function translateOutputForDisplay(
  englishText: string,
  appLangCode: string
): Promise<{ displayText: string; voiceText: string }> {
  if (appLangCode === 'en' || !englishText?.trim()) {
    return { displayText: englishText, voiceText: englishText };
  }

  const hasApiKey = !!process.env.OPENAI_API_KEY;
  if (!hasApiKey) {
    return { displayText: englishText, voiceText: englishText };
  }

  // Non-English: display Hindi, voice in dialect
  const ck = cacheKey(englishText, 'hi');
  let hindiText: string;

  if (TRANSLATION_CACHE.has(ck)) {
    hindiText = TRANSLATION_CACHE.get(ck)!;
  } else {
    try {
      const translated = await translateObject({ text: englishText }, 'hi');
      hindiText = translated.text || englishText;
      TRANSLATION_CACHE.set(ck, hindiText);
    } catch {
      hindiText = englishText;
    }
  }

  return { displayText: hindiText, voiceText: hindiText };
}

// ─── Cache utilities (for admin/testing) ─────────────────────────────────────

export function getCacheSize(): number {
  return TRANSLATION_CACHE.size;
}

export function clearTranslationCache(): void {
  TRANSLATION_CACHE.clear();
}
