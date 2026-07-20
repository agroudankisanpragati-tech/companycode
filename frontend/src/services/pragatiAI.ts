/**
 * Pragati AI Service — Frontend
 *
 * Calls the backend /api/pragati-ai endpoints which proxy to the
 * Python Pragati AI Bridge (fastapi_bridge.py on port 8001).
 *
 * Supports text, voice, and image pipelines.
 * All methods are non-throwing — they return structured results.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PragatiAIMetrics {
  totalMs?:     number;
  sttMs?:       number;
  intentMs?:    number;
  routerMs?:    number;
  ttsMs?:       number;
  inferenceMs?: number;
  knowledgeMs?: number;
}

export interface PragatiAIResponse {
  success:        boolean;
  sessionId:      string;
  pipeline:       'text' | 'voice' | 'image';
  intent?:        string;
  confidence?:    number;
  language?:      string;
  responseText?:  string;
  responseAudio?: string;
  imageAnalysis?: {
    crop?:       string;
    className?:  string;
    category?:   string;
    confidence?: number;
    top5?:       Array<{ rank: number; className: string; confidence: number }>;
  };
  knowledge?:    Record<string, unknown> | null;
  suggestions?:  string[];
  moduleId?:     string;
  metrics?:      PragatiAIMetrics;
  error?:        string;
  timestamp?:    string;
}

export interface PragatiAIHistoryItem {
  _id:           string;
  userId:        string;
  sessionId:     string;
  inputType:     'text' | 'voice' | 'image';
  inputText?:    string;
  status:        'success' | 'error' | 'fallback';
  intent?:       string;
  confidence?:   number;
  language?:     string;
  responseText?: string;
  metrics?:      PragatiAIMetrics;
  error?:        string;
  createdAt:     string;
}

export interface PragatiAIStats {
  total:         number;
  byType:        { text: number; voice: number; image: number };
  recentIntents: Array<{ intent: string; createdAt: string }>;
}

export interface PragatiAIHealth {
  status:    string;
  version:   string;
  modules:   Record<string, string>;
  assets:    Record<string, boolean>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildErrorResponse(
  pipeline: 'text' | 'voice' | 'image',
  error: string
): PragatiAIResponse {
  return {
    success:      false,
    sessionId:    '',
    pipeline,
    responseText: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।',
    error,
  };
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ---------------------------------------------------------------------------
// Text Pipeline
// ---------------------------------------------------------------------------

export async function sendTextQuery(
  text: string,
  options: {
    sessionId?:       string;
    language?:        string;
    synthesizeAudio?: boolean;
    extra?:           Record<string, unknown>;
    token?:           string;
  } = {}
): Promise<PragatiAIResponse> {
  try {
    const res = await fetch(`${API_BASE}/pragati-ai/text`, {
      method:  'POST',
      headers: authHeaders(options.token),
      body:    JSON.stringify({
        text,
        sessionId:       options.sessionId,
        language:        options.language,
        synthesizeAudio: options.synthesizeAudio ?? false,
        extra:           options.extra,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return buildErrorResponse('text', (err as any).error || res.statusText);
    }

    return await res.json() as PragatiAIResponse;
  } catch (err: unknown) {
    return buildErrorResponse('text', err instanceof Error ? err.message : 'Network error');
  }
}

// ---------------------------------------------------------------------------
// Voice Pipeline
// ---------------------------------------------------------------------------

export async function sendVoiceQuery(
  audioBlob: Blob,
  filename:  string,
  options: {
    sessionId?:       string;
    language?:        string;
    synthesizeAudio?: boolean;
    token?:           string;
  } = {}
): Promise<PragatiAIResponse> {
  try {
    const form = new FormData();
    form.append('audio', audioBlob, filename);
    if (options.sessionId) form.append('session_id', options.sessionId);
    if (options.language)  form.append('language', options.language);
    form.append('synthesize_audio', String(options.synthesizeAudio ?? true));

    const headers: Record<string, string> = {};
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    const res = await fetch(`${API_BASE}/pragati-ai/voice`, {
      method:  'POST',
      headers,
      body:    form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return buildErrorResponse('voice', (err as any).error || res.statusText);
    }

    return await res.json() as PragatiAIResponse;
  } catch (err: unknown) {
    return buildErrorResponse('voice', err instanceof Error ? err.message : 'Network error');
  }
}

// ---------------------------------------------------------------------------
// Image Pipeline
// ---------------------------------------------------------------------------

export async function sendImageQuery(
  imageFile: File,
  options: {
    sessionId?: string;
    language?:  string;
    token?:     string;
  } = {}
): Promise<PragatiAIResponse> {
  try {
    const form = new FormData();
    form.append('image', imageFile, imageFile.name);
    if (options.sessionId) form.append('session_id', options.sessionId);
    if (options.language)  form.append('language', options.language);

    const headers: Record<string, string> = {};
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    const res = await fetch(`${API_BASE}/pragati-ai/image`, {
      method:  'POST',
      headers,
      body:    form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return buildErrorResponse('image', (err as any).error || res.statusText);
    }

    return await res.json() as PragatiAIResponse;
  } catch (err: unknown) {
    return buildErrorResponse('image', err instanceof Error ? err.message : 'Network error');
  }
}

// ---------------------------------------------------------------------------
// Conversation History
// ---------------------------------------------------------------------------

export async function getAIHistory(
  options: {
    limit?: number;
    skip?:  number;
    type?:  'text' | 'voice' | 'image';
    token?: string;
  } = {}
): Promise<{ conversations: PragatiAIHistoryItem[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.skip)  params.set('skip',  String(options.skip));
    if (options.type)  params.set('type',  options.type);

    const res = await fetch(`${API_BASE}/pragati-ai/history?${params}`, {
      headers: authHeaders(options.token),
    });

    if (!res.ok) return { conversations: [], total: 0 };
    const data = await res.json();
    return { conversations: data.conversations || [], total: data.total || 0 };
  } catch {
    return { conversations: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// AI Health
// ---------------------------------------------------------------------------

export async function getAIHealth(token?: string): Promise<PragatiAIHealth | null> {
  try {
    const res = await fetch(`${API_BASE}/pragati-ai/health`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI Stats
// ---------------------------------------------------------------------------

export async function getAIStats(token?: string): Promise<PragatiAIStats | null> {
  try {
    const res = await fetch(`${API_BASE}/pragati-ai/stats`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.stats : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

export async function endAISession(sessionId: string, token?: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/pragati-ai/session/${encodeURIComponent(sessionId)}`, {
      method:  'DELETE',
      headers: authHeaders(token),
    });
  } catch {
    // Non-critical — session will expire naturally
  }
}
