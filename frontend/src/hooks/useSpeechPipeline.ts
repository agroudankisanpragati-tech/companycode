/**
 * useSpeechPipeline — The single reusable Speech & Translation hook.
 *
 * Full pipeline on every page:
 *   Speech/Text
 *     → Language Detection (client-side Unicode + server confirm)
 *     → Dialect Detection (from app language selection)
 *     → Speech-to-Text (Web Speech API via useVoiceAI)
 *     → Dictionary Normalization (Phase 1 LanguageDictionary)
 *     → English Internal Representation (for YOLO / DB / AI)
 *     → [AI/DB processes in English — not this hook's concern]
 *     → Hindi Display Layer (translateOutput)
 *     → Voice Output Layer (useVoiceAI TTS)
 *
 * Display rules enforced:
 *   English selected → displayText = English, TTS speaks English
 *   Any other lang   → displayText = Hindi,   TTS speaks selected dialect
 *
 * Usage:
 *   const pipeline = useSpeechPipeline();
 *
 *   // Process typed/pasted text:
 *   const result = await pipeline.processText('उड़द दाल');
 *   result.englishForBackend  // → 'Black_gram'  (send to YOLO/AI)
 *   result.displayText        // → 'उड़द दाल'    (show in UI)
 *
 *   // Start voice input:
 *   pipeline.startListening((transcript) => { ... });
 *
 *   // Speak AI response:
 *   await pipeline.speak('Your crop has leaf blight.', hindiTranslation);
 *
 *   // Translate AI English output for display:
 *   const { displayText, voiceText } = await pipeline.translateForDisplay('Leaf Blight detected.');
 *
 * Adding a new language/dialect requires ZERO changes here.
 * Only languages.ts + LanguageDictionary seed need updating.
 */

'use client';

import { useCallback, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useVoiceAI } from '@/hooks/useVoiceAI';
import { detectPageContext } from '@/utils/pageContext';
import { runPipeline, translateOutput } from '@/services/speechPipeline';
import type { PipelineResult, OutputTranslation } from '@/services/speechPipeline';
import type { TtsState, SttState, SttError } from '@/hooks/useVoiceAI';

export type { PipelineResult, OutputTranslation };

export interface SpeechPipelineState {
  /** TTS playback state */
  ttsState: TtsState;
  /** STT listening state */
  sttState: SttState;
  /** STT error type */
  sttError: SttError;
  /** Interim STT transcript (live, before final) */
  interim: string;
  /** Whether TTS is supported in this browser */
  ttsSupported: boolean;
  /** Whether STT is supported in this browser */
  sttSupported: boolean;
  /** True while pipeline is processing (network call in flight) */
  processing: boolean;
  /** Last pipeline result */
  lastResult: PipelineResult | null;
}

export interface SpeechPipelineControls {
  /**
   * Process any text (typed or from STT) through the full pipeline.
   * Returns englishForBackend (send to AI/DB) + displayText + voiceText.
   */
  processText: (rawText: string, overrideContext?: string) => Promise<PipelineResult>;

  /**
   * Translate English backend output (AI response, DB content) for display.
   * English selected → returns as-is.
   * Other lang → returns Hindi display + dialect voice text.
   */
  translateForDisplay: (englishText: string) => Promise<OutputTranslation>;

  /**
   * Start STT listening. Automatically runs the transcript through the pipeline.
   * onResult receives the full PipelineResult.
   */
  startListening: (onResult: (result: PipelineResult) => void, overrideContext?: string) => void;

  /** Stop STT listening */
  stopListening: () => void;

  /**
   * Speak text using TTS.
   * Applies display rules: non-English → speaks in selected dialect.
   * Pass englishText + optional hindiText; the hook picks the right one.
   */
  speak: (englishText: string, hindiText?: string) => Promise<void>;

  /** Pause TTS */
  pauseSpeech: () => void;

  /** Resume TTS */
  resumeSpeech: () => void;

  /** Stop TTS */
  stopSpeech: () => void;

  /** Replay last spoken text */
  replaySpeech: (englishText: string, hindiText?: string) => void;
}

export function useSpeechPipeline(overrideContext?: string): SpeechPipelineState & SpeechPipelineControls {
  const { langCode } = useLanguage();
  const voice = useVoiceAI();
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<PipelineResult | null>(null);

  const pageCtx = overrideContext ?? detectPageContext();
  const isEnglish = langCode === 'en';

  // ── processText ─────────────────────────────────────────────────────────────

  const processText = useCallback(
    async (rawText: string, ctx?: string): Promise<PipelineResult> => {
      setProcessing(true);
      try {
        const result = await runPipeline(rawText, langCode, ctx ?? pageCtx);
        setLastResult(result);
        return result;
      } finally {
        setProcessing(false);
      }
    },
    [langCode, pageCtx]
  );

  // ── translateForDisplay ──────────────────────────────────────────────────────

  const translateForDisplay = useCallback(
    async (englishText: string): Promise<OutputTranslation> => {
      return translateOutput(englishText, langCode);
    },
    [langCode]
  );

  // ── startListening ───────────────────────────────────────────────────────────

  const startListening = useCallback(
    (onResult: (result: PipelineResult) => void, ctx?: string) => {
      voice.startListening(langCode, async (transcript: string) => {
        const result = await processText(transcript, ctx);
        onResult(result);
      });
    },
    [voice, langCode, processText]
  );

  // ── speak ────────────────────────────────────────────────────────────────────
  // Display rule: English → speak English; other → speak Hindi (dialect BCP-47)

  const speak = useCallback(
    async (englishText: string, hindiText?: string) => {
      const textToSpeak = isEnglish ? englishText : (hindiText || englishText);
      await voice.play(textToSpeak, langCode);
    },
    [voice, langCode, isEnglish]
  );

  const replaySpeech = useCallback(
    (englishText: string, hindiText?: string) => {
      const textToSpeak = isEnglish ? englishText : (hindiText || englishText);
      voice.replay(textToSpeak, langCode);
    },
    [voice, langCode, isEnglish]
  );

  return {
    // State
    ttsState: voice.ttsState,
    sttState: voice.sttState,
    sttError: voice.sttError,
    interim: voice.interim,
    ttsSupported: voice.ttsSupported,
    sttSupported: voice.sttSupported,
    processing,
    lastResult,
    // Controls
    processText,
    translateForDisplay,
    startListening,
    stopListening: voice.stopListening,
    speak,
    pauseSpeech: voice.pause,
    resumeSpeech: voice.resume,
    stopSpeech: voice.stop,
    replaySpeech,
  };
}
