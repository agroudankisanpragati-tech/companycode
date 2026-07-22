import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  profile?: any;
  profileCompleteness?: number;
  preferredLanguage?: string;
  bookmarkedSchemes?: any[];
}

interface AppState {
  user: User | null;
  token: string | null;
  theme: 'dark' | 'light';
  language: 'hi' | 'mr' | 'en';
  isLargeText: boolean;
  voiceEnabled: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setLanguage: (lang: 'hi' | 'mr' | 'en') => void;
  toggleLargeText: () => void;
  toggleVoice: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      theme: 'dark',
      language: 'hi',
      isLargeText: false,
      voiceEnabled: true,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      setLanguage: (language) => set({ language }),
      toggleLargeText: () => set((s) => {
        const next = !s.isLargeText;
        document.body.classList.toggle('large-text', next);
        return { isLargeText: next };
      }),
      toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'seva-mitra-store', partialize: (s) => ({ token: s.token, user: s.user, theme: s.theme, language: s.language, isLargeText: s.isLargeText }) }
  )
);
