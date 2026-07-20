'use client';

/**
 * AccessibilityProvider — Platform-wide accessibility enhancements.
 * - Large typography toggle (persisted to localStorage)
 * - Touch-friendly controls (min 44px tap targets via CSS class)
 * - Keyboard navigation (focus-visible ring)
 * - Screen-reader live region
 * - Skip-to-content link
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AccessibilityContextType {
  largeText: boolean;
  toggleLargeText: () => void;
  announce: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = 'kp_large_text';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [largeText, setLargeText] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Load persisted preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') {
      setLargeText(true);
      document.documentElement.classList.add('kp-large-text');
    }
  }, []);

  const toggleLargeText = useCallback(() => {
    setLargeText(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('kp-large-text');
        localStorage.setItem(STORAGE_KEY, '1');
      } else {
        document.documentElement.classList.remove('kp-large-text');
        localStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }, []);

  /** Announce a message to screen readers via aria-live region */
  const announce = useCallback((message: string) => {
    setAnnouncement('');
    setTimeout(() => setAnnouncement(message), 50);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ largeText, toggleLargeText, announce }}>
      {/* Skip to main content — keyboard navigation */}
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[99999] focus:rounded-xl focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen-reader live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
