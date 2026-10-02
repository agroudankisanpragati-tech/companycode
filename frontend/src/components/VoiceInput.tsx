'use client';

import { useEffect, useState } from 'react';
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
  unsupported: { en: 'Voice input is not supported by this browser.', hi: 'यह ब्राउज़र वॉयस इनपुट का समर्थन नहीं करता।' },
  denied:      { en: 'Microphone is blocked or unavailable. Allow microphone access for localhost and check that a microphone is connected.', hi: 'माइक्रोफ़ोन ब्लॉक है या उपलब्ध नहीं है। localhost के लिए अनुमति दें और माइक्रोफ़ोन कनेक्शन जाँचें।' },
  'no-speech': { en: 'No speech detected. Try again.',        hi: 'कोई आवाज़ नहीं मिली। फिर कोशिश करें।' },
  timeout:     { en: 'Listening timed out. Try again.',       hi: 'समय सीमा समाप्त। फिर कोशिश करें।' },
  network:     { en: 'Network error. Check connection.',      hi: 'नेटवर्क त्रुटि। कनेक्शन जाँचें।' },
};

export default function VoiceInput({
  onTranscript,
  onResult,
  lang,
  disabled = false,
  className = '',
}: VoiceInputProps) {
  const { langCode: appLangCode } = useLanguage();
  const voice = useVoiceEngineContext();
  const [checkingMicrophone, setCheckingMicrophone] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { voice.stopListening(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isListening = voice.sttState === 'listening';
  const errorKey = !voice.sttSupported ? 'unsupported' : voice.sttError;

  const handleClick = async () => {
    if (disabled || checkingMicrophone || !voice.sttSupported) return;
    if (isListening) {
      voice.stopListening();
    } else {
      setMicrophoneError(null);
      setCheckingMicrophone(true);
      try {
        // Verify the browser can access a real input device before invoking
        // Web Speech recognition. Recognition manages its own audio capture.
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        }

        voice.startListening((result) => {
          onTranscript(result.original);
          onResult?.(result);
        }, undefined, lang || appLangCode);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        setMicrophoneError(
          name === 'NotFoundError'
            ? 'No microphone was found. Connect or enable a microphone, then try again.'
            : name === 'NotReadableError'
              ? 'The microphone is busy or unavailable. Close other apps using it and try again.'
              : name === 'NotAllowedError' || name === 'SecurityError'
                ? 'Microphone access is blocked. Allow it for localhost in Chrome site settings and Windows privacy settings.'
                : 'Could not access the microphone. Check the device and browser permission, then try again.'
        );
      } finally {
        setCheckingMicrophone(false);
      }
    }
  };

  const errorMsg = errorKey ? ERROR_MESSAGES[errorKey] : null;

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || checkingMicrophone || !voice.sttSupported}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        aria-pressed={isListening}
        title={isListening ? 'Stop' : 'Speak'}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40 ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {checkingMicrophone
          ? <span className="text-[10px]" aria-hidden="true">…</span>
          : isListening
          ? <FaStop size={12} aria-hidden="true" />
          : <FaMicrophone size={12} aria-hidden="true" />}
      </button>

      {microphoneError && (
        <span className="max-w-[220px] text-[10px] text-red-600" role="alert">
          {microphoneError}
        </span>
      )}

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
