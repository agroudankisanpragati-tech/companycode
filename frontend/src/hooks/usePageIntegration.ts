'use client';

/**
 * usePageIntegration — Final Enterprise Integration Hook
 *
 * The single hook every page uses to get fully integrated:
 *   - Language Engine (auto page-context detection)
 *   - Voice Engine (shared singleton from VoiceEngineProvider)
 *   - Display rules (English → English, other → Hindi display / dialect voice)
 *   - Automatic X-App-Language + X-Page-Context headers on all API calls
 *
 * Pragati AI is the one and only AI the user interacts with.
 * Internal modules (crop, disease, soil, etc.) enrich Pragati AI's context
 * but are never exposed in the UI.
 *
 * Usage (same on every page — zero page-specific wiring needed):
 *   const page = usePageIntegration();
 *   const label = await page.translate('Black Gram');
 *   page.speak('Leaf Blight detected', 'पत्ती झुलसा रोग पाया गया');
 *   const result = await page.processInput('उड़द दाल');
 *
 * Adding a new language/dialect requires ZERO changes here.
 * Swapping voice provider requires ZERO changes here.
 */

import { useCallback, useMemo } from 'react';
import { useLanguageEngine } from '@/hooks/useLanguageEngine';
import { useVoiceEngineContext } from '@/components/VoiceEngineProvider';
import { useSpeechPipeline } from '@/hooks/useSpeechPipeline';
import { detectPageContext } from '@/utils/pageContext';
import type { PipelineResult } from '@/services/speechPipeline';
import type { TermResult } from '@/hooks/useLanguageEngine';

export interface PageIntegration {
  /** Current language code */
  langCode: string;
  /** Current page context (auto-detected from URL) */
  pageCtx: string;
  /** True when non-English is selected */
  showHindi: boolean;
  /** True when English is selected */
  showEnglishOnly: boolean;
  /** BCP-47 for TTS */
  voiceLang: string;
  /** BCP-47 for STT */
  listenLang: string;

  /** Translate a single term via the Language Engine */
  translate: (term: string) => Promise<TermResult>;
  /** Translate multiple terms in one call */
  translateBatch: (terms: string[]) => Promise<Record<string, TermResult>>;
  /** Resolve display/voice text locally (no network call) */
  resolveLocal: (english: string, hindi?: string) => { display: string; voiceBcp47: string; langCode: string };

  /** Process typed/spoken input through the full speech pipeline */
  processInput: (rawText: string) => Promise<PipelineResult>;
  /** Translate English AI/DB output for display */
  translateOutput: (englishText: string) => Promise<{ displayText: string; voiceText: string }>;

  /** Speak text — applies display rules automatically */
  speak: (englishText: string, hindiText?: string) => Promise<void>;
  /** Interrupt current speech */
  interrupt: () => void;
  /** Replay last spoken text */
  replay: () => void;
  /** Start STT listening */
  startListening: (onResult: (result: PipelineResult) => void) => void;
  /** Stop STT listening */
  stopListening: () => void;

  /** True once voice engine is ready */
  voiceReady: boolean;
  /** True while speech pipeline is processing */
  processing: boolean;

  /**
   * Build fetch headers that include language context.
   * Pass to every API call so the backend auto-attaches langCode + pageContext.
   */
  apiHeaders: (extraHeaders?: Record<string, string>) => Record<string, string>;
}

export function usePageIntegration(overrideContext?: string): PageIntegration {
  const langEngine = useLanguageEngine(overrideContext);
  const voice = useVoiceEngineContext();
  const pipeline = useSpeechPipeline(overrideContext);

  const pageCtx = useMemo(
    () => overrideContext ?? detectPageContext(),
    [overrideContext]
  );

  const apiHeaders = useCallback(
    (extra: Record<string, string> = {}): Record<string, string> => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      return {
        'Content-Type': 'application/json',
        'X-App-Language': langEngine.langCode,
        'X-Page-Context': pageCtx,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
      };
    },
    [langEngine.langCode, pageCtx]
  );

  const speak = useCallback(
    async (englishText: string, hindiText?: string) => {
      await voice.speak(englishText, hindiText);
    },
    [voice]
  );

  const startListening = useCallback(
    (onResult: (result: PipelineResult) => void) => {
      pipeline.startListening(onResult, pageCtx);
    },
    [pipeline, pageCtx]
  );

  return {
    langCode: langEngine.langCode,
    pageCtx,
    showHindi: langEngine.showHindi,
    showEnglishOnly: langEngine.showEnglishOnly,
    voiceLang: langEngine.voiceLang,
    listenLang: langEngine.listenLang,
    translate: langEngine.translate,
    translateBatch: langEngine.translateBatch,
    resolveLocal: langEngine.resolveLocal,
    processInput: pipeline.processText,
    translateOutput: pipeline.translateForDisplay,
    speak,
    interrupt: voice.interrupt,
    replay: voice.replay,
    startListening,
    stopListening: pipeline.stopListening,
    voiceReady: voice.ready,
    processing: pipeline.processing,
    apiHeaders,
  };
}
