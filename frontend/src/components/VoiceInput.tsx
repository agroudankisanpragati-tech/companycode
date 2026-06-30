'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  lang?: 'hi-IN' | 'en-US' | 'en-IN';
  disabled?: boolean;
  className?: string;
}

type RecognitionState = 'idle' | 'listening' | 'error';
type RecognitionError = 'unsupported' | 'denied' | 'no-speech' | 'timeout' | 'network' | null;

const ERROR_MESSAGES: Record<NonNullable<RecognitionError>, { en: string; hi: string }> = {
  unsupported: { en: 'Voice input not supported. Use Chrome.', hi: 'वॉयस इनपुट समर्थित नहीं है। Chrome उपयोग करें।' },
  denied: { en: 'Microphone access denied.', hi: 'माइक्रोफ़ोन एक्सेस अस्वीकृत।' },
  'no-speech': { en: 'No speech detected. Try again.', hi: 'कोई आवाज़ नहीं मिली। फिर कोशिश करें।' },
  timeout: { en: 'Listening timed out. Try again.', hi: 'समय सीमा समाप्त। फिर कोशिश करें।' },
  network: { en: 'Network error. Check connection.', hi: 'नेटवर्क त्रुटि। कनेक्शन जाँचें।' },
};

export default function VoiceInput({ onTranscript, lang = 'hi-IN', disabled = false, className = '' }: VoiceInputProps) {
  const [recState, setRecState] = useState<RecognitionState>('idle');
  const [errorType, setErrorType] = useState<RecognitionError>(null);
  const [interim, setInterim] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const win = window as any;
    setSupported(!!(win.SpeechRecognition || win.webkitSpeechRecognition));
  }, []);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop();
    setRecState('idle');
    setInterim('');
  }, []);

  const startListening = useCallback(() => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorType('unsupported');
      setRecState('error');
      return;
    }

    setErrorType(null);
    setInterim('');

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setRecState('listening');
      // Auto-stop after 15s
      timeoutRef.current = setTimeout(() => {
        recognition.stop();
        setErrorType('timeout');
        setRecState('error');
      }, 15000);
    };

    recognition.onresult = (e: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onTranscript(finalText.trim());
        setInterim('');
      }
    };

    recognition.onerror = (e: any) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const errMap: Record<string, RecognitionError> = {
        'not-allowed': 'denied',
        'no-speech': 'no-speech',
        'network': 'network',
      };
      setErrorType(errMap[e.error] || 'no-speech');
      setRecState('error');
    };

    recognition.onend = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setRecState((s) => s === 'listening' ? 'idle' : s);
      setInterim('');
    };

    try {
      recognition.start();
    } catch {
      setErrorType('denied');
      setRecState('error');
    }
  }, [lang, onTranscript]);

  useEffect(() => () => stopListening(), [stopListening]);

  if (!supported) return null;

  const errorMsg = errorType ? ERROR_MESSAGES[errorType] : null;

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={recState === 'listening' ? stopListening : startListening}
        disabled={disabled}
        aria-label={recState === 'listening' ? 'Stop listening' : `Start voice input (${lang === 'hi-IN' ? 'Hindi' : 'English'})`}
        aria-pressed={recState === 'listening'}
        title={recState === 'listening' ? 'Stop' : 'Speak'}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40 ${
          recState === 'listening'
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {recState === 'listening' ? <FaStop size={12} /> : <FaMicrophone size={12} />}
      </button>

      {interim && (
        <span className="max-w-[200px] rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 border border-amber-100" aria-live="polite">
          {interim}
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
