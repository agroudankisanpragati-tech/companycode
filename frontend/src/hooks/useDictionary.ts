'use client';

import { useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import {
  lookupTerm,
  lookupTerms,
  detectPageContext,
  normalizeKey,
  type PageContext,
  type DictionaryLookupResult,
} from '@/services/languageEngine';

/**
 * useDictionary — reusable hook for every page.
 *
 * Usage:
 *   const { resolve, resolveBatch, pageCtx } = useDictionary();
 *   const result = await resolve('BlackGram');   // auto-detects page context
 *
 * Display rules are applied automatically:
 *   English selected → displayText = English
 *   Any other lang   → displayText = Hindi, voiceText = dialect (if available)
 */
export function useDictionary(overrideCtx?: PageContext) {
  const { langCode } = useLanguage();

  const pageCtx: PageContext = overrideCtx ?? detectPageContext();

  const resolve = useCallback(
    (term: string): Promise<DictionaryLookupResult> =>
      lookupTerm(term, langCode, pageCtx),
    [langCode, pageCtx]
  );

  const resolveBatch = useCallback(
    (terms: string[]): Promise<Record<string, DictionaryLookupResult>> =>
      lookupTerms(terms, langCode, pageCtx),
    [langCode, pageCtx]
  );

  return { resolve, resolveBatch, pageCtx, normalizeKey };
}
