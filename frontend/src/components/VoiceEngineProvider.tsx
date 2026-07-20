'use client';

/**
 * VoiceEngineProvider — Phase 6
 *
 * Singleton React context that loads the voice engine ONCE and makes it
 * available to every page and component without re-initialization.
 *
 * Performance rules:
 * - Speech services initialized once on mount.
 * - Web Speech API voices loaded once and cached.
 * - No repeated initialization on page navigation.
 * - Background processing via useEffect + refs.
 *
 * Usage:
 *   // In layout.tsx (already wraps all pages):
 *   <VoiceEngineProvider>
 *     {children}
 *   </VoiceEngineProvider>
 *
 *   // In any page/component:
 *   const voice = useVoiceEngineContext();
 *   voice.speak('Your crop has leaf blight');
 *
 * Every page (Disease Detection, Crop Advisory, Soil Health, Weather,
 * Market, Government, KVK, etc.) uses the SAME voice engine instance.
 * No page-specific voice initialization needed.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useVoiceEngine, type VoiceEngineState, type VoiceEngineControls } from '@/hooks/useVoiceEngine';
import type { PipelineResult } from '@/services/speechPipeline';

// ─── Context type ─────────────────────────────────────────────────────────────

type VoiceEngineContextValue = (VoiceEngineState & VoiceEngineControls) & {
  /** True once voices are loaded and engine is ready */
  ready: boolean;
};

const VoiceEngineContext = createContext<VoiceEngineContextValue | null>(null);

// ─── Voice preloader ──────────────────────────────────────────────────────────
// Load Web Speech API voices once on mount so first speak() is instant.

function preloadVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return; // already loaded
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices(); // trigger load
  }, { once: true });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface VoiceEngineProviderProps {
  children: ReactNode;
  /** Optional page context override (usually auto-detected) */
  pageContext?: string;
}

export function VoiceEngineProvider({ children, pageContext }: VoiceEngineProviderProps) {
  const engine = useVoiceEngine(pageContext);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Preload voices once
    preloadVoices();

    // Mark ready after a short delay (voices may need a tick to load)
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const value: VoiceEngineContextValue = { ...engine, ready };

  return (
    <VoiceEngineContext.Provider value={value}>
      {children}
    </VoiceEngineContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

/**
 * Use the shared voice engine from any page or component.
 * Returns a no-op fallback if used outside the provider.
 */
export function useVoiceEngineContext(): VoiceEngineContextValue {
  const ctx = useContext(VoiceEngineContext);
  if (!ctx) {
    // Return safe no-op fallback — never throws
    return {
      ttsState: 'idle', sttState: 'idle', sttError: null, interim: '',
      ttsSupported: false, sttSupported: false, processing: false,
      mode: 'idle', isHolding: false, isContinuous: false, lastResult: null,
      ready: false,
      speak: async () => {},
      speakChunk: () => {},
      interrupt: () => {},
      replay: () => {},
      pause: () => {},
      resume: () => {},
      startListening: () => {},
      stopListening: () => {},
      pushToTalkStart: () => {},
      pushToTalkEnd: () => {},
      startContinuous: () => {},
      stopContinuous: () => {},
    };
  }
  return ctx;
}

// ─── Convenience: VoiceEngineConsumer for class components ────────────────────

export function VoiceEngineConsumer({
  children,
}: {
  children: (ctx: VoiceEngineContextValue) => ReactNode;
}) {
  const ctx = useVoiceEngineContext();
  return <>{children(ctx)}</>;
}
