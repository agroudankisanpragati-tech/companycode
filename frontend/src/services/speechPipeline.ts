/**
 * Speech Pipeline Service — Frontend
 *
 * Wraps the backend /api/language-engine/pipeline endpoints with:
 *   - Client-side translation cache (translationCache.ts)
 *   - Graceful fallback (never throws, never breaks a page)
 *   - Display rule enforcement:
 *       English selected → displayText = English, voiceText = English
 *       Any other lang   → displayText = Hindi,   voiceText = dialect
 *
 * This service is called by useSpeechPipeline hook.
 * It does NOT import React — it is a pure async service.
 */

import { getCached, setCached } from '@/utils/translationCache';
import { detectLangFromText, needsTranslationToEnglish } from '@/utils/languageDetector';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  original: string;
  detectedLang: string;
  englishForBackend: string;
  hindiDisplay: string;
  voiceText: string;
  displayText: string;
  foundInDictionary: boolean;
  confidence: number;
}

export interface OutputTranslation {
  displayText: string;
  voiceText: string;
}

// ─── Fallback result (used when network fails) ────────────────────────────────

function fallback(rawText: string, appLangCode: string): PipelineResult {
  return {
    original: rawText,
    detectedLang: detectLangFromText(rawText) || appLangCode,
    englishForBackend: rawText,
    hindiDisplay: rawText,
    voiceText: rawText,
    displayText: rawText,
    foundInDictionary: false,
    confidence: 0,
  };
}

// ─── Run full pipeline for a single input ────────────────────────────────────

export async function runPipeline(
  rawText: string,
  appLangCode: string,
  pageContext?: string
): Promise<PipelineResult> {
  const trimmed = rawText.trim();
  if (!trimmed) return fallback('', appLangCode);

  // Check cache first
  const cached = getCached(trimmed, appLangCode, pageContext || '');
  if (cached) {
    try {
      return JSON.parse(cached) as PipelineResult;
    } catch { /* corrupt cache entry — proceed to fetch */ }
  }

  // Skip network call if English and no translation needed
  if (!needsTranslationToEnglish(trimmed, appLangCode)) {
    const result: PipelineResult = {
      original: trimmed,
      detectedLang: 'en',
      englishForBackend: trimmed,
      hindiDisplay: trimmed,
      voiceText: trimmed,
      displayText: trimmed,
      foundInDictionary: false,
      confidence: 0,
    };
    setCached(trimmed, appLangCode, JSON.stringify(result), pageContext || '');
    return result;
  }

  try {
    const res = await fetch(`${API_BASE}/language-engine/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: trimmed, appLangCode, pageContext }),
    });
    if (!res.ok) throw new Error('pipeline request failed');
    const json = await res.json();
    const result = json.data as PipelineResult;
    setCached(trimmed, appLangCode, JSON.stringify(result), pageContext || '');
    return result;
  } catch {
    return fallback(trimmed, appLangCode);
  }
}

// ─── Translate English backend output for display ─────────────────────────────

export async function translateOutput(
  englishText: string,
  appLangCode: string
): Promise<OutputTranslation> {
  if (!englishText?.trim() || appLangCode === 'en') {
    return { displayText: englishText, voiceText: englishText };
  }

  const cached = getCached(englishText, appLangCode, '__output__');
  if (cached) {
    try { return JSON.parse(cached) as OutputTranslation; } catch { /* proceed */ }
  }

  try {
    const res = await fetch(`${API_BASE}/language-engine/translate-output`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ englishText, appLangCode }),
    });
    if (!res.ok) throw new Error('translate-output failed');
    const json = await res.json();
    const result = json.data as OutputTranslation;
    setCached(englishText, appLangCode, JSON.stringify(result), '__output__');
    return result;
  } catch {
    return { displayText: englishText, voiceText: englishText };
  }
}

// ─── Detect language from text (client-side fast path + server confirm) ───────

export async function detectLanguage(text: string): Promise<string> {
  // Fast client-side detection first
  const clientDetected = detectLangFromText(text);
  if (clientDetected !== 'hi') return clientDetected; // confident non-Devanagari

  // For Devanagari text, confirm with server (may distinguish dialects in future)
  try {
    const res = await fetch(`${API_BASE}/language-engine/detect-language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return clientDetected;
    const json = await res.json();
    return json.data?.detectedLang || clientDetected;
  } catch {
    return clientDetected;
  }
}
