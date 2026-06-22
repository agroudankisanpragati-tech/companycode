'use client';

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { LANGUAGES, DEFAULT_LANGUAGE, getLang, type Language } from '@/i18n/languages';

// ─── Types ────────────────────────────────────────────────────────────────────

type Translations = Record<string, Record<string, string>>;

interface LanguageContextType {
  lang: Language;
  langCode: string;
  t: (section: string, key: string, fallback?: string) => string;
  setLanguage: (code: string, persistToServer?: boolean) => Promise<void>;
  languages: Language[];
  isLoading: boolean;
  showPopup: boolean;
  dismissPopup: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'kp_language';
const POPUP_SEEN_KEY = 'kp_lang_popup_seen';

async function loadTranslations(code: string): Promise<Translations> {
  try {
    const mod = await import(`@/i18n/translations/${code}.json`);
    return mod.default as Translations;
  } catch {
    // fallback to English
    try {
      const mod = await import(`@/i18n/translations/en.json`);
      return mod.default as Translations;
    } catch {
      return {};
    }
  }
}

async function persistLanguageToServer(code: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (!token) return;
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ appLanguage: code }),
    });
  } catch {
    // non-blocking
  }
}

async function fetchServerLanguage(): Promise<string | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (!token) return null;
  try {
    const res = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.appLanguage ?? null;
  } catch {
    return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Cache loaded translations in memory to avoid re-fetching
const translationCache = new Map<string, Translations>();

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [langCode, setLangCode] = useState<string>(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const initialized = useRef(false);

  const loadAndSet = useCallback(async (code: string) => {
    setIsLoading(true);
    let trans = translationCache.get(code);
    if (!trans) {
      trans = await loadTranslations(code);
      translationCache.set(code, trans);
    }
    setTranslations(trans);
    setLangCode(code);

    // Apply dir attribute for RTL languages
    const lang = getLang(code);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
      document.documentElement.dir = lang.dir;
    }
    setIsLoading(false);
  }, []);

  // Initialize: server > localStorage > default, show popup on first visit
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      // Check if popup has been seen
      const popupSeen = localStorage.getItem(POPUP_SEEN_KEY);

      // Try server language (only if logged in)
      const serverLang = await fetchServerLanguage();

      if (serverLang && LANGUAGES.find((l) => l.code === serverLang)) {
        await loadAndSet(serverLang);
        localStorage.setItem(STORAGE_KEY, serverLang);
        // If we have a server language, don't show popup
        if (!popupSeen) localStorage.setItem(POPUP_SEEN_KEY, '1');
      } else {
        // Try localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && LANGUAGES.find((l) => l.code === stored)) {
          await loadAndSet(stored);
          if (!popupSeen) localStorage.setItem(POPUP_SEEN_KEY, '1');
        } else {
          // First visit — load English then show popup
          await loadAndSet(DEFAULT_LANGUAGE);
          if (!popupSeen) {
            setShowPopup(true);
          }
        }
      }
    };

    init();
  }, [loadAndSet]);

  // Re-sync when user logs in/out
  useEffect(() => {
    const handler = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        const serverLang = await fetchServerLanguage();
        if (serverLang && LANGUAGES.find((l) => l.code === serverLang)) {
          await loadAndSet(serverLang);
          localStorage.setItem(STORAGE_KEY, serverLang);
        }
      }
    };
    window.addEventListener('auth-session-changed', handler);
    return () => window.removeEventListener('auth-session-changed', handler);
  }, [loadAndSet]);

  const setLanguage = useCallback(async (code: string, persistToServer = true) => {
    if (!LANGUAGES.find((l) => l.code === code)) return;
    localStorage.setItem(STORAGE_KEY, code);
    await loadAndSet(code);
    if (persistToServer) {
      await persistLanguageToServer(code);
    }
  }, [loadAndSet]);

  const dismissPopup = useCallback(() => {
    setShowPopup(false);
    localStorage.setItem(POPUP_SEEN_KEY, '1');
  }, []);

  const t = useCallback((section: string, key: string, fallback?: string): string => {
    return translations?.[section]?.[key] ?? fallback ?? key;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{
      lang: getLang(langCode),
      langCode,
      t,
      setLanguage,
      languages: LANGUAGES,
      isLoading,
      showPopup,
      dismissPopup,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
