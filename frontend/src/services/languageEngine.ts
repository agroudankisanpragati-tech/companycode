/**
 * Pragati Language Engine — Phase 1 Foundation
 *
 * Architecture: Farmer → Speech/Text → Language Engine → Root AI → Page AI
 *
 * Display rules:
 *   English selected  → Show English, Speak English
 *   Any other lang    → Show Hindi,   Speak selected language/dialect
 *
 * Reusable by every page. No page code needs to change.
 * Speech datasets can be added later without touching this file.
 */

import { LANGUAGES, getLang, getVoiceBcp47, isNonEnglish, isRajasthanDialect } from '@/i18n/languages';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LanguageEngineConfig {
  langCode: string;
}

export interface ProcessedInput {
  original: string;
  forBackend: string;
  langCode: string;
}

export interface ProcessedOutput {
  display: string;
  voiceBcp47: string;
  langCode: string;
}

export type PageContext =
  | 'disease' | 'soil' | 'government' | 'weather'
  | 'market'  | 'crop' | 'shop'       | 'ui';

export interface DictionaryLookupResult {
  found: boolean;
  english: string;
  hindi: string;
  dialectText?: string;
  displayText: string;
  voiceText: string;
  confidence: number;
}

// ─── Key Normalization ────────────────────────────────────────────────────────

/**
 * Normalize any term so BlackGram, Black Gram, Black_Gram, black-gram
 * all resolve to the same key: "blackgram"
 */
export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_\-]+/g, '');
}

// ─── Page Context Detection ───────────────────────────────────────────────────

/**
 * Detect page context from the current URL pathname.
 * Disease pages prioritize disease terms, Government pages prioritize scheme terms, etc.
 */
export function detectPageContext(pathname?: string): PageContext {
  const path = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  if (path.includes('disease'))   return 'disease';
  if (path.includes('soil'))      return 'soil';
  if (path.includes('scheme') || path.includes('government') || path.includes('govt')) return 'government';
  if (path.includes('weather'))   return 'weather';
  if (path.includes('mandi') || path.includes('market') || path.includes('price')) return 'market';
  if (path.includes('crop') || path.includes('advisory')) return 'crop';
  if (path.includes('shop'))      return 'shop';
  return 'ui';
}

// ─── Dictionary Lookup (calls backend) ───────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Look up a single term via the Language Dictionary API.
 * Returns display text (Hindi for non-English) and voice text (dialect if available).
 */
export async function lookupTerm(
  term: string,
  langCode: string,
  pageCtx?: PageContext
): Promise<DictionaryLookupResult> {
  try {
    const params = new URLSearchParams({ term, lang: langCode });
    if (pageCtx) params.set('ctx', pageCtx);
    const res = await fetch(`${API_BASE}/api/language-dictionary/lookup?${params}`);
    if (!res.ok) throw new Error('lookup failed');
    const json = await res.json();
    return json.data as DictionaryLookupResult;
  } catch {
    // Graceful fallback — never break the page
    return { found: false, english: term, hindi: term, displayText: term, voiceText: term, confidence: 0 };
  }
}

/**
 * Batch lookup for multiple terms at once.
 */
export async function lookupTerms(
  terms: string[],
  langCode: string,
  pageCtx?: PageContext
): Promise<Record<string, DictionaryLookupResult>> {
  try {
    const res = await fetch(`${API_BASE}/api/language-dictionary/lookup-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms, lang: langCode, ctx: pageCtx }),
    });
    if (!res.ok) throw new Error('batch lookup failed');
    const json = await res.json();
    return json.data as Record<string, DictionaryLookupResult>;
  } catch {
    return Object.fromEntries(
      terms.map(t => [t, { found: false, english: t, hindi: t, displayText: t, voiceText: t, confidence: 0 }])
    );
  }
}

// ─── Display Rules ────────────────────────────────────────────────────────────

/** English selected → English; any other → Hindi */
export function getDisplayLangCode(appLangCode: string): string {
  return isNonEnglish(appLangCode) ? 'hi' : 'en';
}

/** TTS BCP-47: English → en-IN; dialect → dialect fallback (hi-IN); others → their bcp47 */
export function getTtsBcp47(appLangCode: string): string {
  return getVoiceBcp47(appLangCode);
}

export function getSttBcp47(appLangCode: string): string {
  return getVoiceBcp47(appLangCode);
}

/**
 * Apply display rules to a known English/Hindi pair.
 * English selected → show English, speak English.
 * Any other lang   → show Hindi, speak dialect (or Hindi fallback).
 */
export function prepareOutputForDisplay(
  englishText: string,
  hindiText: string | undefined,
  appLangCode: string,
): ProcessedOutput {
  const isEn = !isNonEnglish(appLangCode);
  return {
    display: isEn ? englishText : (hindiText || englishText),
    voiceBcp47: getTtsBcp47(appLangCode),
    langCode: appLangCode,
  };
}

export function prepareInputForBackend(text: string, appLangCode: string): ProcessedInput {
  return { original: text, forBackend: text, langCode: appLangCode };
}

// ─── Utility helpers (unchanged API — zero regression) ────────────────────────

export function isRtlLanguage(appLangCode: string): boolean {
  return getLang(appLangCode).dir === 'rtl';
}

export function getLanguageLabel(appLangCode: string): string {
  const lang = getLang(appLangCode);
  return `${lang.flag} ${lang.nativeName}`;
}

export function getLanguageGroups(): {
  national: typeof LANGUAGES;
  rajasthanDialects: typeof LANGUAGES;
} {
  return {
    national: LANGUAGES.filter(l => !l.isDialect),
    rajasthanDialects: LANGUAGES.filter(l => l.isDialect),
  };
}

export function isSupportedLanguage(code: string): boolean {
  return !!LANGUAGES.find(l => l.code === code);
}

export function resolveVoiceLang(appLangCode: string): string {
  return getTtsBcp47(appLangCode);
}

export function resolveListenLang(appLangCode: string): string {
  return getSttBcp47(appLangCode);
}

export function shouldShowHindi(appLangCode: string): boolean {
  return isNonEnglish(appLangCode);
}

export function shouldShowEnglishOnly(appLangCode: string): boolean {
  return !isNonEnglish(appLangCode);
}

export function getAiDisplayMode(appLangCode: string): 'en' | 'hi' | 'both' {
  if (appLangCode === 'en') return 'en';
  if (appLangCode === 'hi' || isRajasthanDialect(appLangCode)) return 'hi';
  return 'both';
}

/** Extension point: new languages are added to languages.ts — no logic changes needed. */
export function registerLanguage(code: string): boolean {
  return isSupportedLanguage(code);
}
