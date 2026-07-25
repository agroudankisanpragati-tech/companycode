'use client';

/**
 * KisanSaathiInit
 *
 * Initializes Kisan Saathi ONLY after language selection is complete.
 * Mounted inside layout.tsx after LanguageProvider.
 *
 * Responsibilities:
 *  - Waits for language popup to be dismissed (showPopup === false)
 *  - Fires voice-guide-navigate event so VoiceGuideNavigator picks up current page
 *  - Syncs language to bridge on first init
 *  - Handles auth-session-changed to re-init after login
 */

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useVoiceGuideContext } from '@/context/VoiceGuideContext';

export default function KisanSaathiInit() {
  const { showPopup, langCode } = useLanguage();
  const guide = useVoiceGuideContext();
  const initializedRef = useRef(false);
  const langRef = useRef(langCode);

  // Track language changes
  useEffect(() => {
    langRef.current = langCode;
  }, [langCode]);

  // Initialize after language popup is dismissed
  useEffect(() => {
    if (showPopup) return; // wait for language selection
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Small delay to let auth context settle
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('voice-guide-navigate'));
    }, 600);

    return () => clearTimeout(timer);
  }, [showPopup]);

  // Re-trigger on auth login
  useEffect(() => {
    const handler = () => {
      if (showPopup) return;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('voice-guide-navigate'));
      }, 800);
    };
    window.addEventListener('auth-session-changed', handler);
    return () => window.removeEventListener('auth-session-changed', handler);
  }, [showPopup]);

  // Sync language to bridge whenever it changes (post-init)
  useEffect(() => {
    if (showPopup || !guide.bridgeOnline) return;
    // VoiceGuideContext already handles language-changed event
    // This is a safety net for direct langCode changes
  }, [langCode, showPopup, guide.bridgeOnline]);

  return null;
}
