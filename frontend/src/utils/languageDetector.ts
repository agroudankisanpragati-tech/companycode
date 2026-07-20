/**
 * Language Detector — Frontend
 *
 * Detects language/script from text using Unicode character ranges.
 * Also detects Rajasthan dialects by combining Unicode detection with
 * the app's selected language code (since dialects share Devanagari script).
 *
 * This mirrors the backend detectLanguageFromText() but runs client-side
 * so STT results can be classified before any network call.
 */

import { isRajasthanDialect } from '@/i18n/languages';

const UNICODE_MAP: Array<{ range: RegExp; code: string }> = [
  { range: /[\u0900-\u097F]/, code: 'hi' },   // Devanagari (Hindi, Marwari dialects)
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

/**
 * Detect language code from text content alone.
 * Returns 'en' for ASCII-dominant text, 'hi' for Devanagari, etc.
 */
export function detectLangFromText(text: string): string {
  if (!text?.trim()) return 'en';
  for (const { range, code } of UNICODE_MAP) {
    if (range.test(text)) return code;
  }
  const asciiRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length;
  return asciiRatio > 0.7 ? 'en' : 'hi';
}

/**
 * Detect the effective language for a piece of text, taking the app's
 * selected language into account.
 *
 * If the app language is a Rajasthan dialect and the text is Devanagari,
 * we keep the dialect code (not downgrade to 'hi') so TTS uses the right voice.
 */
export function detectEffectiveLang(text: string, appLangCode: string): string {
  const fromText = detectLangFromText(text);

  // If app is set to a dialect and text is Devanagari → honour the dialect
  if (isRajasthanDialect(appLangCode) && fromText === 'hi') {
    return appLangCode;
  }

  // If text is clearly a different script than the app language, trust the text
  if (fromText !== 'en' && fromText !== appLangCode) {
    return fromText;
  }

  return appLangCode;
}

/**
 * Returns true if the text contains non-ASCII characters
 * (i.e. is likely in an Indian language script).
 */
export function isNonLatinText(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

/**
 * Returns true if the text needs translation to English before
 * being sent to the backend.
 */
export function needsTranslationToEnglish(text: string, appLangCode: string): boolean {
  if (appLangCode === 'en') return false;
  return true; // any non-English app language → pipeline must translate
}
