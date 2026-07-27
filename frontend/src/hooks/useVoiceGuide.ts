'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useVoiceGuideContext } from '@/context/VoiceGuideContext';

export interface UseVoiceGuideReturn {
  avatarState: string;
  subtitle: string;
  isPlaying: boolean;
  isMuted: boolean;
  bridgeOnline: boolean;
  replay: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  dismiss: () => void;
  triggerWelcome: () => Promise<void>;
  triggerError: () => Promise<void>;
  triggerSuccess: () => Promise<void>;
  triggerOffline: () => Promise<void>;
  triggerHelp: () => Promise<void>;
  triggerProcessing: () => Promise<void>;
  triggerDialogue: (dialogueType: string) => Promise<void>;
  triggerButton: (buttonType: string) => void;
}

export function useVoiceGuide(pageKey?: string): UseVoiceGuideReturn {
  const guide = useVoiceGuideContext();
  const triggeredRef = useRef(false);
  const mountedRef = useRef(true);

  const resolvedPage = pageKey || guide.currentPage;

  // Auto-trigger openPage on mount once per page
  // IMPORTANT: gated on bridgeOnline — never fires a network call if bridge is down.
  // Disease Detection must never wait for this.
  useEffect(() => {
    mountedRef.current = true;
    if (!guide.ready || !guide.bridgeOnline || triggeredRef.current) return;
    triggeredRef.current = true;
    if (pageKey) {
      // Fire-and-forget — never awaited, never blocks AI inference
      void guide.openPage(pageKey).catch(() => {});
    }
    return () => {
      mountedRef.current = false;
      triggeredRef.current = false;
      // Exit dialogue is handled by VoiceGuideNavigator on pathname change.
      // Do NOT play exit here — this cleanup fires on React Strict Mode
      // double-mount and hot-reload, causing spurious exit dialogues.
    };
  }, [guide.ready, guide.bridgeOnline, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth login event — trigger login/register success dialogue
  useEffect(() => {
    if (!pageKey) return;
    const onLogin = () => {
      if (pageKey === 'login' || pageKey === 'register') {
        guide.play(pageKey, 'success').catch(() => {});
      }
    };
    window.addEventListener('auth-session-changed', onLogin);
    return () => window.removeEventListener('auth-session-changed', onLogin);
  }, [pageKey, guide]);

  const triggerDialogue = useCallback(
    (dialogueType: string) => guide.play(resolvedPage, dialogueType),
    [guide, resolvedPage],
  );

  const triggerButton = useCallback(
    (buttonType: string) => {
      window.dispatchEvent(new CustomEvent('voice-guide-button', { detail: { button: buttonType } }));
    },
    [],
  );

  return {
    avatarState: guide.avatarState,
    subtitle: guide.subtitle,
    isPlaying: guide.isPlaying,
    isMuted: guide.isMuted,
    bridgeOnline: guide.bridgeOnline,
    replay: guide.replay,
    mute: guide.mute,
    unmute: guide.unmute,
    toggleMute: guide.toggleMute,
    dismiss: guide.dismiss,
    triggerWelcome:    () => triggerDialogue('welcome'),
    triggerError:      () => triggerDialogue('error'),
    triggerSuccess:    () => triggerDialogue('success'),
    triggerOffline:    () => triggerDialogue('offline'),
    triggerHelp:       () => triggerDialogue('help'),
    triggerProcessing: () => triggerDialogue('processing'),
    triggerDialogue,
    triggerButton,
  };
}
