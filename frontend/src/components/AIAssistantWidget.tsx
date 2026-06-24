'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAIAssistant, Message } from '@/context/AIAssistantContext';
import { useAuth } from '@/context/AuthContext';
import {
  FaRobot, FaUser, FaPaperPlane, FaSpinner, FaTimes, FaTrash, FaMicrophone, FaVolumeUp,
} from 'react-icons/fa';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const QUICK_PROMPTS = [
  'Crop recommendation kaise milegi?',
  'Fasal mein bimari hai, kya karun?',
  'Soil report kaise upload karein?',
  'Mandi price kaise dekhen?',
  'Government schemes kahan milenge?',
];

// --- Text-to-Speech helper ---
function speakText(text: string, lang = 'hi-IN') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // Strip markdown/emojis for cleaner speech
  const clean = text.replace(/[*_`#~>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
  if (!clean) return;
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = lang;
  utter.rate = 0.95;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

// Detect language of text for TTS lang tag
function detectLang(text: string): string {
  // Hindi unicode range: \u0900-\u097F
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  // Marathi also uses Devanagari but same range
  if (hindiChars > text.length * 0.1) return 'hi-IN';
  // Telugu: \u0C00-\u0C7F, Tamil: \u0B80-\u0BFF, Bengali: \u0980-\u09FF, Gujarati: \u0A80-\u0AFF
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  return 'en-IN';
}

function MessageBubble({ msg, onSpeak }: { msg: Message; onSpeak?: (text: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
          isUser
            ? 'bg-emerald-600 text-white'
            : 'bg-gradient-to-br from-lime-300 to-emerald-600 text-white'
        }`}
      >
        {isUser ? <FaUser /> : <FaRobot />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-emerald-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 shadow-sm text-slate-800 rounded-tl-sm'
        }`}
      >
        {msg.content}
        {!isUser && onSpeak && (
          <button
            onClick={() => onSpeak(msg.content)}
            className="ml-2 text-emerald-400 hover:text-emerald-600 transition inline-flex items-center"
            title="Speak response"
            style={{ verticalAlign: 'middle' }}
          >
            <FaVolumeUp className="text-[9px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AIAssistantWidget() {
  const { isAuthenticated } = useAuth();
  const {
    isOpen, closeAssistant, toggleAssistant,
    messages, setMessages, sending, setSending, inputRef,
  } = useAIAssistant();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputLocalRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [dashboardContext, setDashboardContext] = useState<Record<string, any> | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Sync the shared inputRef with local DOM ref
  useEffect(() => {
    if (inputRef && 'current' in inputRef) {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = inputLocalRef.current;
    }
  });

  // Fetch dashboard context once when widget opens
  useEffect(() => {
    if (!isOpen || !isAuthenticated || dashboardContext) return;
    fetch('/api/ai-assistant/dashboard-context', { headers: getAuthHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) setDashboardContext(data.data); })
      .catch(() => {});
  }, [isOpen, isAuthenticated, dashboardContext]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending || !isAuthenticated) return;

    const userMsg: Message = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    if (inputLocalRef.current) inputLocalRef.current.value = '';
    setSending(true);

    const context = updated.slice(-20).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ messages: context, dashboardContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const reply: string = data.reply;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (ttsEnabled) speakText(reply, detectLang(reply));
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ ${err.message || 'Something went wrong. Please try again.'}` },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputLocalRef.current?.focus(), 50);
    }
  }, [messages, sending, isAuthenticated, dashboardContext, ttsEnabled, setMessages, setSending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputLocalRef.current?.value || '');
    }
  };

  const clearChat = () => {
    window.speechSynthesis?.cancel();
    setMessages([{
      role: 'assistant',
      content: '🌾 Namaste! Main Agrodan Kisan Pragati ka AI Copilot hoon.\n\nAap kya jaanna chahte hain? 👇',
    }]);
  };

  // --- Voice Input ---
  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    // Try to detect language from last user message, default to Hindi
    recognition.lang = 'hi-IN'; // Browser will auto-detect script variations

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      if (transcript && inputLocalRef.current) {
        inputLocalRef.current.value = transcript;
        // Auto-send after voice input
        sendMessage(transcript);
      }
    };

    recognition.start();
  }, [isListening, sendMessage]);

  const handleSpeak = useCallback((text: string) => {
    speakText(text, detectLang(text));
  }, []);

  if (!isAuthenticated) return null;

  return (
    <>
      {/* ── Floating Chat Panel ── */}
      <div
        className={`fixed bottom-20 right-5 z-[9998] w-[340px] sm:w-[380px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
        style={{ maxHeight: '70vh' }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <FaRobot className="text-white text-xs" />
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-none">AI Copilot</div>
              <div className="text-[10px] text-emerald-100">Agrodan Kisan Pragati</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { window.speechSynthesis?.cancel(); setTtsEnabled((v) => !v); }}
              className={`transition p-1 rounded ${ttsEnabled ? 'text-white' : 'text-white/40'}`}
              title={ttsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
            >
              <FaVolumeUp className="text-[10px]" />
            </button>
            <button
              onClick={clearChat}
              className="text-white/70 hover:text-white transition p-1 rounded"
              title="Clear chat"
            >
              <FaTrash className="text-[10px]" />
            </button>
            <button
              onClick={closeAssistant}
              className="text-white/70 hover:text-white transition p-1 rounded"
              title="Close"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50" style={{ minHeight: '200px', maxHeight: 'calc(70vh - 130px)' }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} onSpeak={msg.role === 'assistant' ? handleSpeak : undefined} />
          ))}

          {/* Quick prompts — only on greeting */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 transition shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {sending && (
            <div className="flex gap-2">
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-lime-300 to-emerald-600 text-white flex items-center justify-center text-xs">
                <FaRobot />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                <FaSpinner className="animate-spin text-emerald-500 text-[10px]" />
                <span className="text-[10px] text-slate-400">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 bg-white px-3 py-2 flex items-end gap-2">
          <textarea
            ref={inputLocalRef}
            onKeyDown={handleKeyDown}
            placeholder="Apna sawaal likhein…"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none max-h-24"
            style={{ fieldSizing: 'content' } as any}
          />
          {/* Microphone button */}
          <button
            onClick={startListening}
            disabled={sending}
            title={isListening ? 'Stop listening' : 'Speak your question (Hindi/English/Hinglish)'}
            className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl transition disabled:opacity-40 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            <FaMicrophone className="text-xs" />
          </button>
          <button
            onClick={() => sendMessage(inputLocalRef.current?.value || '')}
            disabled={sending}
            className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition"
          >
            {sending
              ? <FaSpinner className="animate-spin text-xs" />
              : <FaPaperPlane className="text-xs" />
            }
          </button>
        </div>
      </div>

      {/* ── Floating Action Button ── */}
      <button
        onClick={toggleAssistant}
        aria-label="Open AI Assistant"
        className={`fixed bottom-5 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-90'
            : 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 hover:scale-110'
        }`}
      >
        {isOpen
          ? <FaTimes className="text-white text-lg" />
          : <FaRobot className="text-white text-xl" />
        }
      </button>
    </>
  );
}
