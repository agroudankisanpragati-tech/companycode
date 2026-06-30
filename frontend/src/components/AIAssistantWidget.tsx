'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useAIAssistant, Message } from '@/context/AIAssistantContext';
import { useAuth } from '@/context/AuthContext';
import {
  FaRobot, FaUser, FaPaperPlane, FaSpinner, FaTimes, FaTrash, FaLanguage, FaCheck,
} from 'react-icons/fa';

const AI_LANGUAGES = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'Auto', flag: '🌐' },
  { code: 'en',  name: 'English',    nativeName: 'English',      flag: '🇬🇧' },
  { code: 'hi',  name: 'Hindi',      nativeName: 'हिन्दी',        flag: '🇮🇳' },
  { code: 'mr',  name: 'Marathi',    nativeName: 'मराठी',         flag: '🇮🇳' },
  { code: 'gu',  name: 'Gujarati',   nativeName: 'ગુજરાતી',        flag: '🇮🇳' },
  { code: 'pa',  name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',         flag: '🇮🇳' },
  { code: 'bn',  name: 'Bengali',    nativeName: 'বাংলা',          flag: '🇮🇳' },
  { code: 'as',  name: 'Assamese',   nativeName: 'অসমীয়া',        flag: '🇮🇳' },
  { code: 'or',  name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',          flag: '🇮🇳' },
  { code: 'te',  name: 'Telugu',     nativeName: 'తెలుగు',         flag: '🇮🇳' },
  { code: 'ta',  name: 'Tamil',      nativeName: 'தமிழ்',          flag: '🇮🇳' },
  { code: 'kn',  name: 'Kannada',    nativeName: 'ಕನ್ನಡ',          flag: '🇮🇳' },
  { code: 'ml',  name: 'Malayalam',  nativeName: 'മലയാളം',        flag: '🇮🇳' },
  { code: 'ur',  name: 'Urdu',       nativeName: 'اردو',          flag: '🇮🇳' },
  { code: 'sa',  name: 'Sanskrit',   nativeName: 'संस्कृतम्',        flag: '🇮🇳' },
  { code: 'kok', name: 'Konkani',    nativeName: 'कोंकणी',         flag: '🇮🇳' },
  { code: 'ks',  name: 'Kashmiri',   nativeName: 'كٲشُر',         flag: '🇮🇳' },
  { code: 'mni', name: 'Manipuri',   nativeName: 'মৈতৈলোন্',       flag: '🇮🇳' },
  { code: 'brx', name: 'Bodo',       nativeName: "बर'",           flag: '🇮🇳' },
  { code: 'doi', name: 'Dogri',      nativeName: 'डोगरी',         flag: '🇮🇳' },
  { code: 'sat', name: 'Santali',    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',      flag: '🇮🇳' },
  { code: 'mai', name: 'Maithili',   nativeName: 'मैथिली',        flag: '🇮🇳' },
  { code: 'ne',  name: 'Nepali',     nativeName: 'नेपाली',         flag: '🇮🇳' },
  { code: 'sd',  name: 'Sindhi',     nativeName: 'سنڌي',         flag: '🇮🇳' },
  { code: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी',      flag: '🇮🇳' },
];

const VoicePlayer = lazy(() => import('./VoicePlayer'));
const VoiceInput = lazy(() => import('./VoiceInput'));

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

interface BilingualMessage extends Message {
  bilingual?: { native: string; english: string; hindi: string };
}

function MessageBubble({ msg }: { msg: BilingualMessage }) {
  const isUser = msg.role === 'user';
  const text = msg.bilingual?.native || msg.content;

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${isUser ? 'bg-emerald-600 text-white' : 'bg-gradient-to-br from-lime-300 to-emerald-600 text-white'}`}>
        {isUser ? <FaUser /> : <FaRobot />}
      </div>
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isUser ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-gray-100 shadow-sm text-slate-800 rounded-tl-sm'}`}>
        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{text}</p>
        {!isUser && msg.bilingual && (
          <Suspense fallback={null}>
            <VoicePlayer text={text} lang="hi-IN" autoDetect={true} label="सुनें" className="mt-1.5" />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function AIAssistantWidget() {
  const { isAuthenticated } = useAuth();
  const { isOpen, closeAssistant, toggleAssistant, messages, setMessages, sending, setSending, inputRef } = useAIAssistant();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputLocalRef = useRef<HTMLTextAreaElement>(null);
  const [dashboardContext, setDashboardContext] = useState<Record<string, any> | null>(null);
  const [voiceLang] = useState<'hi-IN' | 'en-US'>('hi-IN');
  const [selectedLang, setSelectedLang] = useState<string>('auto');
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    if (inputRef && 'current' in inputRef) {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = inputLocalRef.current;
    }
  });

  useEffect(() => {
    if (!isOpen || !isAuthenticated || dashboardContext) return;
    fetch('/api/ai-assistant/dashboard-context', { headers: getAuthHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.success) setDashboardContext(data.data); })
      .catch(() => {});
  }, [isOpen, isAuthenticated, dashboardContext]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending || !isAuthenticated) return;

    const userMsg: BilingualMessage = { role: 'user', content };
    const updated = [...(messages as BilingualMessage[]), userMsg];
    setMessages(updated);
    if (inputLocalRef.current) inputLocalRef.current.value = '';
    setSending(true);

    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          messages: updated.slice(-20).map((m) => ({ role: m.role, content: m.content })),
          dashboardContext,
          selectedLang: selectedLang === 'auto' ? undefined : selectedLang,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Request failed');
      }

      const data = await res.json();
      const bilingual = data.bilingual || { native: data.reply, english: data.reply, hindi: data.reply };
      const displayContent = bilingual.native || bilingual.english || data.reply;

      const assistantMsg: BilingualMessage = {
        role: 'assistant',
        content: displayContent,
        bilingual,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: BilingualMessage = {
        role: 'assistant',
        content: '❌ Something went wrong. Please try again. / कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
        bilingual: {
          native: `❌ ${err.message || 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।'}`,
          english: `❌ ${err.message || 'Something went wrong. Please try again.'}`,
          hindi: `❌ कुछ गलत हो गया। कृपया पुनः प्रयास करें।`,
        },
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => inputLocalRef.current?.focus(), 50);
    }
  }, [messages, sending, isAuthenticated, dashboardContext, selectedLang, setMessages, setSending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputLocalRef.current?.value || ''); }
  };

  const clearChat = () => {
    window.speechSynthesis?.cancel();
    setMessages([{ role: 'assistant', content: '🌾 Namaste! Main Pragati AI hoon — aapka intelligent krishi sahayak.\n\nAap kya jaanna chahte hain? 👇' }]);
  };

  const activeLang = AI_LANGUAGES.find((l) => l.code === selectedLang) ?? AI_LANGUAGES[0];

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Chat Panel */}
      <div
        className={`fixed bottom-20 right-5 z-[9998] w-[340px] sm:w-[390px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white transition-all duration-300 ease-out ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'}`}
        style={{ maxHeight: '72vh' }}
        role="dialog"
        aria-label="Pragati AI chat"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-3 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20"><FaRobot className="text-white text-xs" /></div>
            <div>
              <div className="text-xs font-bold text-white leading-none">Pragati AI</div>
              <div className="text-[10px] text-emerald-100">Agroudan Kisan Pragati</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Language selector button */}
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              title="Select response language"
              aria-label={`Response language: ${activeLang.name}`}
              className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold text-white hover:bg-white/30 transition"
            >
              <FaLanguage size={9} />
              <span>{activeLang.flag} {activeLang.code === 'auto' ? 'AUTO' : activeLang.nativeName}</span>
            </button>
            <button onClick={clearChat} className="text-white/70 hover:text-white transition p-1 rounded" title="Clear chat" aria-label="Clear chat">
              <FaTrash className="text-[10px]" />
            </button>
            <button onClick={closeAssistant} className="text-white/70 hover:text-white transition p-1 rounded" title="Close" aria-label="Close chat">
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>

        {/* Language Picker Panel */}
        {showLangPicker && (
          <div className="absolute top-[52px] right-0 left-0 z-10 bg-white border-b border-gray-200 shadow-lg px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Response Language</span>
              <button onClick={() => setShowLangPicker(false)} className="text-slate-400 hover:text-slate-600"><FaTimes size={10} /></button>
            </div>
            <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
              {AI_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setSelectedLang(lang.code); setShowLangPicker(false); }}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-left text-[10px] transition ${
                    selectedLang === lang.code
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-gray-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span className="truncate">{lang.nativeName}</span>
                  {selectedLang === lang.code && <FaCheck size={7} className="ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50" style={{ minHeight: '200px', maxHeight: 'calc(72vh - 135px)' }} role="log" aria-live="polite" aria-label="Chat messages">
          {(messages as BilingualMessage[]).map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1" role="list" aria-label="Quick prompts">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} role="listitem"
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  {q}
                </button>
              ))}
            </div>
          )}

          {sending && (
            <div className="flex gap-2" aria-live="polite" aria-label="AI is thinking">
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-lime-300 to-emerald-600 text-white flex items-center justify-center text-xs"><FaRobot /></div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                <FaSpinner className="animate-spin text-emerald-500 text-[10px]" />
                <span className="text-[10px] text-slate-400">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 bg-white px-3 py-2 flex items-end gap-2 rounded-b-2xl">
          <textarea
            ref={inputLocalRef}
            onKeyDown={handleKeyDown}
            placeholder="Apna sawaal likhein… / Type your question…"
            rows={1}
            disabled={sending}
            aria-label="Chat input"
            className="flex-1 resize-none bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none max-h-24"
            style={{ fieldSizing: 'content' } as any}
          />
          <Suspense fallback={null}>
            <VoiceInput
              lang={voiceLang}
              disabled={sending}
              onTranscript={(t) => {
                if (inputLocalRef.current) inputLocalRef.current.value = t;
                sendMessage(t);
              }}
            />
          </Suspense>
          <button
            onClick={() => sendMessage(inputLocalRef.current?.value || '')}
            disabled={sending}
            aria-label="Send message"
            className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {sending ? <FaSpinner className="animate-spin text-xs" /> : <FaPaperPlane className="text-xs" />}
          </button>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={toggleAssistant}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        className={`fixed bottom-5 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-300 ${isOpen ? 'bg-slate-700 hover:bg-slate-800 rotate-90' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 hover:scale-110'}`}
      >
        {isOpen ? <FaTimes className="text-white text-lg" /> : <FaRobot className="text-white text-xl" />}
      </button>
    </>
  );
}
