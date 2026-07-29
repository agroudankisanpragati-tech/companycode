'use client';

/**
 * useVoiceEngine — Enterprise Voice AI Hook — Phase 6
 *
 * The single shared voice hook used by every page in the application.
 * Wraps the existing useVoiceAI + useSpeechPipeline hooks and adds:
 *   - Push-to-talk (hold button → listen → release → send)
 *   - Continuous conversation mode (auto-restart STT after each response)
 *   - Interrupt speaking (stop TTS mid-sentence)
 *   - Voice replay
 *   - Streaming response support (chunked TTS as AI streams)
 *   - Pronunciation correction via /api/voice-engine/prepare-tts
 *   - Offline-ready (falls back to raw text if API unavailable)
 *
 * Voice rules enforced:
 *   English selected → display English + speak English
 *   Any other lang   → display Hindi + speak selected dialect
 *
 * Usage (same on every page — no page-specific voice code needed):
 *   const voice = useVoiceEngine();
 *   voice.speak('Leaf Blight detected');
 *   voice.startListening(result => console.log(result.englishForBackend));
 *   voice.pushToTalkStart();  // hold
 *   voice.pushToTalkEnd(onResult);  // release
 *
 * Adding a new language requires ZERO changes here.
 * Swapping STT/TTS provider requires ZERO changes here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useVoiceAI } from '@/hooks/useVoiceAI';
import { useSpeechPipeline } from '@/hooks/useSpeechPipeline';
import { useOfflineSpeechCache } from '@/hooks/useOfflineSpeechCache';
import type { PipelineResult } from '@/services/speechPipeline';
import type { TtsState, SttState, SttError } from '@/hooks/useVoiceAI';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceMode = 'idle' | 'push-to-talk' | 'continuous' | 'streaming';

export interface VoiceEngineState {
  ttsState: TtsState;
  sttState: SttState;
  sttError: SttError;
  interim: string;
  ttsSupported: boolean;
  sttSupported: boolean;
  processing: boolean;
  mode: VoiceMode;
  isHolding: boolean;       // push-to-talk hold state
  isContinuous: boolean;    // continuous conversation active
  lastResult: PipelineResult | null;
}

export interface VoiceEngineControls {
  /** Speak text — applies pronunciation correction + display rules */
  speak: (text: string, hindiText?: string) => Promise<void>;
  /** Speak a streaming chunk (call repeatedly as chunks arrive) */
  speakChunk: (chunk: string) => void;
  /** Interrupt current speech */
  interrupt: () => void;
  /** Replay last spoken text */
  replay: () => void;
  /** Pause TTS */
  pause: () => void;
  /** Resume TTS */
  resume: () => void;
  /** Start STT listening (single utterance) */
  startListening: (onResult: (result: PipelineResult) => void, pageCtx?: string) => void;
  /** Stop STT listening */
  stopListening: () => void;
  /** Push-to-talk: start holding */
  pushToTalkStart: () => void;
  /** Push-to-talk: release and process */
  pushToTalkEnd: (onResult: (result: PipelineResult) => void, pageCtx?: string) => void;
  /** Start continuous conversation mode */
  startContinuous: (onResult: (result: PipelineResult) => void, pageCtx?: string) => void;
  /** Stop continuous conversation mode */
  stopContinuous: () => void;
}

// ─── API helper ───────────────────────────────────────────────────────────────

// Strip trailing /api so we never produce /api/api/... double-prefix.
// NEXT_PUBLIC_API_URL is "http://localhost:4000/api" — the route path already
// includes /api, so we need the bare origin+prefix without the segment.
const _RAW_API = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = _RAW_API.endsWith('/api') ? _RAW_API.slice(0, -4) : _RAW_API;

async function prepareTTS(
  text: string,
  langCode: string,
  pageContext?: string
): Promise<{ ttsText: string; displayText: string; langBcp47: string }> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const res = await fetch(`${API_BASE}/api/voice-engine/prepare-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, langCode, pageContext }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error('prepare-tts failed');
    const json = await res.json();
    return json.data;
  } catch {
    // Offline fallback — use raw text
    return { ttsText: text, displayText: text, langBcp47: `${langCode}-IN` };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceEngine(pageContext?: string): VoiceEngineState & VoiceEngineControls {
  const { langCode } = useLanguage();
  const voice = useVoiceAI();
  const pipeline = useSpeechPipeline(pageContext);
  const offlineCache = useOfflineSpeechCache();

  const [mode, setMode]               = useState<VoiceMode>('idle');
  const [isHolding, setIsHolding]     = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);

  const lastSpokenRef   = useRef<{ text: string; hindi?: string } | null>(null);
  const streamBufferRef = useRef<string>('');
  const streamTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousRef   = useRef(false);

  const isEnglish = langCode === 'en';

  // ── speak ──────────────────────────────────────────────────────────────────
  // Applies pronunciation correction, then speaks via Web Speech API.

  const speak = useCallback(async (text: string, hindiText?: string) => {
    if (!voice.ttsSupported || !text?.trim()) return;

    // Interrupt any current speech
    voice.stop();

    // Apply display rule: English → speak English; other → speak Hindi/dialect
    const textToProcess = isEnglish ? text : (hindiText || text);

    // Check offline cache first
    const cachedTTS = offlineCache.getTTS(textToProcess, langCode);
    if (cachedTTS) {
      lastSpokenRef.current = { text: cachedTTS, hindi: hindiText };
      await voice.play(cachedTTS, langCode);
      return;
    }

    // Get pronunciation-corrected text from backend (with offline fallback)
    const prepared = await prepareTTS(textToProcess, langCode, pageContext);

    // Cache the result for offline use
    offlineCache.setTTS(textToProcess, langCode, prepared.ttsText);

    lastSpokenRef.current = { text: prepared.ttsText, hindi: hindiText };
    await voice.play(prepared.ttsText, langCode);
  }, [voice, langCode, isEnglish, pageContext, offlineCache]);

  // ── speakChunk (streaming) ─────────────────────────────────────────────────
  // Buffer chunks and speak when a sentence boundary is detected.

  const speakChunk = useCallback((chunk: string) => {
    if (!voice.ttsSupported) return;
    streamBufferRef.current += chunk;

    // Speak on sentence boundary
    const sentenceEnd = /[।.!?]\s/.test(streamBufferRef.current);
    if (sentenceEnd) {
      const toSpeak = streamBufferRef.current.trim();
      streamBufferRef.current = '';
      if (toSpeak) {
        setMode('streaming');
        voice.play(toSpeak, langCode).then(() => {
          if (!continuousRef.current) setMode('idle');
        });
      }
    } else {
      // Flush after 2s of no new chunks
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      streamTimerRef.current = setTimeout(() => {
        const toSpeak = streamBufferRef.current.trim();
        streamBufferRef.current = '';
        if (toSpeak) voice.play(toSpeak, langCode);
        setMode('idle');
      }, 2000);
    }
  }, [voice, langCode]);

  // ── interrupt ──────────────────────────────────────────────────────────────

  const interrupt = useCallback(() => {
    voice.stop();
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    streamBufferRef.current = '';
    setMode('idle');
  }, [voice]);

  // ── replay ─────────────────────────────────────────────────────────────────

  const replay = useCallback(() => {
    if (!lastSpokenRef.current) return;
    const { text, hindi } = lastSpokenRef.current;
    speak(text, hindi);
  }, [speak]);

  // ── startListening ─────────────────────────────────────────────────────────

  const startListening = useCallback(
    (onResult: (result: PipelineResult) => void, ctx?: string) => {
      setMode('idle');
      pipeline.startListening(onResult, ctx || pageContext);
    },
    [pipeline, pageContext]
  );

  // ── push-to-talk ───────────────────────────────────────────────────────────

  const pushToTalkStart = useCallback(() => {
    setIsHolding(true);
    setMode('push-to-talk');
    // Start listening immediately on hold
    voice.startListening(langCode, () => {}); // interim only while holding
  }, [voice, langCode]);

  const pushToTalkEnd = useCallback(
    (onResult: (result: PipelineResult) => void, ctx?: string) => {
      setIsHolding(false);
      voice.stopListening();
      // Re-start with result callback
      pipeline.startListening(onResult, ctx || pageContext);
      setMode('idle');
    },
    [voice, pipeline, pageContext]
  );

  // ── continuous conversation ────────────────────────────────────────────────

  const startContinuous = useCallback(
    (onResult: (result: PipelineResult) => void, ctx?: string) => {
      continuousRef.current = true;
      setIsContinuous(true);
      setMode('continuous');

      const listenLoop = () => {
        if (!continuousRef.current) return;
        pipeline.startListening((result) => {
          onResult(result);
          // Restart listening after a short delay (wait for TTS to finish)
          setTimeout(() => {
            if (continuousRef.current && voice.ttsState === 'idle') {
              listenLoop();
            }
          }, 1500);
        }, ctx || pageContext);
      };

      listenLoop();
    },
    [pipeline, voice, pageContext]
  );

  const stopContinuous = useCallback(() => {
    continuousRef.current = false;
    setIsContinuous(false);
    pipeline.stopListening();
    voice.stop();
    setMode('idle');
  }, [pipeline, voice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      continuousRef.current = false;
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    };
  }, []);

  return {
    // State
    ttsState: voice.ttsState,
    sttState: voice.sttState,
    sttError: voice.sttError,
    interim: voice.interim,
    ttsSupported: voice.ttsSupported,
    sttSupported: voice.sttSupported,
    processing: pipeline.processing,
    mode,
    isHolding,
    isContinuous,
    lastResult: pipeline.lastResult,
    // Controls
    speak,
    speakChunk,
    interrupt,
    replay,
    pause: voice.pause,
    resume: voice.resume,
    startListening,
    stopListening: pipeline.stopListening,
    pushToTalkStart,
    pushToTalkEnd,
    startContinuous,
    stopContinuous,
  };
}
