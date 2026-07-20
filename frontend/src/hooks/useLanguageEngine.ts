/**
 * useLanguageEngine — Reusable Language Engine hook.
 *
 * Every page/component that needs translated terms calls this hook.
 * It automatically:
 *   - Detects page context from the current URL
 *   - Applies display rules (English → English, other → Hindi display / dialect voice)
 *   - Queues unknown terms for admin review via the backend
 *
 * Usage:
 *   const { translate, translateBatch, displayText, voiceLang } = useLanguageEngine();
 *   const label = await translate('Black Gram');
 *
 * Adding a new language/dialect in the future requires NO changes here —
 * only languages.ts and the LanguageDictionary need updating.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { detectPageContext } from '@/utils/pageContext';
import { getCached, setCached } from '@/utils/translationCache';
import {
  getDisplayLangCode,
  getTtsBcp47,
  getSttBcp47,
  shouldShowHindi,
  shouldShowEnglishOnly,
  prepareOutputForDisplay,
} from '@/services/languageEngine';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface TermResult {
  found: boolean;
  english: string;
  hindi: string;
  dialectText?: string;
  displayText: string;
  voiceText: string;
  confidence: number;
}

export function useLanguageEngine(overrideContext?: string) {
  const { langCode } = useLanguage();

  const pageCtx = useMemo(
    () => overrideContext ?? detectPageContext(),
    [overrideContext]
  );

  /** Translate a single term via the backend dictionary */
  const translate = useCallback(
    async (term: string): Promise<TermResult> => {
      // Check shared cache first
      const cacheKey = `lookup::${term}`;
      const cached = getCached(term, langCode, pageCtx);
      if (cached) {
        try { return JSON.parse(cached) as TermResult; } catch { /* proceed */ }
      }
      try {
        const params = new URLSearchParams({ term, lang: langCode, ctx: pageCtx });
        const res = await fetch(`${API_BASE}/language-engine/lookup?${params}`);
        if (!res.ok) throw new Error('lookup failed');
        const json = await res.json();
        const result = json.data as TermResult;
        setCached(term, langCode, JSON.stringify(result), pageCtx);
        return result;
      } catch {
        return {
          found: false,
          english: term,
          hindi: term,
          displayText: term,
          voiceText: term,
          confidence: 0,
        };
      }
    },
    [langCode, pageCtx]
  );

  /** Translate multiple terms in one request */
  const translateBatch = useCallback(
    async (terms: string[]): Promise<Record<string, TermResult>> => {
      if (terms.length === 0) return {};
      try {
        const res = await fetch(`${API_BASE}/language-engine/lookup-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terms, lang: langCode, ctx: pageCtx }),
        });
        if (!res.ok) throw new Error('batch lookup failed');
        const json = await res.json();
        return json.data as Record<string, TermResult>;
      } catch {
        // Graceful fallback
        return Object.fromEntries(
          terms.map((t) => [t, { found: false, english: t, hindi: t, displayText: t, voiceText: t, confidence: 0 }])
        );
      }
    },
    [langCode, pageCtx]
  );

  /**
   * Resolve display + voice text for a known English/Hindi pair
   * without a backend call (uses local display rules only).
   */
  const resolveLocal = useCallback(
    (englishText: string, hindiText?: string) =>
      prepareOutputForDisplay(englishText, hindiText, langCode),
    [langCode]
  );

  return {
    langCode,
    pageCtx,
    /** BCP-47 tag for TTS */
    voiceLang: getTtsBcp47(langCode),
    /** BCP-47 tag for STT */
    listenLang: getSttBcp47(langCode),
    /** Display language code: 'en' or 'hi' */
    displayLangCode: getDisplayLangCode(langCode),
    /** True when non-English is selected */
    showHindi: shouldShowHindi(langCode),
    /** True when English is selected */
    showEnglishOnly: shouldShowEnglishOnly(langCode),
    /** Translate a single term via backend dictionary */
    translate,
    /** Translate multiple terms in one backend call */
    translateBatch,
    /** Resolve display/voice text locally without a backend call */
    resolveLocal,
  };
}
