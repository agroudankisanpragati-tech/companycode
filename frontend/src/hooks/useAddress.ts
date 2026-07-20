'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FarmerAddress,
  getAddressFromCache,
  cacheAddress,
  saveAddress,
  isAddressComplete,
} from '@/services/addressService';
import { getFullProfile } from '@/services/farmerProfile';

interface UseAddressReturn {
  address: FarmerAddress | null;
  hasAddress: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (addr: FarmerAddress) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAddress(): UseAddressReturn {
  const [address, setAddress] = useState<FarmerAddress | null>(getAddressFromCache);
  const [loading, setLoading] = useState(!address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getFullProfile();
      const addr: FarmerAddress = {
        state: profile.user.location?.state || profile.ext.state || '',
        district: profile.user.location?.district || profile.ext.district || '',
        village: profile.user.location?.village || profile.ext.village || '',
        pincode: profile.ext.pincode || '',
        address: profile.ext.address || '',
        tehsil: (profile.ext as any).tehsil || '',
      };
      setAddress(addr);
      cacheAddress(addr);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) refresh();

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FarmerAddress>).detail;
      setAddress(detail);
    };
    window.addEventListener('farmer-address-changed', handler);
    return () => window.removeEventListener('farmer-address-changed', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (addr: FarmerAddress) => {
    setSaving(true);
    setError(null);
    try {
      await saveAddress(addr);
      setAddress(addr);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    address,
    hasAddress: isAddressComplete(address),
    loading,
    saving,
    error,
    save,
    refresh,
  };
}
