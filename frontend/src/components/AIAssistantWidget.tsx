'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getAssistantBranding, useAIAssistant, Message } from '@/context/AIAssistantContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useVoiceEngineContext } from './VoiceEngineProvider';
import { resolveVoiceLang } from '@/services/languageEngine';
import { LANGUAGES } from '@/i18n/languages';
import {
  FaRobot, FaUser, FaPaperPlane, FaSpinner, FaTimes, FaTrash, FaLanguage, FaCheck,
} from 'react-icons/fa';

// Build AI language list from the centralized LANGUAGES registry
const AI_LANGUAGES = [
  ...LANGUAGES.map(l => ({ code: l.code, name: l.name, nativeName: l.nativeName, flag: l.flag })),
];
const CHAT_LANGUAGE_KEY = 'kp_ai_response_language';

const VoicePlayer = lazy(() => import('./VoicePlayer'));
const VoiceInput  = lazy(() => import('./VoiceInput'));

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const QUICK_PROMPTS: Record<string, string[]> = {
  en: [
    'Where can I get a crop recommendation?',
    'How do I open Disease Detection?',
    'How do I upload a soil report?',
    'Where can I see mandi prices?',
  ],
  hi: [
    'फसल की सिफारिश कहाँ मिलेगी?',
    'रोग पहचान पेज कैसे खोलूँ?',
    'मिट्टी की रिपोर्ट कैसे अपलोड करूँ?',
    'मंडी भाव कहाँ देखूँ?',
  ],
};

interface BilingualMessage extends Message {
  bilingual?: { native: string; english: string; hindi: string };
  navigationAction?: { target: string; mode: 'navigate' | 'guide' | 'offer' };
  responseAudio?: string;
}

const NAVIGATION_DESTINATIONS: Record<string, { path: string; label: string; labelHindi: string }> = {
  edit_profile: { path: '/dashboard/farmer/edit-profile', label: 'Edit My Profile', labelHindi: 'प्रोफ़ाइल संपादित करें' },
  shopkeeper_complete_profile: { path: '/dashboard/shopkeeper/complete-profile', label: 'Complete Business Profile', labelHindi: 'व्यापार प्रोफ़ाइल पूरी करें' },
  farmer_ai_suggestions: { path: '/dashboard/farmer/ai-suggestions', label: 'AI Suggestions', labelHindi: 'एआई सुझाव' },
  farmer_crop_health: { path: '/dashboard/farmer/crop-health', label: 'Crop Health', labelHindi: 'फसल स्वास्थ्य' },
  farmer_soil_health: { path: '/dashboard/farmer/soil-health', label: 'Dashboard Soil Health', labelHindi: 'डैशबोर्ड मृदा स्वास्थ्य' },
  home: { path: '/', label: 'Home', labelHindi: 'होम' },
  crop_history: { path: '/crop-recommendation/history', label: 'Crop Recommendation History', labelHindi: 'फसल सुझाव इतिहास' },
  register: { path: '/auth/register', label: 'Create Account', labelHindi: 'खाता बनाएँ' },
  role_select: { path: '/auth/role-select', label: 'Choose Account Type', labelHindi: 'खाते का प्रकार चुनें' },
  market_dashboard: { path: '/dashboard/farmer/market', label: 'Dashboard Market', labelHindi: 'डैशबोर्ड मंडी' },
  profile: { path: '/dashboard/farmer/profile', label: 'My Profile', labelHindi: 'मेरी प्रोफ़ाइल' },
  shopkeeper_profile: { path: '/dashboard/shopkeeper/profile', label: 'Business Profile', labelHindi: 'व्यापार प्रोफ़ाइल' },
  settings: { path: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स' },
  fertilizer_calculator: { path: '/dashboard/farmer/fertilizer-calculator', label: 'Fertilizer Calculator', labelHindi: 'उर्वरक कैलकुलेटर' },
  my_crops: { path: '/dashboard/farmer/my-crops', label: 'My Crops', labelHindi: 'मेरी फसलें' },
  farmer_tasks: { path: '/dashboard/farmer/tasks', label: 'My Tasks', labelHindi: 'मेरे काम' },
  farmer_activities: { path: '/dashboard/farmer/activities', label: 'Farm Activities', labelHindi: 'कृषि गतिविधियाँ' },
  farmer_recommendations: { path: '/dashboard/farmer/recommendations', label: 'My Recommendations', labelHindi: 'मेरी सिफारिशें' },
  farmer_rewards: { path: '/dashboard/farmer/rewards', label: 'My Rewards', labelHindi: 'मेरे पुरस्कार' },
  marketplace: { path: '/marketplace', label: 'Marketplace', labelHindi: 'मार्केटप्लेस' },
  shops: { path: '/marketplace/shops', label: 'Browse Shops', labelHindi: 'दुकानें देखें' },
  shopkeeper_products: { path: '/dashboard/shopkeeper/products', label: 'My Products', labelHindi: 'मेरे उत्पाद' },
  shopkeeper_nursery: { path: '/dashboard/shopkeeper/products/nursery', label: 'Nursery Products', labelHindi: 'नर्सरी उत्पाद' },
  shopkeeper_fertilizer: { path: '/dashboard/shopkeeper/products/fertilizer', label: 'Fertilizer Products', labelHindi: 'उर्वरक उत्पाद' },
  schemes: { path: '/schemes', label: 'Government Schemes', labelHindi: 'सरकारी योजनाएँ' },
  seva_mitra: { path: '/schemes/seva-mitra', label: 'Seva Mitra', labelHindi: 'सेवा मित्र' },
  ai_assistant: { path: '/ai-assistant', label: 'AI Assistant', labelHindi: 'एआई सहायक' },
  farmer_stories: { path: '/farmer-stories', label: 'Farmer Stories', labelHindi: 'किसान कहानियाँ' },
  about: { path: '/about', label: 'About Us', labelHindi: 'हमारे बारे में' },
  contact: { path: '/contact', label: 'Contact', labelHindi: 'संपर्क' },
  gallery: { path: '/gallery', label: 'Gallery', labelHindi: 'गैलरी' },
  blog: { path: '/blog', label: 'Blog', labelHindi: 'ब्लॉग' },
  careers: { path: '/careers', label: 'Careers', labelHindi: 'करियर' },
  rajasthan_portal: { path: '/rajasthan', label: 'Rajasthan Portal', labelHindi: 'राजस्थान पोर्टल' },
  crop_recommendation: { path: '/crop-recommendation', label: 'Crop Recommendation', labelHindi: 'फसल सिफारिश' },
  disease_detection: { path: '/disease-detection', label: 'Disease Detection', labelHindi: 'रोग पहचान' },
  soil_health: { path: '/soil-health', label: 'Soil Health', labelHindi: 'मिट्टी स्वास्थ्य' },
  soil_moisture: { path: '/dashboard/farmer', label: 'Soil Moisture on Dashboard', labelHindi: 'डैशबोर्ड पर मिट्टी की नमी' },
  login: { path: '/auth/login', label: 'Login', labelHindi: 'लॉग इन' },
  weather: { path: '/weather', label: 'Weather', labelHindi: 'मौसम' },
  market_prices: { path: '/mandi-prices', label: 'Market Prices', labelHindi: 'मंडी भाव' },
  kvk: { path: '/kvk', label: 'KVK Finder', labelHindi: 'केवीके खोजें' },
  dashboard: { path: '/dashboard/farmer', label: 'Farmer Dashboard', labelHindi: 'किसान डैशबोर्ड' },
};

function resolveNavigationPath(target: string, role: string | null | undefined, isAuthenticated: boolean): string | undefined {
  if (target === 'dashboard') {
    if (!isAuthenticated) return '/auth/login';
    return role === 'shopkeeper' ? '/dashboard/shopkeeper' : '/dashboard/farmer';
  }
  if (target === 'profile') {
    if (!isAuthenticated) return '/auth/login';
    return role === 'shopkeeper' ? '/dashboard/shopkeeper/profile' : '/dashboard/farmer/profile';
  }
  if (target === 'edit_profile') {
    if (!isAuthenticated) return '/auth/login';
    return role === 'shopkeeper' ? '/dashboard/shopkeeper/edit-profile' : '/dashboard/farmer/edit-profile';
  }
  if (target === 'settings' && !isAuthenticated) return '/auth/login';
  return NAVIGATION_DESTINATIONS[target]?.path;
}

function AssistantAnswer({ text }: { text: string }) {
  type Block = { kind: 'paragraph' | 'ordered' | 'unordered'; lines: string[] };
  const blocks: Block[] = [];
  let kind: Block['kind'] | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (kind && lines.length) blocks.push({ kind, lines });
    kind = null;
    lines = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (kind === 'paragraph') flush();
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^(?:[-*]|\u2022)\s+(.+)$/);
    const nextKind: Block['kind'] = ordered ? 'ordered' : unordered ? 'unordered' : 'paragraph';
    if (kind !== nextKind) flush();
    kind = nextKind;
    lines.push((ordered || unordered)?.[1] || line);
  }
  flush();

  return (
    <div className="space-y-1.5 text-xs leading-relaxed break-words">
      {blocks.map((block, index) => block.kind === 'ordered' ? (
        <ol key={index} className="list-decimal space-y-1 pl-5">
          {block.lines.map((line, itemIndex) => <li key={itemIndex}>{line}</li>)}
        </ol>
      ) : block.kind === 'unordered' ? (
        <ul key={index} className="list-disc space-y-1 pl-5">
          {block.lines.map((line, itemIndex) => <li key={itemIndex}>{line}</li>)}
        </ul>
      ) : (
        <p key={index} className="whitespace-pre-wrap">{block.lines.join(' ')}</p>
      ))}
    </div>
  );
}

function MessageBubble({ msg, voiceLang, selectedLang, onNavigate }: { msg: BilingualMessage; voiceLang: string; selectedLang: string; onNavigate: (target: string) => void }) {
  const isUser = msg.role === 'user';
  const text = msg.bilingual?.native || msg.content;
  const destination = msg.navigationAction?.mode === 'offer'
    ? NAVIGATION_DESTINATIONS[msg.navigationAction.target]
    : undefined;

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${isUser ? 'bg-emerald-600 text-white' : 'bg-gradient-to-br from-lime-300 to-emerald-600 text-white'}`}>
        {isUser ? <FaUser /> : <FaRobot />}
      </div>
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isUser ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-gray-100 shadow-sm text-slate-800 rounded-tl-sm'}`}>
        <AssistantAnswer text={text} />
        {destination && (
          <button onClick={() => onNavigate(msg.navigationAction!.target)} className="mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            {selectedLang === 'hi' ? 'पेज खोलें: ' : 'Open page: '}{selectedLang === 'hi' ? destination.labelHindi : destination.label}
          </button>
        )}
        {!isUser && msg.bilingual && (
<Suspense fallback={null}>
            {/* Voice reads in the selected assistant language */}
            <VoicePlayer text={text} lang={voiceLang} autoDetect={false} label="सुनें" className="mt-1.5" responseAudio={msg.responseAudio} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function AIAssistantWidget() {
  const router = useRouter();
  const { isAuthenticated, user, role } = useAuth();
  const activeRole = user?.role || role;
  const { isOpen, closeAssistant, toggleAssistant, messages, setMessages, sending, setSending, inputRef, pageData } = useAIAssistant();
  const voice = useVoiceEngineContext();
  // Sync with global language context — single source of truth
  const { langCode: globalLangCode, isLoading: isLanguageLoading } = useLanguage();

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputLocalRef  = useRef<HTMLTextAreaElement>(null);
  const [dashboardContext, setDashboardContext] = useState<Record<string, any> | null>(null);
  const [selectedLang, setSelectedLang]         = useState<string>('');
  const [languageReady, setLanguageReady]       = useState(false);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [showLangPicker, setShowLangPicker]     = useState(false);

  // Resolve voice lang: use global app language for TTS
  const voiceLang = resolveVoiceLang(selectedLang || globalLangCode);

  // First-use choice follows the site language, then stays an explicit chat preference.
  useEffect(() => {
    if (isLanguageLoading) return;
    const saved = localStorage.getItem(CHAT_LANGUAGE_KEY);
    if (saved && AI_LANGUAGES.some(language => language.code === saved)) {
      setSelectedLang(saved);
      setLanguageConfirmed(true);
      setMessages(current => current.some(message => message.role === 'user') ? current : []);
    } else {
      setSelectedLang(AI_LANGUAGES.some(language => language.code === globalLangCode) ? globalLangCode : 'en');
      setLanguageConfirmed(false);
    }
    setLanguageReady(true);
  }, [globalLangCode, isLanguageLoading, setMessages]);

  useEffect(() => {
    if (inputRef && 'current' in inputRef) {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = inputLocalRef.current;
    }
  });

  useEffect(() => {
    if (!isOpen || !isAuthenticated || dashboardContext) return;
    fetch('/api/ai-assistant/dashboard-context', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.success) setDashboardContext(data.data); })
      .catch(() => {});
  }, [isOpen, isAuthenticated, dashboardContext]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending || !isAuthenticated || !languageConfirmed || !selectedLang) return;

    const userMsg: BilingualMessage = { role: 'user', content };
    const updated = [...(messages as BilingualMessage[]), userMsg];
    setMessages(updated);
    if (inputLocalRef.current) inputLocalRef.current.value = '';
    setSending(true);

    // Generate or use existing session ID
    const sessionId = localStorage.getItem('chat_session_id') || `session_${Date.now()}`;
    localStorage.setItem('chat_session_id', sessionId);

    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Language': selectedLang, ...getAuthHeaders() },
        body: JSON.stringify({
          messages: updated.slice(-20).map(m => ({ role: m.role, content: m.content })),
          dashboardContext,
          selectedLang,
          session_id: sessionId,
          synthesize_audio: true,
          // Phase 3: send live page context so Pragati AI answers in context
          pageData: pageData ?? undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Request failed');
      }

      const data = await res.json();
      if (data.navigationAction?.mode === 'navigate') {
        const destinationPath = resolveNavigationPath(data.navigationAction.target, activeRole, isAuthenticated);
        if (destinationPath) {
          const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
          if (currentPath !== destinationPath) router.push(destinationPath);
          return;
        }
      }
const bilingual = data.bilingual || { native: data.reply, english: data.reply, hindi: data.reply };
      const displayContent = bilingual.native || bilingual.english || data.reply;

      const responseAudio = data.responseAudio;

      const assistantMsg: BilingualMessage = { role: 'assistant', content: displayContent, bilingual, navigationAction: data.navigationAction, responseAudio };
      setMessages(prev => [...prev, assistantMsg]);
      voice.speak(displayContent, bilingual.hindi, selectedLang);
      if (data.navigationAction?.mode === 'guide') {
        const destinationPath = resolveNavigationPath(data.navigationAction.target, activeRole, isAuthenticated);
        const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
        if (destinationPath && currentPath !== destinationPath) router.push(destinationPath);
      }
    } catch (err: any) {
      const errMsg: BilingualMessage = {
        role: 'assistant',
        content: '❌ Something went wrong. Please try again. / कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
        bilingual: {
          native:  `❌ ${err.message || 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।'}`,
          english: `❌ ${err.message || 'Something went wrong. Please try again.'}`,
          hindi:   `❌ कुछ गलत हो गया। कृपया पुनः प्रयास करें।`,
        },
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => inputLocalRef.current?.focus(), 50);
    }
  }, [messages, sending, isAuthenticated, dashboardContext, selectedLang, languageConfirmed, setMessages, setSending, router]);

  const confirmLanguage = () => {
    if (!selectedLang) return;
    localStorage.setItem(CHAT_LANGUAGE_KEY, selectedLang);
    setLanguageConfirmed(true);
    setMessages(current => current.some(message => message.role === 'user') ? current : []);
  };

  const changeLanguage = (code: string) => {
    setSelectedLang(code);
    localStorage.setItem(CHAT_LANGUAGE_KEY, code);
    setLanguageConfirmed(true);
    setShowLangPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputLocalRef.current?.value || ''); }
  };

  const clearChat = () => {
    window.speechSynthesis?.cancel();
    setMessages([]);
  };

  const activeLang = AI_LANGUAGES.find(l => l.code === selectedLang) ?? AI_LANGUAGES[0];
  const branding = getAssistantBranding();

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(!isOpen ? { inert: 'true' } as any : {})}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-emerald-500 px-4 py-3 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20"><FaRobot className="text-white text-xs" /></div>
            <div>
              <div className="text-xs font-bold text-white leading-none">{branding.title}</div>
              <div className="text-[10px] text-emerald-100">{branding.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowLangPicker(v => !v)}
              title="Select response language"
              aria-label={`Response language: ${activeLang.name}`}
              className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold text-white hover:bg-white/30 transition"
            >
              <FaLanguage size={9} />
              <span>{activeLang.flag} {activeLang.nativeName}</span>
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
              {AI_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
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
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50"
          style={{ minHeight: '200px', maxHeight: 'calc(72vh - 135px)' }}
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {!languageReady ? (
            <div className="rounded-xl bg-white p-4 text-center text-xs text-slate-500">Loading language preferences…</div>
          ) : !languageConfirmed ? (
            <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm" aria-label="Choose chat language">
              <h2 className="text-sm font-semibold text-slate-800">Choose your chat language</h2>
              <p className="mt-1 text-xs text-slate-600">Choose the language Pragati AI should use for replies and voice. You can change it later.</p>
              <p className="mt-1 text-xs text-slate-500">चैट और आवाज़ के जवाबों की भाषा चुनें। बाद में इसे बदल सकते हैं।</p>
              <select
                value={selectedLang}
                onChange={event => setSelectedLang(event.target.value)}
                aria-label="Preferred chat language"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {AI_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.flag} {language.name} — {language.nativeName}</option>)}
              </select>
              <button onClick={confirmLanguage} className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Start chatting / चैट शुरू करें
              </button>
            </section>
          ) : (
            (messages as BilingualMessage[]).map((msg, i) => (
              <MessageBubble key={i} msg={msg} voiceLang={voiceLang} selectedLang={selectedLang} onNavigate={target => {
                const destinationPath = resolveNavigationPath(target, activeRole, isAuthenticated);
                if (destinationPath) router.push(destinationPath);
              }} />
            ))
          )}

          {languageConfirmed && messages.length === 0 && QUICK_PROMPTS[selectedLang] && (
            <div className="flex flex-wrap gap-1.5 pt-1" role="list" aria-label="Quick prompts">
              {QUICK_PROMPTS[selectedLang].map(q => (
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
            {/* VoiceInput uses global language automatically */}
            <VoiceInput
              disabled={sending || !languageConfirmed}
              lang={selectedLang || globalLangCode}
              onTranscript={t => {
                if (inputLocalRef.current) inputLocalRef.current.value = t;
                sendMessage(t);
              }}
            />
          </Suspense>
          <button
            onClick={() => sendMessage(inputLocalRef.current?.value || '')}
            disabled={sending || !languageConfirmed}
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
