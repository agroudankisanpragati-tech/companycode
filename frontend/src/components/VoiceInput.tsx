'use client';

import { useEffect } from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { useVoiceEngineContext } from '@/components/VoiceEngineProvider';
import type { PipelineResult } from '@/services/speechPipeline';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  /** If provided, full pipeline result is returned instead of raw transcript */
  onResult?: (result: PipelineResult) => void;
  lang?: string;
  disabled?: boolean;
  className?: string;
}

const ERROR_MESSAGES: Record<string, { en: string; hi: string }> = {
  unsupported: { en: 'Voice input not supported. Use Chrome.', hi: 'वॉयस इनपुट समर्थित नहीं है। Chrome उपयोग करें।' },
  denied:      { en: 'Microphone access denied.',              hi: 'माइक्रोफ़ोन एक्सेस अस्वीकृत।' },
  'no-speech': { en: 'No speech detected. Try again.',        hi: 'कोई आवाज़ नहीं मिली। फिर कोशिश करें।' },
  timeout:     { en: 'Listening timed out. Try again.',       hi: 'समय सीमा समाप्त। फिर कोशिश करें।' },
  network:     { en: 'Network error. Check connection.',      hi: 'नेटवर्क त्रुटि। कनेक्शन जाँचें।' },
};

export default function VoiceInput({
  onTranscript,
  onResult,
  disabled = false,
  className = '',
}: VoiceInputProps) {
  const { langCode } = useLanguage();
  const voice = useVoiceEngineContext();

  // Cleanup on unmount
  useEffect(() => () => { voice.stopListening(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voice.sttSupported) return null;

  const isListening = voice.sttState === 'listening';

  const handleClick = () => {
    if (disabled || !voice.ready) return;
    if (isListening) {
      voice.stopListening();
    } else {
      voice.startListening((result) => {
        onTranscript(result.original);
        onResult?.(result);
      });
    }
  };

  const errorMsg = voice.sttError ? ERROR_MESSAGES[voice.sttError] : null;

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || !voice.ready}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        aria-pressed={isListening}
        title={isListening ? 'Stop' : 'Speak'}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40 ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {isListening
          ? <FaStop size={12} aria-hidden="true" />
          : <FaMicrophone size={12} aria-hidden="true" />}
      </button>

      {voice.interim && (
        <span className="max-w-[200px] rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 border border-amber-100" aria-live="polite">
          {voice.interim}
        </span>
      )}
      {errorMsg && (
        <span className="max-w-[200px] text-[10px] text-red-600" role="alert">
          {errorMsg.hi} / {errorMsg.en}
        </span>
      )}
    </div>
  );
}
