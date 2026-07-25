/**
 * Voice Guide AI — Frontend Service
 *
 * Thin wrapper around /api/voice-guide endpoints.
 * All methods are non-throwing and return structured results.
 */

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
}

async function vgFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: 'unauthenticated' };
  try {
    const res = await fetch(`/api/voice-guide${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(6000),
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok, data: json, error: (json as any)?.error };
  } catch {
    return { success: false, error: 'Voice Guide unavailable' };
  }
}

export const voiceGuideService = {
  initialize: (page: string, language?: string) =>
    vgFetch('POST', '/initialize', { page, language }),

  openPage: (page: string, language?: string) =>
    vgFetch('POST', '/page', { page, language }),

  play: (page: string, dialogueType: string, language?: string, context?: Record<string, unknown>) =>
    vgFetch('POST', '/play', { page, dialogue_type: dialogueType, language, context }),

  replay: (dialogueId?: string) =>
    vgFetch('POST', '/replay', { dialogue_id: dialogueId }),

  setLanguage: (language: string) =>
    vgFetch('POST', '/language', { language }),

  setOnline: (online: boolean) =>
    vgFetch('POST', '/online', { online }),

  getStatus: () =>
    vgFetch('GET', '/status'),

  getDialogue: (page: string, type: string, lang = 'hi') =>
    vgFetch('GET', `/dialogue/${page}/${type}?lang=${lang}`),

  getTranslation: (lang: string, page: string) =>
    vgFetch('GET', `/translation/${lang}/${page}`),

  getAvatarConfig: () =>
    vgFetch('GET', '/avatar/config'),

  health: () =>
    vgFetch('GET', '/health'),
};
