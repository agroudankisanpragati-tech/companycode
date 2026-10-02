'use client';

/**
 * useVoiceAI — Unified Voice AI hook for the entire platform.
 *
 * Combines Speech-to-Text (STT) + Text-to-Speech (TTS) in one hook.
 * Supports all 13 national languages + 12 Rajasthan dialects.
 *
 * Architecture:
 *  - Language resolution is delegated to languageEngine (single source of truth).
 *  - Adding a new language/dialect only requires updating languages.ts — no
 *    changes needed here.
 *  - Business logic is never touched.
 *
 * TTS controls: play | pause | resume | stop | replay
 * STT controls: startListening | stopListening
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveVoiceLang, resolveListenLang } from '@/services/languageEngine';
import { getVoiceBcp47 } from '@/i18n/languages';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TtsState = 'idle' | 'loading' | 'playing' | 'paused';
export type SttState = 'idle' | 'listening' | 'error';
export type SttError = 'unsupported' | 'denied' | 'no-speech' | 'timeout' | 'network' | null;

export interface VoiceAIState {
  ttsState: TtsState;
  sttState: SttState;
  sttError: SttError;
  interim: string;
  ttsSupported: boolean;
  sttSupported: boolean;
}

export interface VoiceAIControls {
  /** TTS: speak text in the given app language code or BCP-47 tag */
  play: (text: string, langCode: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  replay: (text: string, langCode: string) => void;
  /** STT: start listening in the given app language code or BCP-47 tag */
  startListening: (langCode: string, onResult: (text: string) => void) => void;
  stopListening: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveBcp47(langCode: string): string {
  if (!langCode) return 'hi-IN';
  if (langCode.includes('-')) return langCode;
  return getVoiceBcp47(langCode);
}

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_ORIGIN = RAW_API_URL.endsWith('/api') ? RAW_API_URL.slice(0, -4) : RAW_API_URL;
const LOCAL_PARLER_ENABLED = process.env.NEXT_PUBLIC_VOICE_TTS_PROVIDER === 'indic-parler';

function cleanForTts(text: string): string {
  return text
    .replace(/[*_`#~>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function waitForVoices(timeout = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    }, timeout);
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice | null {
  return (
    voices.find(v => v.lang === bcp47) ||
    voices.find(v => v.lang.startsWith(bcp47.split('-')[0])) ||
    voices.find(v => v.lang.includes('IN')) ||
    voices[0] ||
    null
  );
}

const STT_ERROR_MAP: Record<string, SttError> = {
  'not-allowed':        'denied',
  'service-not-allowed': 'denied',
  'audio-capture':      'denied',
  'no-speech':          'no-speech',
  'network':            'network',
  'aborted':            null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceAI(): VoiceAIState & VoiceAIControls {
  const [ttsState, setTtsState] = useState<TtsState>('idle');
  const [sttState, setSttState] = useState<SttState>('idle');
  const [sttError, setSttError] = useState<SttError>(null);
  const [interim,  setInterim]  = useState('');

  const utterRef   = useRef<SpeechSynthesisUtterance | null>(null);
  const recRef     = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const synthAbortRef = useRef<AbortController | null>(null);
  const playbackIdRef = useRef(0);

  const ttsSupported = typeof window !== 'undefined' &&
    ('speechSynthesis' in window || LOCAL_PARLER_ENABLED);
  const sttSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // ── TTS ──────────────────────────────────────────────────────────────────

  const play = useCallback(async (text: string, langCode: string) => {
    if (!ttsSupported) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const clean = cleanForTts(text);
    if (!clean) return;

    const playbackId = ++playbackIdRef.current;
    setTtsState('loading');
    synthAbortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    if (LOCAL_PARLER_ENABLED) {
      const controller = new AbortController();
      synthAbortRef.current = controller;
      let localTimedOut = false;
      const localTimeout = window.setTimeout(() => {
        localTimedOut = true;
        controller.abort();
      }, 60000);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_ORIGIN}/api/voice-engine/synthesize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: clean, langCode }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Local TTS returned ${response.status}`);
        const result = await response.json() as { audioBase64?: string; mimeType?: string };
        if (playbackId !== playbackIdRef.current) return;
        if (!result.audioBase64) throw new Error('Local TTS returned no audio data');

        const binary = atob(result.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const audioBlob = new Blob([bytes], { type: result.mimeType || 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('[Voice] Audio received successfully! Size:', bytes.length, 'bytes. Playing now...');
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;
        audio.onended = () => {
          if (playbackId === playbackIdRef.current) setTtsState('idle');
          URL.revokeObjectURL(audioUrl);
          if (audioUrlRef.current === audioUrl) audioUrlRef.current = null;
        };
        audio.onerror = () => {
          if (playbackId === playbackIdRef.current) setTtsState('idle');
        };
        await audio.play();
        if (playbackId === playbackIdRef.current) setTtsState('playing');
        return;
      } catch (error) {
        if (playbackId !== playbackIdRef.current) return;
        if (localTimedOut) {
          console.warn('[Voice] Local TTS exceeded 60 seconds; using browser speech synthesis.');
        } else {
          console.warn('[Voice] Indic Parler unavailable; using browser speech synthesis.', error);
        }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
        audioRef.current = null;
      } finally {
        window.clearTimeout(localTimeout);
      }
    }

    if (!('speechSynthesis' in window)) {
      setTtsState('idle');
      return;
    }

    const bcp47 = resolveBcp47(resolveVoiceLang(langCode));
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang  = bcp47;
    utter.rate  = 0.9;
    utter.pitch = 1;

    const voices = await waitForVoices();
    const voice  = pickBestVoice(voices, bcp47);
    if (voice) utter.voice = voice;

    utter.onstart  = () => setTtsState('playing');
    utter.onpause  = () => setTtsState('paused');
    utter.onresume = () => setTtsState('playing');
    utter.onend    = () => setTtsState('idle');
    utter.onerror  = () => setTtsState('idle');

    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [ttsSupported]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    else window.speechSynthesis?.pause();
    setTtsState('paused');
  }, []);
  const resume = useCallback(() => {
    if (audioRef.current?.paused) void audioRef.current.play();
    else window.speechSynthesis?.resume();
    setTtsState('playing');
  }, []);
  const stop = useCallback(() => {
    playbackIdRef.current++;
    synthAbortRef.current?.abort();
    synthAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    setTtsState('idle');
  }, []);

  useEffect(() => () => {
    synthAbortRef.current?.abort();
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const replay = useCallback((text: string, langCode: string) => {
    stop();
    setTimeout(() => play(text, langCode), 80);
  }, [stop, play]);

  // ── STT ──────────────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recRef.current?.stop();
    setSttState('idle');
    setInterim('');
  }, []);

  const startListening = useCallback((langCode: string, onResult: (text: string) => void) => {
    const win = window as any;
    const SR  = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) { setSttError('unsupported'); setSttState('error'); return; }

    setSttError(null);
    setInterim('');

    const rec = new SR();
    recRef.current = rec;
    rec.lang            = resolveBcp47(resolveListenLang(langCode));
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setSttState('listening');
      timeoutRef.current = setTimeout(() => {
        rec.stop();
        setSttError('timeout');
        setSttState('error');
      }, 15000);
    };

    rec.onresult = (e: any) => {
      let final = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else inter += t;
      }
      setInterim(inter);
      if (final) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onResult(final.trim());
        setInterim('');
      }
    };

    rec.onerror = (e: any) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (e.error === 'aborted') {
        setSttState('idle');
        return;
      }
      setSttError(STT_ERROR_MAP[e.error] || 'no-speech');
      setSttState('error');
    };

    rec.onend = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setSttState(s => s === 'listening' ? 'idle' : s);
      setInterim('');
    };

    try { rec.start(); }
    catch { setSttError('denied'); setSttState('error'); }
  }, []);

  return {
    ttsState, sttState, sttError, interim,
    ttsSupported, sttSupported,
    play, pause, resume, stop, replay,
    startListening, stopListening,
  };
}
