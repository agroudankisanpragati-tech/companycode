'use client';

import { useCallback } from 'react';
import { useToast } from './useToast';

/**
 * Reusable notification hook — wraps useToast with semantic app-level events.
 * Covers: prediction, reports, profile, address, language, voice, offline.
 */
export function useNotification() {
  const { toast, toasts, dismiss } = useToast();

  const predictionComplete = useCallback(
    (diseaseName: string) => toast.success(`✅ Prediction complete — ${diseaseName} detected`),
    [toast],
  );

  const reportGenerated = useCallback(
    () => toast.success('📄 Report generated! Use Print / Save PDF to download.'),
    [toast],
  );

  const profileUpdated = useCallback(
    () => toast.success('👤 Profile updated successfully.'),
    [toast],
  );

  const addressUpdated = useCallback(
    () => toast.success('📍 Address updated. Nearest KVK refreshed.'),
    [toast],
  );

  const languageChanged = useCallback(
    (langName: string) => toast.info(`🌐 Language changed to ${langName}`),
    [toast],
  );

  const feedbackSent = useCallback(
    (helpful: boolean) =>
      toast.success(helpful ? '👍 Thank you for your feedback!' : '📝 Feedback recorded. We will improve.'),
    [toast],
  );

  const offlineSaved = useCallback(
    () => toast.info('💾 Report saved offline. Will sync when connected.'),
    [toast],
  );

  const syncSuccess = useCallback(
    () => toast.success('🔄 Data synced successfully.'),
    [toast],
  );

  const historyDeleted = useCallback(
    () => toast.success('🗑️ Scan record deleted.'),
    [toast],
  );

  const voiceStarted = useCallback(
    () => toast.info('🎤 Listening... Speak now.'),
    [toast],
  );

  const voiceError = useCallback(
    (reason: string) => toast.error(`🎤 Voice error: ${reason}`),
    [toast],
  );

  const voiceNotSupported = useCallback(
    () => toast.warning('🎤 Voice not supported in this browser. Please use Chrome.'),
    [toast],
  );

  /** Never expose raw backend errors — use a friendly context string */
  const notifyError = useCallback(
    (context: string) => toast.error(`Something went wrong with ${context}. Please try again.`),
    [toast],
  );

  return {
    notify: {
      predictionComplete,
      reportGenerated,
      profileUpdated,
      addressUpdated,
      languageChanged,
      feedbackSent,
      offlineSaved,
      syncSuccess,
      historyDeleted,
      voiceStarted,
      voiceError,
      voiceNotSupported,
      error: notifyError,
    },
    toasts,
    dismiss,
  };
}
