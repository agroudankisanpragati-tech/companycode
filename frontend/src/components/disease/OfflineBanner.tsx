'use client';

import { useEffect, useState } from 'react';
import { FaWifi, FaRedo, FaFileAlt, FaCheckCircle } from 'react-icons/fa';
import { useOffline } from '@/hooks/useOffline';
import { useOfflineCache } from '@/hooks/useOfflineCache';

export default function OfflineBanner() {
  const offline = useOffline();
  const { getCachedReports } = useOfflineCache();
  const [cachedCount, setCachedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    setCachedCount(getCachedReports().length);
  }, [offline, getCachedReports]);

  // Show "synced" flash when coming back online
  useEffect(() => {
    if (!offline && cachedCount > 0) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 3000);
      return () => clearTimeout(t);
    }
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setSyncing(true);
    // Trigger a page reload to re-attempt any pending requests
    setTimeout(() => {
      setSyncing(false);
      window.location.reload();
    }, 800);
  };

  if (!offline && !justSynced) return null;

  if (justSynced) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg"
      >
        <FaCheckCircle size={14} aria-hidden="true" />
        <span>Back online — data synced successfully!</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[9998] bg-amber-500 px-4 py-2 shadow-lg"
    >
      <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <FaWifi size={14} className="opacity-80" aria-hidden="true" />
          <span>Offline Mode</span>
          {cachedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              <FaFileAlt size={9} aria-hidden="true" />
              {cachedCount} cached report{cachedCount !== 1 ? 's' : ''} available
            </span>
          )}
        </div>
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
  );
}
