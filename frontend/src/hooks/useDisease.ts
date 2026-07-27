'use client';

import { useCallback, useRef } from 'react';

const API = '/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Translate low-level fetch errors into actionable messages.
// "Failed to fetch" / ERR_CONNECTION_REFUSED means the Node backend is not
// running on port 4000 — NOT an internet problem. The AI models are local.
function classifyFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused')) {
    return 'Backend server is not running. Please start the Node.js backend (port 4000) and try again.';
  }
  if (lower.includes('aborted') || lower.includes('abort')) {
    return 'AbortError';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Request timed out. The AI server (FastAPI) may be slow to respond. Please try again.';
  }
  if (lower.includes('503') || lower.includes('service unavailable')) {
    return 'FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again.';
  }
  if (lower.includes('crop verification') || lower.includes('uploaded image belongs')) {
    return 'Please select a crop before scanning.'; // pass through as user-friendly message
  }
  return msg || 'Disease scan failed. Please try again.';
}

export function useDisease() {
  const abortRef = useRef<AbortController | null>(null);

  // Safe JSON parser — never throws on plain-text or HTML error responses
  const safeJson = async (res: Response): Promise<any> => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      // Backend returned plain text / HTML — wrap it so callers always get an object
      return { success: false, error: text.trim() || `HTTP ${res.status}` };
    }
  };

  const scan = useCallback(async (
    file: File,
    cropName: string,
    onStep?: (step: number) => void
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const fd = new FormData();
    fd.append('image', file);
    // cropName is MANDATORY — farmer-selected crop is the only source of truth
    fd.append('cropName', cropName.trim());
    fd.append('farmerCrop', cropName.trim());

    let step = 0;
    onStep?.(step);
    const stepTimer = setInterval(() => { step = Math.min(step + 1, 3); onStep?.(step); }, 1800);

    try {
      const res = await fetch(`${API}/disease/scan`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
        signal: abortRef.current.signal,
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || `Scan failed (HTTP ${res.status})`);
      return {
        ...json.data,
        source: json.source,
        engine: json.engine,
        similarityScore: json.similarityScore,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      const classified = classifyFetchError(err);
      if (classified === 'AbortError') throw new DOMException('Aborted', 'AbortError');
      throw new Error(classified);
    } finally {
      clearInterval(stepTimer);
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1, limit = 20) => {
    const res = await fetch(`${API}/disease/history?page=${page}&limit=${limit}`, {
      headers: authHeaders(),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to fetch history');
    return json;
  }, []);

  const submitFeedback = useCallback(async (
    recommendationId: string,
    feedback: 'helpful' | 'not_helpful',
    comment?: string,
    correctDisease?: string
  ) => {
    const res = await fetch(`${API}/disease/feedback`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId, feedback, comment, correctDisease }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Feedback failed');
    return json;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { scan, fetchHistory, submitFeedback, cancel };
}
