'use client';

/**
 * VoiceGuidePopupGuide
 *
 * Listens for custom events dispatched by permission/popup components
 * and triggers the appropriate Voice Guide dialogue.
 *
 * Dispatch from any component:
 *   window.dispatchEvent(new CustomEvent('voice-guide-popup', {
 *     detail: { type: 'camera' | 'location' | 'notification' | 'gallery' | 'internet' | 'permission' }
 *   }));
 */

import { useEffect } from 'react';
import { useVoiceGuideContext } from '@/context/VoiceGuideContext';

const POPUP_DIALOGUE_MAP: Record<string, { page: string; type: string }> = {
  camera:       { page: 'disease_detection', type: 'camera' },
  gallery:      { page: 'disease_detection', type: 'gallery' },
  location:     { page: 'common',            type: 'permission_required' },
  notification: { page: 'app_settings',      type: 'notifications' },
  internet:     { page: 'common',            type: 'no_internet' },
  permission:   { page: 'common',            type: 'permission_required' },
  offline:      { page: 'common',            type: 'offline' },
  error:        { page: 'common',            type: 'error' },
  loading:      { page: 'common',            type: 'loading' },
  success:      { page: 'common',            type: 'success' },
  retry:        { page: 'common',            type: 'retry' },
};

export default function VoiceGuidePopupGuide() {
  const guide = useVoiceGuideContext();

  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>).detail?.type;
      if (!type || guide.isMuted) return;
      const mapping = POPUP_DIALOGUE_MAP[type];
      if (!mapping) return;
      guide.play(mapping.page, mapping.type).catch(() => {});
    };
    window.addEventListener('voice-guide-popup', handler);
    return () => window.removeEventListener('voice-guide-popup', handler);
  }, [guide]);

  return null;
}
