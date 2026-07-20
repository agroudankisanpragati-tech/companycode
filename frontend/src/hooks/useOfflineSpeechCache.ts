'use client';

/**
 * useOfflineSpeechCache — Phase 6
 *
 * Client-side cache for:
 *   - Common TTS responses (so offline users still hear voice)
 *   - Dictionary lookups (crop names, disease names, dialect terms)
 *
 * Uses localStorage with a 7-day TTL.
 * Falls back gracefully — never throws, never breaks a page.
 *
 * Design: local speech models can replace cloud providers by reading
 * from this cache first, then calling the local model endpoint.
 */

import { useCallback } from 'react';

const CACHE_PREFIX = 'pragati_speech_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES = 200;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

function storageKey(type: 'tts' | 'dict', key: string, lang: string): string {
  return `${CACHE_PREFIX}${type}_${lang}_${key.slice(0, 80)}`;
}

function readEntry(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function writeEntry(key: string, value: string): void {
  try {
    const entry: CacheEntry = { value, expiresAt: Date.now() + TTL_MS };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full — evict oldest entries
    evictOldest();
    try { localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + TTL_MS })); } catch { /* ignore */ }
  }
}

function evictOldest(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (keys.length < MAX_ENTRIES) return;
    // Remove expired first
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) localStorage.removeItem(k);
      } catch { localStorage.removeItem(k); }
    }
    // If still over limit, remove oldest 20%
    const remaining = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (remaining.length >= MAX_ENTRIES) {
      remaining.slice(0, Math.floor(MAX_ENTRIES * 0.2)).forEach(k => localStorage.removeItem(k));
    }
  } catch { /* ignore */ }
}

export interface OfflineSpeechCache {
  /** Get cached TTS text for a given input + lang */
  getTTS: (text: string, lang: string) => string | null;
  /** Cache TTS text */
  setTTS: (text: string, lang: string, ttsText: string) => void;
  /** Get cached dictionary lookup result */
  getDict: (term: string, lang: string) => string | null;
  /** Cache dictionary lookup result */
  setDict: (term: string, lang: string, result: string) => void;
  /** Pre-warm cache with common agricultural terms */
  prewarm: (entries: Array<{ text: string; lang: string; ttsText: string }>) => void;
  /** Clear all speech cache entries */
  clear: () => void;
}

export function useOfflineSpeechCache(): OfflineSpeechCache {
  const getTTS = useCallback((text: string, lang: string): string | null => {
    if (typeof window === 'undefined') return null;
    return readEntry(storageKey('tts', text.toLowerCase().trim(), lang));
  }, []);

  const setTTS = useCallback((text: string, lang: string, ttsText: string): void => {
    if (typeof window === 'undefined') return;
    writeEntry(storageKey('tts', text.toLowerCase().trim(), lang), ttsText);
  }, []);

  const getDict = useCallback((term: string, lang: string): string | null => {
    if (typeof window === 'undefined') return null;
    return readEntry(storageKey('dict', term.toLowerCase().trim(), lang));
  }, []);

  const setDict = useCallback((term: string, lang: string, result: string): void => {
    if (typeof window === 'undefined') return;
    writeEntry(storageKey('dict', term.toLowerCase().trim(), lang), result);
  }, []);

  const prewarm = useCallback((entries: Array<{ text: string; lang: string; ttsText: string }>): void => {
    for (const { text, lang, ttsText } of entries) {
      setTTS(text, lang, ttsText);
    }
  }, [setTTS]);

  const clear = useCallback((): void => {
    if (typeof window === 'undefined') return;
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, []);

  return { getTTS, setTTS, getDict, setDict, prewarm, clear };
}
