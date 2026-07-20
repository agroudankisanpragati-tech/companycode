'use client';

import { useCallback } from 'react';

export type CacheModule = 'disease' | 'soil' | 'crop' | 'advisory';

const CACHE_KEYS: Record<CacheModule, string> = {
  disease:  'kp_disease_cache',
  soil:     'kp_soil_cache',
  crop:     'kp_crop_cache',
  advisory: 'kp_advisory_cache',
};

const MAX_CACHED = 10;

export interface CachedItem<T = any> {
  id: string;
  data: T;
  imagePreview?: string | null;
  cachedAt: string;
  module: CacheModule;
}

function readCache<T>(module: CacheModule): CachedItem<T>[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS[module]);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache<T>(module: CacheModule, items: CachedItem<T>[]) {
  try {
    localStorage.setItem(CACHE_KEYS[module], JSON.stringify(items.slice(-MAX_CACHED)));
  } catch { /* storage full */ }
}

export function useReportCache(module: CacheModule) {
  const save = useCallback(<T>(id: string, data: T, imagePreview?: string | null) => {
    const items = readCache<T>(module);
    const filtered = items.filter(i => i.id !== id);
    filtered.push({ id, data, imagePreview, cachedAt: new Date().toISOString(), module });
    writeCache(module, filtered);
  }, [module]);

  const getAll = useCallback(<T>(): CachedItem<T>[] => {
    return readCache<T>(module).reverse();
  }, [module]);

  const getById = useCallback(<T>(id: string): CachedItem<T> | undefined => {
    return readCache<T>(module).find(i => i.id === id);
  }, [module]);

  const remove = useCallback((id: string) => {
    const items = readCache(module).filter(i => i.id !== id);
    writeCache(module, items);
  }, [module]);

  const clear = useCallback(() => {
    localStorage.removeItem(CACHE_KEYS[module]);
  }, [module]);

  const count = useCallback((): number => readCache(module).length, [module]);

  return { save, getAll, getById, remove, clear, count };
}

export function useGlobalCacheCount(): () => number {
  return useCallback(() => {
    return (Object.keys(CACHE_KEYS) as CacheModule[]).reduce((total, mod) => {
      return total + readCache(mod).length;
    }, 0);
  }, []);
}
