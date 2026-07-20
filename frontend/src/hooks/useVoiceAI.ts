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

import { useCallback, useRef, useState } from 'react';
import { resolveVoiceLang, resolveListenLang } from '@/services/languageEngine';
import { getVoiceBcp47 } from '@/i18n/languages';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TtsState = 'idle' | 'playing' | 'paused';
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
  'not-allowed': 'denied',
  'no-speech':   'no-speech',
  'network':     'network',
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

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // ── TTS ──────────────────────────────────────────────────────────────────

  const play = useCallback(async (text: string, langCode: string) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    const clean = cleanForTts(text);
    if (!clean) return;

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

  const pause  = useCallback(() => { window.speechSynthesis?.pause();  setTtsState('paused');  }, []);
  const resume = useCallback(() => { window.speechSynthesis?.resume(); setTtsState('playing'); }, []);
  const stop   = useCallback(() => { window.speechSynthesis?.cancel(); setTtsState('idle');    }, []);

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
