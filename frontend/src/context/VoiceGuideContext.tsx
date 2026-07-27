'use client';

/**
 * VoiceGuideContext — Voice Guide AI Integration Context
 *
 * Singleton context that:
 *  - Connects to /api/voice-guide (backend → Python bridge)
 *  - Tracks current page, language, dialogue state
 *  - Exposes avatar state, subtitle text, and controls
 *  - Listens to navigation, auth, language, and offline events
 *  - Recovers gracefully when bridge is unavailable
 *
 * Used by VoiceGuideAvatar component and useVoiceGuide hook.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

declare global {
  interface Window {
    __VOICE_GUIDE__?: {
      providerMounted: boolean;
      bridgeOnline: boolean;
      ready: boolean;
      _bridgeOnline: boolean;
      _ready: boolean;
      initializeVoiceGuide: () => void;
      openPage: (page?: string) => void;
      play: (page: string, dialogueType: string) => void;
    };
  }
}

// ── Supported pages ──────────────────────────────────────────────────────────
export const SUPPORTED_PAGES = new Set([
  'language_popup','home','login','register','profile','weather','mandi',
  'marketplace','crop_recommendation','disease_detection','government_scheme',
  'soil_health','ai_chat','app_settings','common',
]);

// ── Page map: URL path → Voice Guide page key ─────────────────────────────────

const PAGE_MAP: Array<{ pattern: RegExp; page: string }> = [
  { pattern: /\/auth\/login/,                                    page: 'login' },
  { pattern: /\/auth\/register/,                                 page: 'register' },
  { pattern: /\/auth/,                                           page: 'login' },
  { pattern: /\/dashboard\/farmer\/profile/,                     page: 'profile' },
  { pattern: /\/dashboard\/farmer\/soil-health/,                 page: 'soil_health' },
  { pattern: /\/dashboard\/farmer\/my-crops/,                    page: 'crop_recommendation' },
  { pattern: /\/dashboard\/farmer/,                              page: 'home' },
  { pattern: /\/disease-detection/,                              page: 'disease_detection' },
  { pattern: /\/crop-recommendation/,                            page: 'crop_recommendation' },
  { pattern: /\/soil-health/,                                    page: 'soil_health' },
  { pattern: /\/weather/,                                        page: 'weather' },
  { pattern: /\/mandi-prices/,                                   page: 'mandi' },
  { pattern: /\/marketplace/,                                    page: 'marketplace' },
  { pattern: /\/schemes|\/rajasthan\/schemes/,                   page: 'government_scheme' },
  { pattern: /\/ai-assistant/,                                   page: 'ai_chat' },
  { pattern: /\/settings/,                                       page: 'app_settings' },
  { pattern: /^\/$|\/about|\/crop-advisory|\/farmer-stories/,   page: 'home' },
];

function detectVoiceGuidePage(pathname: string): string {
  for (const { pattern, page } of PAGE_MAP) {
    if (pattern.test(pathname)) return page;
  }
  return 'home';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarState =
  | 'idle' | 'wave' | 'speaking' | 'listening' | 'thinking'
  | 'success' | 'error' | 'loading' | 'namaste';

export interface DialogueData {
  id: string;
  text: string;
  language: string;
  avatar: { animation: string; expression: string };
  voice: { enabled: boolean; file?: string };
  display: { showSubtitle: boolean; showAvatar: boolean };
}

export interface VoiceGuideState {
  ready: boolean;
  bridgeOnline: boolean;
  currentPage: string;
  avatarState: AvatarState;
  subtitle: string;
  isPlaying: boolean;
  isMuted: boolean;
  currentDialogue: DialogueData | null;
}

export interface VoiceGuideControls {
  initializeVoiceGuide: (page?: string) => Promise<void>;
  openPage: (page?: string) => Promise<void>;
  play: (page: string, dialogueType: string) => Promise<void>;
  replay: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  dismiss: () => void;
  /** Pre-auth: play language popup dialogue without token */
  playPreAuth: (dialogueType: string, langCode?: string) => void;
  /** Dispatch a button event to trigger voice guide */
  triggerButton: (buttonType: string) => void;
}

type VoiceGuideContextValue = VoiceGuideState & VoiceGuideControls;

// ── Context ───────────────────────────────────────────────────────────────────

const VoiceGuideContext = createContext<VoiceGuideContextValue | null>(null);

// ── API helper ────────────────────────────────────────────────────────────────

async function vgApi(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Use a longer timeout for initialize (cold-start) vs fast calls.
    // /initialize can take up to 15 s on Python bridge cold start.
    const timeoutMs = path === '/initialize' ? 20000 : 10000;
    const res = await fetch(`/api/voice-guide${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json = await res.json().catch(() => ({}));
    return { success: res.ok, data: json, error: (json as any)?.error };
  } catch {
    return { success: false, error: 'Voice Guide unavailable' };
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function VoiceGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { langCode } = useLanguage();

  const [ready, setReady] = useState(false);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [subtitle, setSubtitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentDialogue, setCurrentDialogue] = useState<DialogueData | null>(null);

  const lastPageRef = useRef('');
  const lastLangRef = useRef('');
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initAttemptedRef = useRef(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const visitedPagesRef = useRef<Set<string>>(new Set());
  const dialogueHistoryRef = useRef<Array<{ page: string; type: string; text: string }>>([]);
  const lastSpokenTextRef = useRef<string>('');
  const audioUnlockedRef = useRef(false);
  const pendingPlayRef = useRef<string>('');
  // Stable ref to always-current controls — avoids stale closures in effects
  const controlsRef = useRef<{
    initializeVoiceGuide: (page?: string) => Promise<void>;
    openPage: (page?: string) => Promise<void>;
    play: (page: string, dialogueType: string) => Promise<void>;
  } | null>(null);

  const getToken = useCallback(
    () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null),
    [],
  );

  // ── Audio unlock + speak ──────────────────────────────────────────────────

  const speakText = useCallback((text: string, lang: string) => {
    if (!text || isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    lastSpokenTextRef.current = text;

    const doSpeak = () => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;
      utter.rate = 0.9;
      utter.onstart = () => { setAvatarState('speaking'); setIsPlaying(true); };
      utter.onend   = () => { setAvatarState('idle');     setIsPlaying(false); };
      utter.onerror = (e) => {
        // NotAllowedError = autoplay blocked; queue for next interaction
        if ((e as any).error === 'not-allowed') {
          pendingPlayRef.current = text;
        }
        setAvatarState('idle');
        setIsPlaying(false);
      };
      window.speechSynthesis.speak(utter);
    };

    if (audioUnlockedRef.current) {
      doSpeak();
    } else {
      // Queue for first user interaction
      pendingPlayRef.current = text;
    }
  }, [isMuted]);

  // Unlock audio on first user interaction and flush any pending speech
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      if (pendingPlayRef.current) {
        const text = pendingPlayRef.current;
        pendingPlayRef.current = '';
        speakText(text, langCode);
      }
    };
    window.addEventListener('click',      unlock, { once: false, passive: true });
    window.addEventListener('touchstart', unlock, { once: false, passive: true });
    window.addEventListener('keydown',    unlock, { once: false, passive: true });
    return () => {
      window.removeEventListener('click',      unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown',    unlock);
    };
  }, [langCode, speakText]);

  // ── Bridge health check ───────────────────────────────────────────────────
  // Checks Voice Guide bridge (localhost:8002) ONLY — completely independent
  // of Disease Detection (localhost:8000 FastAPI / localhost:4000 Node).
  // A failed bridge check NEVER blocks or affects AI inference.
  // /health is public — no token required.
  // NOTE: No state in deps — uses functional updater to avoid re-registering
  // the 30-second interval every time `ready` flips.

  const checkBridge = useCallback(async () => {
    const res = await vgApi('GET', '/health');
    setBridgeOnline(res.success);
    if (res.success) setReady(prev => prev ? prev : true);
    if (!res.success) {
      // Voice Guide bridge is down — expected when bridge is not started.
      // Disease Detection continues to work fully offline without Voice Guide.
      console.warn('[VoiceGuide] bridge unavailable (Voice Guide is optional):', res.error);
    }
  }, []); // stable — no deps

  // ── Show subtitle with auto-dismiss ──────────────────────────────────────

  const showSubtitle = useCallback((text: string, durationMs = 8000) => {
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    setSubtitle(text);
    subtitleTimerRef.current = setTimeout(() => setSubtitle(''), durationMs);
  }, []);

  const emitRuntimeEvent = useCallback((eventType: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('voice-guide-runtime-event', {
      detail: {
        event_type: eventType,
        payload,
        timestamp: new Date().toISOString(),
      },
    }));
  }, []);

  const initializeVoiceGuide = useCallback(
    async (pageOverride?: string) => {
      if (!isAuthenticated || isMuted || initPromiseRef.current) return;
      const token = getToken();
      if (!token) return;

      const page = pageOverride ?? detectVoiceGuidePage(
        typeof window !== 'undefined' ? window.location.pathname : '/',
      );

      initPromiseRef.current = (async () => {
        setAvatarState('loading');
        const res = await vgApi('POST', '/initialize', { page, language: langCode }, token);
        if (!res.success) {
          const reason = (res.error as string) || 'Voice Guide unavailable';
          setBridgeOnline(false);
          setAvatarState('error');
          setReady(false);
          emitRuntimeEvent('init_failed', { page, reason });
          console.error('[VoiceGuide] initialization failed', reason);
          return;
        }

        setBridgeOnline(true);
        setReady(true);
        setCurrentPage(page);
        lastPageRef.current = page;
        lastLangRef.current = langCode;

        const result = (res.data as any)?.data;
        // /initialize response: { data: { runtime, avatar, dialogue, page } }
        // page shape from api_bridge: { success, data: { text, events, ... } }
        const pageData = result?.page?.data ?? result?.page ?? {};
        const dialogueData = result?.dialogue?.data ?? {};
        const runtimeStatus = result?.runtime?.status ?? result?.runtime ?? null;
        const events = runtimeStatus?.events ?? [];
        const text: string =
          pageData?.text ||
          pageData?.events?.[0]?.payload?.text ||
          dialogueData?.text ||
          dialogueData?.data?.text || '';

        if (events.length) {
          events.forEach((event: Record<string, unknown>) => {
            emitRuntimeEvent((event.event_type as string) || 'runtime_event', {
              ...(event.payload as Record<string, unknown> | undefined),
              event_type: event.event_type,
            });
          });
        }

        emitRuntimeEvent('runtime_ready', {
          page,
          language: langCode,
          status: runtimeStatus,
        });
        console.info('[VoiceGuide] initialized successfully', { page, language: langCode });

        if (text) {
          showSubtitle(text);
          setAvatarState('wave');
          setTimeout(() => speakText(text, langCode), 300);
        } else {
          setAvatarState('idle');
        }
      })().finally(() => {
        initPromiseRef.current = null;
      });

      await initPromiseRef.current;
    },
    [isAuthenticated, isMuted, getToken, langCode, showSubtitle, emitRuntimeEvent, speakText],
  );

  // ── Open page ─────────────────────────────────────────────────────────────

  const openPage = useCallback(
    async (pageOverride?: string) => {
      if (!isAuthenticated || isMuted) return;
      const token = getToken();
      if (!token) return;

      const page = pageOverride ?? detectVoiceGuidePage(
        typeof window !== 'undefined' ? window.location.pathname : '/',
      );

      if (page === lastPageRef.current && langCode === lastLangRef.current) return;
      lastPageRef.current = page;
      lastLangRef.current = langCode;
      setCurrentPage(page);

      setAvatarState('loading');
      const res = await vgApi('POST', '/page', { page, language: langCode }, token);

      if (!res.success) {
        setBridgeOnline(false);
        setAvatarState('idle');
        return;
      }

      setBridgeOnline(true);
      // /page response shape: { success, data: { page, language, dialogue_result, text, events } }
      const outer = (res.data as any);
      const result = outer?.data ?? outer;
      const text: string =
        result?.text ||
        result?.dialogue_result?.text ||
        result?.events?.[0]?.payload?.text || '';
      if (text) {
        setAvatarState('wave');
        showSubtitle(text);
        setTimeout(() => speakText(text, langCode), 300);
      } else {
        setAvatarState('idle');
      }
    },
    [isAuthenticated, isMuted, getToken, langCode, showSubtitle, speakText],
  );

  // ── Play specific dialogue ────────────────────────────────────────────────

  const play = useCallback(
    async (page: string, dialogueType: string) => {
      if (!isAuthenticated || isMuted) return;
      const token = getToken();
      if (!token) return;

      setAvatarState('loading');
      const res = await vgApi('POST', '/play', {
        page, dialogue_type: dialogueType, language: langCode,
      }, token);

      if (!res.success) { setAvatarState('idle'); return; }

      // /play response shape: { success, data: { success, text, dialogue_id, ... } }
      const outer = (res.data as any);
      const result = outer?.data ?? outer;
      const text: string =
        result?.text ||
        result?.dialogue?.text ||
        result?.events?.[0]?.payload?.text ||
        result?.metadata?.text || '';
      if (text) {
        showSubtitle(text);
        setAvatarState('wave');
        setTimeout(() => speakText(text, langCode), 300);
      } else {
        setAvatarState('speaking');
        setIsPlaying(true);
        setTimeout(() => { setAvatarState('idle'); setIsPlaying(false); }, 6000);
      }
    },
    [isAuthenticated, isMuted, getToken, langCode, showSubtitle, speakText],
  );

  // ── Replay ────────────────────────────────────────────────────────────────

  const replay = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = getToken();
    if (!token) return;

    setAvatarState('loading');
    const res = await vgApi('POST', '/replay', {}, token);
    if (!res.success) { setAvatarState('idle'); return; }

    // /replay response shape: { success, data: { success, text, dialogue_id, ... } }
    const outer = (res.data as any);
    const result = outer?.data ?? outer;
    const text: string =
      result?.text ||
      result?.dialogue?.text ||
      result?.events?.[0]?.payload?.text || '';
    if (text) {
      showSubtitle(text);
      setAvatarState('wave');
      setTimeout(() => speakText(text, langCode), 300);
    } else if (lastSpokenTextRef.current) {
      setTimeout(() => speakText(lastSpokenTextRef.current, langCode), 300);
    } else {
      setAvatarState('speaking');
      setIsPlaying(true);
      setTimeout(() => { setAvatarState('idle'); setIsPlaying(false); }, 6000);
    }
  }, [isAuthenticated, getToken, langCode, showSubtitle, speakText]);

  // ── Mute controls ─────────────────────────────────────────────────────────

  const mute = useCallback(() => {
    setIsMuted(true);
    setAvatarState('idle');
    setSubtitle('');
    setIsPlaying(false);
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const unmute = useCallback(() => setIsMuted(false), []);
  const toggleMute = useCallback(() => (isMuted ? unmute() : mute()), [isMuted, mute, unmute]);
  const dismiss = useCallback(() => {
    setSubtitle('');
    setIsPlaying(false);
    setAvatarState('idle');
  }, []);

  // ── Init: check bridge on mount ───────────────────────────────────────────
  // Keep controlsRef current so window.__VOICE_GUIDE__ always calls the
  // latest version without re-running the mount effect on every render.

  useEffect(() => {
    controlsRef.current = { initializeVoiceGuide, openPage, play };
  }, [initializeVoiceGuide, openPage, play]);

  // Mount effect runs ONCE — registers the global registry and emits the
  // provider_mounted event a single time. bridgeOnline/ready are read via
  // refs inside the registry callbacks so they stay current without
  // causing the effect to re-run.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__VOICE_GUIDE__ = {
      providerMounted: true,
      get bridgeOnline() { return window.__VOICE_GUIDE__?._bridgeOnline ?? false; },
      get ready() { return window.__VOICE_GUIDE__?._ready ?? false; },
      _bridgeOnline: false,
      _ready: false,
      initializeVoiceGuide: () => { void controlsRef.current?.initializeVoiceGuide(); },
      openPage: (page?: string) => { void controlsRef.current?.openPage(page); },
      play: (page: string, dialogueType: string) => { void controlsRef.current?.play(page, dialogueType); },
    } as any;
    emitRuntimeEvent('provider_mounted', { isAuthenticated });
    console.info('[VoiceGuide] provider mounted');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // Keep the registry's live values in sync without re-running the mount effect
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__VOICE_GUIDE__) return;
    (window.__VOICE_GUIDE__ as any)._bridgeOnline = bridgeOnline;
    (window.__VOICE_GUIDE__ as any)._ready = ready;
  }, [bridgeOnline, ready]);

  useEffect(() => {
    // Check bridge on mount regardless of auth — /health is public.
    checkBridge();
    const interval = setInterval(checkBridge, 30000);
    return () => clearInterval(interval);
  }, [checkBridge]);

  // ── React to auth changes ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      lastPageRef.current = '';
      lastLangRef.current = '';
      initAttemptedRef.current = false;
    };
    window.addEventListener('auth-session-changed', handler);
    return () => window.removeEventListener('auth-session-changed', handler);
  }, []);

  // ── React to language changes ─────────────────────────────────────────────
  // Single effect reacting to langCode state — the language-changed custom
  // event is NOT also handled here to avoid double /language calls.
  // (LanguageContext dispatches language-changed AND updates langCode state;
  //  handling both would send /language twice for every user language change.)

  useEffect(() => {
    if (!isAuthenticated || !bridgeOnline) return;
    const token = getToken();
    if (!token) return;
    vgApi('POST', '/language', { language: langCode }, token).then((res) => {
      if (res.success) {
        const text: string = (res.data as any)?.text || '';
        if (text) {
          showSubtitle(text);
          setAvatarState('wave');
          setTimeout(() => speakText(text, langCode), 300);
        }
      }
    }).catch(() => {});
    // Do NOT reset lastPageRef here — VoiceGuideNavigator handles the
    // page re-open after a language change via its own pathname effect.
  }, [langCode, isAuthenticated, bridgeOnline, getToken, showSubtitle, speakText]);

  // ── React to online/offline ───────────────────────────────────────────────
  // NOTE: navigator.onLine reflects internet connectivity, NOT localhost.
  // Disease Detection uses localhost:4000 (Node) and localhost:8000 (FastAPI).
  // Going offline from the internet does NOT affect disease detection.
  // We only notify the Voice Guide bridge — never touch disease pipeline state.

  useEffect(() => {
    const goOnline = () => {
      const token = getToken();
      if (token) vgApi('POST', '/online', { online: true }, token).catch(() => {});
    };
    const goOffline = () => {
      const token = getToken();
      // Only notify Voice Guide bridge — disease detection is unaffected
      if (token) vgApi('POST', '/online', { online: false }, token).catch(() => {});
      setBridgeOnline(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [getToken]);

  // ── React to runtime events emitted by the bridge ───────────────────────

  useEffect(() => {
    const handleRuntimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event_type?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.event_type) return;
      if (detail.event_type === 'page_opened' && typeof detail.payload?.page === 'string') {
        setCurrentPage(detail.payload.page);
      }
      if (detail.event_type === 'dialogue_started' && typeof detail.payload?.page === 'string') {
        setAvatarState('speaking');
      }
      if (detail.event_type === 'error' && typeof detail.payload?.message === 'string') {
        const msg = detail.payload.message as string;
        // Suppress BOM encoding errors — handled at the Python layer via utf-8-sig
        if (!msg.includes('UTF-8 BOM') && !msg.includes('utf-8-sig')) {
          console.error('[VoiceGuide] runtime event', msg);
        }
      }
    };

    window.addEventListener('voice-guide-runtime-event', handleRuntimeEvent as EventListener);
    return () => window.removeEventListener('voice-guide-runtime-event', handleRuntimeEvent as EventListener);
  }, []);

  // ── Page navigation is handled exclusively by VoiceGuideNavigator ────────────
  // VoiceGuideNavigator listens to pathname changes (Next.js App Router)
  // and calls openPage() / play(exit) at the right time.
  // We do NOT also listen to popstate here — that would cause two openPage
  // calls for every navigation (one from Navigator, one from here).

  // ── Open page on first auth + bridge ready ────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !bridgeOnline || !ready || initAttemptedRef.current) return;
    if (typeof window !== 'undefined' && (window as any).__VG_INIT_DONE__) return;
    initAttemptedRef.current = true;
    if (typeof window !== 'undefined') (window as any).__VG_INIT_DONE__ = true;
    void initializeVoiceGuide();
  }, [isAuthenticated, bridgeOnline, ready, initializeVoiceGuide]);

  // ── Track visited pages for session ──────────────────────────────────────

  useEffect(() => {
    if (currentPage) visitedPagesRef.current.add(currentPage);
  }, [currentPage]);

  // ── Pre-auth language popup voice (uses Web Speech API directly) ─────────

  const playPreAuth = useCallback((dialogueType: string, code?: string) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const lang = code || langCode;
    // Load translation from voice_guide_ai translations
    const PREAUTH_TEXTS: Record<string, Record<string, string>> = {
      welcome: {
        hi: 'नमस्कार! किसान उन्नति में आपका स्वागत है। कृपया अपनी भाषा चुनें।',
        en: 'Welcome to Kisan Pragati! Please select your preferred language.',
      },
      language_selected: {
        hi: 'भाषा सफलतापूर्वक चुन ली गई है। अब आप आगे बढ़ सकते हैं।',
        en: 'Language selected successfully. You can now proceed.',
      },
      help: {
        hi: 'यदि आपको सहायता चाहिए, तो दिए गए विकल्पों को ध्यान से चुनें।',
        en: 'If you need help, carefully choose from the given options.',
      },
    };
    const text = PREAUTH_TEXTS[dialogueType]?.[lang] ||
      PREAUTH_TEXTS[dialogueType]?.['hi'] ||
      PREAUTH_TEXTS[dialogueType]?.['en'] || '';
    if (!text) return;
    // playPreAuth is always triggered by a user click — mark audio unlocked
    audioUnlockedRef.current = true;
    pendingPlayRef.current = '';
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    utter.rate = 0.9;
    utter.onstart = () => { setAvatarState('speaking'); setIsPlaying(true); showSubtitle(text, 8000); };
    utter.onend = () => { setAvatarState('idle'); setIsPlaying(false); };
    utter.onerror = () => { setAvatarState('idle'); setIsPlaying(false); };
    setAvatarState('wave');
    setTimeout(() => window.speechSynthesis.speak(utter), 300);
  }, [isMuted, langCode, showSubtitle]);

  // ── Button event trigger ──────────────────────────────────────────────────

  const triggerButton = useCallback((buttonType: string) => {
    if (!isAuthenticated || isMuted) return;
    const BUTTON_DIALOGUE_MAP: Record<string, string> = {
      replay: 'replay', language_change: 'language', close: 'exit',
      skip: 'exit', continue: 'success', retry: 'retry', back: 'exit',
      home: 'welcome', submit: 'processing', save: 'save',
    };
    const dialogueType = BUTTON_DIALOGUE_MAP[buttonType] || 'help';
    play(currentPage, dialogueType).catch(() => {});
  }, [isAuthenticated, isMuted, currentPage, play]);

  // ── Listen for button events from anywhere ────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent<{ button: string }>).detail?.button;
      if (btn) triggerButton(btn);
    };
    window.addEventListener('voice-guide-button', handler);
    return () => window.removeEventListener('voice-guide-button', handler);
  }, [triggerButton]);

  // ── Auto-trigger offline dialogue ─────────────────────────────────────────

  useEffect(() => {
    const goOffline = () => {
      if (!isAuthenticated || isMuted) return;
      setAvatarState('error');
      showSubtitle(
        langCode === 'en'
          ? 'No internet connection. Please check your network.'
          : 'अभी इंटरनेट उपलब्ध नहीं है। कृपया कनेक्शन चालू करके फिर से प्रयास करें।',
        10000,
      );
    };
    const goOnline = () => {
      if (!isAuthenticated || isMuted) return;
      setAvatarState('success');
      showSubtitle(
        langCode === 'en' ? 'Back online!' : 'इंटरनेट कनेक्शन वापस आ गया है।',
        4000,
      );
      setTimeout(() => setAvatarState('idle'), 4000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [isAuthenticated, isMuted, langCode, showSubtitle]);

  const value: VoiceGuideContextValue = {
    ready,
    bridgeOnline,
    currentPage,
    avatarState,
    subtitle,
    isPlaying,
    isMuted,
    currentDialogue,
    initializeVoiceGuide,
    openPage,
    play,
    replay,
    mute,
    unmute,
    toggleMute,
    dismiss,
    playPreAuth,
    triggerButton,
  };

  return (
    <VoiceGuideContext.Provider value={value}>
      {children}
    </VoiceGuideContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useVoiceGuideContext(): VoiceGuideContextValue {
  const ctx = useContext(VoiceGuideContext);
  if (!ctx) {
    return {
      ready: false, bridgeOnline: false, currentPage: 'home',
      avatarState: 'idle', subtitle: '', isPlaying: false,
      isMuted: false, currentDialogue: null,
      initializeVoiceGuide: async () => {},
      openPage: async () => {}, play: async () => {}, replay: async () => {},
      mute: () => {}, unmute: () => {}, toggleMute: () => {}, dismiss: () => {},
      playPreAuth: () => {}, triggerButton: () => {},
    };
  }
  return ctx;
}
