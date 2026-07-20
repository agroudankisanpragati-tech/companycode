'use client';

/**
 * GlobalOfflineBanner — Platform-wide offline indicator.
 * Replaces the disease-only OfflineBanner for all pages.
 * Shows: offline status, cached report count, retry sync, graceful recovery.
 */

import { useEffect, useState } from 'react';
import { FaWifi, FaRedo, FaFileAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useOffline } from '@/hooks/useOffline';

const CACHE_KEYS = [
  'kp_disease_cache',
  'kp_soil_cache',
  'kp_crop_cache',
  'kp_advisory_cache',
];

function countAllCachedItems(): number {
  if (typeof window === 'undefined') return 0;
  return CACHE_KEYS.reduce((total, key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return total;
      const items = JSON.parse(raw);
      return total + (Array.isArray(items) ? items.length : 0);
    } catch {
      return total;
    }
  }, 0);
}

export default function GlobalOfflineBanner() {
  const offline = useOffline();
  const [cachedCount, setCachedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setCachedCount(countAllCachedItems());
  }, [offline]);

  // Flash "synced" banner when coming back online
  useEffect(() => {
    if (!offline && cachedCount > 0) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 4000);
      return () => clearTimeout(t);
    }
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setSyncing(true);
    setRetryCount(c => c + 1);
    setTimeout(() => {
      setSyncing(false);
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 1200);
  };

  if (!offline && !justSynced) return null;

  if (justSynced) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg"
      >
        <FaCheckCircle size={14} aria-hidden="true" />
        <span>Back online — all data synced successfully!</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[9998] bg-amber-500 px-4 py-2.5 shadow-lg"
    >
      <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <FaWifi size={14} className="opacity-80" aria-hidden="true" />
          <span>Offline Mode</span>
          {cachedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              <FaFileAlt size={9} aria-hidden="true" />
              {cachedCount} cached report{cachedCount !== 1 ? 's' : ''} available
            </span>
          )}
          {retryCount > 2 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600/40 px-2 py-0.5 text-xs font-semibold">
              <FaExclamationTriangle size={9} aria-hidden="true" />
              Check your connection
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80 hidden sm:block">
            Cached reports are available offline. Data will sync when connected.
          </span>
          <button
            onClick={handleRetry}
            disabled={syncing}
            aria-label="Retry connection"
            className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold text-white transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <FaRedo size={10} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
            {syncing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
}
