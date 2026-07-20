'use client';

import { useCallback, useRef } from 'react';

const API = '/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    cropName?: string,
    onStep?: (step: number) => void
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const fd = new FormData();
    fd.append('image', file);
    if (cropName?.trim()) fd.append('cropName', cropName.trim());

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
      return { ...json.data, source: json.source, engine: json.engine, similarityScore: json.similarityScore };
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
