'use client';

import { useCallback } from 'react';
import { ScanResult } from '@/components/disease/types';

const CACHE_KEY = 'kp_disease_cache';
const MAX_CACHED = 10;

export interface CachedReport {
  id: string;
  result: ScanResult;
  uploadedPreview: string | null;
  cachedAt: string;
}

function readCache(): CachedReport[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(items: CachedReport[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(-MAX_CACHED)));
  } catch {
    // storage full — ignore
  }
}

export function useOfflineCache() {
  const saveReport = useCallback((result: ScanResult, uploadedPreview: string | null) => {
    const items = readCache();
    const id = result._id || `local-${Date.now()}`;
    // Deduplicate by id
    const filtered = items.filter(i => i.id !== id);
    filtered.push({ id, result, uploadedPreview, cachedAt: new Date().toISOString() });
    writeCache(filtered);
  }, []);

  const getCachedReports = useCallback((): CachedReport[] => {
    return readCache().reverse(); // newest first
  }, []);

  const deleteCachedReport = useCallback((id: string) => {
    const items = readCache().filter(i => i.id !== id);
    writeCache(items);
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return { saveReport, getCachedReports, deleteCachedReport, clearCache };
}
