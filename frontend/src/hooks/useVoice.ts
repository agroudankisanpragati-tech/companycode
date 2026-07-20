'use client';

import { useCallback, useRef, useState } from 'react';
import { getVoiceBcp47 } from '@/i18n/languages';

export type VoicePlayState = 'idle' | 'playing' | 'paused';

/**
 * Resolve a BCP-47 tag from either an app lang code ('hi', 'mwr') or a
 * full BCP-47 string ('hi-IN').  Falls back to 'hi-IN' for unknown codes.
 */
export function resolveBcp47(langCode: string): string {
  if (!langCode) return 'hi-IN';
  if (langCode.includes('-')) return langCode;
  return getVoiceBcp47(langCode);
}

/**
 * Waits for voices to load (Chrome loads them async on first call).
 * Returns voices or empty array after timeout.
 */
function waitForVoices(timeout = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, timeout);
  });
}

function getBestVoice(voices: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice | null {
  return (
    voices.find(v => v.lang === bcp47) ||
    voices.find(v => v.lang.startsWith(bcp47.split('-')[0])) ||
    voices.find(v => v.lang.includes('IN')) ||
    voices[0] ||
    null
  );
}

function cleanText(text: string): string {
  return text
    .replace(/[*_`#~>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function useVoice() {
  const [state, setState] = useState<VoicePlayState>('idle');
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const play = useCallback(
    async (text: string, langCode: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const clean = cleanText(text);
      if (!clean) return;
      const bcp47 = resolveBcp47(langCode);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang  = bcp47;
      utter.rate  = 0.9;
      utter.pitch = 1;

      // Wait for voices to load before selecting best match
      const voices = await waitForVoices();
      const voice = getBestVoice(voices, bcp47);
      if (voice) utter.voice = voice;

      utter.onstart  = () => setState('playing');
      utter.onpause  = () => setState('paused');
      utter.onresume = () => setState('playing');
      utter.onend    = () => setState('idle');
      utter.onerror  = () => setState('idle');
      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [supported],
  );

  const pause  = useCallback(() => { window.speechSynthesis?.pause();  setState('paused');  }, []);
  const resume = useCallback(() => { window.speechSynthesis?.resume(); setState('playing'); }, []);
  const stop   = useCallback(() => { window.speechSynthesis?.cancel(); setState('idle');    }, []);

  const replay = useCallback(
    (text: string, langCode: string) => {
      stop();
      setTimeout(() => play(text, langCode), 80);
    },
    [stop, play],
  );

  return { state, supported, play, pause, resume, stop, replay };
}
