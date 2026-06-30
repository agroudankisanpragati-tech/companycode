'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaVolumeUp, FaPause, FaStop, FaPlay } from 'react-icons/fa';

interface VoicePlayerProps {
  text: string;
  lang?: 'hi-IN' | 'en-US' | 'en-IN' | string;
  autoDetect?: boolean;
  label?: string;
  className?: string;
}

function detectLangFromText(text: string): string {
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (hindiChars > text.length * 0.1) return 'hi-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  return 'en-IN';
}

function getBestVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ||
    voices.find((v) => v.lang.includes('IN')) ||
    voices[0] ||
    null
  );
}

type PlayState = 'idle' | 'playing' | 'paused';

export default function VoicePlayer({ text, lang, autoDetect = true, label, className = '' }: VoicePlayerProps) {
  const [state, setState] = useState<PlayState>('idle');
  const [supported, setSupported] = useState(true);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  // Stop on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const resolvedLang = autoDetect ? detectLangFromText(text) : (lang || 'hi-IN');

  const play = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#~>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = resolvedLang;
    utter.rate = 0.9;
    utter.pitch = 1;
    const voice = getBestVoice(resolvedLang);
    if (voice) utter.voice = voice;
    utter.onstart = () => setState('playing');
    utter.onpause = () => setState('paused');
    utter.onresume = () => setState('playing');
    utter.onend = () => setState('idle');
    utter.onerror = () => setState('idle');
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [text, resolvedLang, supported]);

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setState('playing');
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState('idle');
  }, []);

  if (!supported) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={label || 'Voice playback controls'}>
      {state === 'idle' && (
        <button
          onClick={play}
          aria-label="Play voice"
          title={label || 'Listen'}
          className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <FaVolumeUp size={11} />
          {label || 'सुनें / Listen'}
        </button>
      )}
      {state === 'playing' && (
        <>
          <button onClick={pause} aria-label="Pause" title="Pause" className="rounded-full bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200 transition focus:outline-none focus:ring-2 focus:ring-amber-400">
            <FaPause size={10} />
          </button>
          <button onClick={stop} aria-label="Stop" title="Stop" className="rounded-full bg-red-100 p-1.5 text-red-600 hover:bg-red-200 transition focus:outline-none focus:ring-2 focus:ring-red-400">
            <FaStop size={10} />
          </button>
        </>
      )}
      {state === 'paused' && (
        <>
          <button onClick={resume} aria-label="Resume" title="Resume" className="rounded-full bg-emerald-100 p-1.5 text-emerald-700 hover:bg-emerald-200 transition focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <FaPlay size={10} />
          </button>
          <button onClick={stop} aria-label="Stop" title="Stop" className="rounded-full bg-red-100 p-1.5 text-red-600 hover:bg-red-200 transition focus:outline-none focus:ring-2 focus:ring-red-400">
            <FaStop size={10} />
          </button>
        </>
      )}
    </div>
  );
}
