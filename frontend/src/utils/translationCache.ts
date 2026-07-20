/**
 * Translation Cache — Frontend
 *
 * Two-layer cache:
 *   1. In-memory Map  — fastest, cleared on page reload
 *   2. localStorage   — persists across reloads, capped at MAX_ENTRIES
 *
 * Key format: `${normalizedText}::${langCode}::${context}`
 *
 * This is the single cache used by useSpeechPipeline and useLanguageEngine.
 * No business logic lives here — only get/set/clear.
 */

const STORAGE_KEY = 'pragati_translation_cache';
const MAX_ENTRIES = 500;

// ─── Normalize key (mirrors backend normalizeKey) ─────────────────────────────

function nk(s: string): string {
  return s.toLowerCase().replace(/[\s_\-]+/g, '');
}

function buildKey(text: string, langCode: string, ctx = ''): string {
  return `${nk(text)}::${langCode}::${ctx}`;
}

// ─── In-memory layer ──────────────────────────────────────────────────────────

const memCache = new Map<string, string>();

// ─── localStorage layer ───────────────────────────────────────────────────────

function loadFromStorage(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(store: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    // Evict oldest entries if over cap
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      const evict = keys.slice(0, keys.length - MAX_ENTRIES);
      evict.forEach((k) => delete store[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full — clear and retry once
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCached(text: string, langCode: string, ctx = ''): string | null {
  const key = buildKey(text, langCode, ctx);
  if (memCache.has(key)) return memCache.get(key)!;
  const store = loadFromStorage();
  if (store[key]) {
    memCache.set(key, store[key]); // warm memory cache
    return store[key];
  }
  return null;
}

export function setCached(text: string, langCode: string, value: string, ctx = ''): void {
  const key = buildKey(text, langCode, ctx);
  memCache.set(key, value);
  const store = loadFromStorage();
  store[key] = value;
  saveToStorage(store);
}

export function clearCache(): void {
  memCache.clear();
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export function getCacheStats(): { memory: number; storage: number } {
  return {
    memory: memCache.size,
    storage: Object.keys(loadFromStorage()).length,
  };
}
