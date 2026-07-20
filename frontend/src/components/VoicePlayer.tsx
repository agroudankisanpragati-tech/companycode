'use client';

import { useEffect } from 'react';
import { FaVolumeUp, FaPause, FaStop, FaPlay, FaRedo } from 'react-icons/fa';
import { useVoiceEngineContext } from '@/components/VoiceEngineProvider';
import { useLanguage } from '@/context/LanguageContext';
import { resolveVoiceLang } from '@/services/languageEngine';

interface VoicePlayerProps {
  text: string;
  lang?: string;
  autoDetect?: boolean;
  label?: string;
  className?: string;
}

export default function VoicePlayer({
  text,
  lang,
  autoDetect = true,
  label,
  className = '',
}: VoicePlayerProps) {
  const voice = useVoiceEngineContext();
  const { langCode: globalLangCode } = useLanguage();

  const resolvedLang = lang
    ? (lang.includes('-') ? lang : resolveVoiceLang(lang))
    : autoDetect && text
    ? detectLangFromText(text)
    : resolveVoiceLang(globalLangCode);

  // Stop on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  if (!voice.ttsSupported) return null;

  const { ttsState } = voice;

  return (
    <div
      className={`flex items-center gap-1.5 flex-wrap ${className}`}
      role="group"
      aria-label={label || 'Voice playback controls'}
    >
      {ttsState === 'idle' && (
        <button
          onClick={() => voice.speak(text)}
          aria-label="Play voice"
          title={label || 'Listen'}
          className="flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[2rem]"
        >
          <FaVolumeUp size={11} aria-hidden="true" />
          {label || 'सुनें / Listen'}
        </button>
      )}

      {ttsState === 'playing' && (
        <>
          <button onClick={voice.pause} aria-label="Pause" title="Pause"
            className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 min-h-[2rem] min-w-[2rem]">
            <FaPause size={10} aria-hidden="true" />
          </button>
          <button onClick={voice.interrupt} aria-label="Stop" title="Stop"
            className="rounded-full bg-red-100 dark:bg-red-900/40 p-2 text-red-600 dark:text-red-400 hover:bg-red-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[2rem] min-w-[2rem]">
            <FaStop size={10} aria-hidden="true" />
          </button>
          <button onClick={voice.replay} aria-label="Replay from start" title="Replay"
            className="rounded-full bg-slate-100 dark:bg-slate-700 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[2rem] min-w-[2rem]">
            <FaRedo size={10} aria-hidden="true" />
          </button>
          <span className="text-xs text-slate-400 flex items-center gap-1" aria-live="polite">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" aria-hidden="true" />
            Playing...
          </span>
        </>
      )}

      {ttsState === 'paused' && (
        <>
          <button onClick={voice.resume} aria-label="Resume" title="Resume"
            className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[2rem] min-w-[2rem]">
            <FaPlay size={10} aria-hidden="true" />
          </button>
          <button onClick={voice.replay} aria-label="Replay from start" title="Replay from start"
            className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[2rem] min-w-[2rem]">
            <FaRedo size={10} aria-hidden="true" />
          </button>
          <button onClick={voice.interrupt} aria-label="Stop" title="Stop"
            className="rounded-full bg-red-100 dark:bg-red-900/40 p-2 text-red-600 dark:text-red-400 hover:bg-red-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[2rem] min-w-[2rem]">
            <FaStop size={10} aria-hidden="true" />
          </button>
          <span className="text-xs text-amber-500 dark:text-amber-400" aria-live="polite">Paused</span>
        </>
      )}
    </div>
  );
}

function detectLangFromText(text: string): string {
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (hindiChars > text.length * 0.1) return 'hi-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  return 'en-IN';
}
