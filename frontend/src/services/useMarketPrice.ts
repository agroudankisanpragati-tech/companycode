'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { marketService, CurrentMarketPrice, MarketPreference, PriceHistoryPoint } from '@/services/marketPrice';

const REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useMarketPrice() {
  const [preference, setPreference] = useState<MarketPreference | null>(null);
  const [price, setPrice] = useState<CurrentMarketPrice | null>(null);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [locationMissing, setLocationMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG FIX: use ref so loadPrice always reads latest crop without stale closure
  const cropRef = useRef<string>('Wheat');

  const loadHistory = useCallback(async (crop: string) => {
    try {
      const hist = await marketService.getHistory(crop);
      setHistory(hist.data || []);
    } catch {
      // history failure is non-critical
    }
  }, []);

  const loadPrice = useCallback(async (crop?: string) => {
    const activeCrop = crop || cropRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await marketService.getCurrentPrice();
      if (res.locationMissing) {
        setLocationMissing(true);
        setPrice(null);
      } else {
        setLocationMissing(false);
        setPrice(res.data);
        // If backend returned no data but no error, show message
        if (!res.data && res.message) {
          setError(res.message);
        }
      }
      await loadHistory(activeCrop);
    } catch (e: any) {
      // Surface the actual error from backend, not a generic message
      const msg = e?.message || 'Failed to load market data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [loadHistory]);

  const loadPreference = useCallback(async () => {
    try {
      const res = await marketService.getPreference();
      setPreference(res.data);
      cropRef.current = res.data?.selectedCrop || 'Wheat';
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pref = await loadPreference();
      if (!cancelled) {
        await loadPrice(pref?.selectedCrop);
        timerRef.current = setTimeout(() => loadPrice(), REFRESH_MS);
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const selectCrop = useCallback(async (crop: string) => {
    cropRef.current = crop;
    setPreference((p) => p ? { ...p, selectedCrop: crop } : { selectedCrop: crop, selectedDistrict: '', selectedState: '' });
    try {
      await marketService.updatePreference({ selectedCrop: crop });
    } catch { /* non-critical */ }
    await loadPrice(crop);
  }, [loadPrice]);

  const saveLocation = useCallback(async (state: string, district: string) => {
    try {
      await marketService.updatePreference({ selectedState: state, selectedDistrict: district });
      setPreference((p) => p
        ? { ...p, selectedState: state, selectedDistrict: district }
        : { selectedCrop: 'Wheat', selectedState: state, selectedDistrict: district }
      );
      await loadPrice();
    } catch (e: any) {
      setError(e?.message || 'Failed to save location');
    }
  }, [loadPrice]);

  return { preference, price, history, locationMissing, loading, error, selectCrop, saveLocation, refresh: loadPrice };
}
