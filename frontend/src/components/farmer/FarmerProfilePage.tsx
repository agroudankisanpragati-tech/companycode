'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFullProfile, type FullProfile } from '@/services/farmerProfile';
import { useAddress } from '@/hooks/useAddress';

import ProfileHeader from './profile/ProfileHeader';
import CompletionCard from './profile/CompletionCard';
import BasicInfoCard from './profile/BasicInfoCard';
import LocationCard from './profile/LocationCard';
import AddressPicker from '@/components/kvk/AddressPicker';
import ProfileSummaryCard from './profile/ProfileSummaryCard';
import { Toast } from './profile/Toast';
import { LoadingSkeleton, ErrorState } from './profile/States';

export default function FarmerProfilePage() {
  const { address, saving: addrSaving, save: saveAddr, refresh: refreshAddr } = useAddress();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getFullProfile();
      setProfile(p);
    } catch (e: any) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePhotoUpdate = useCallback(async () => {
    try {
      const p = await getFullProfile();
      setProfile(p);
    } catch { /* silent */ }
  }, []);

  const handleAddrSave = useCallback(async (addr: Parameters<typeof saveAddr>[0]) => {
    await saveAddr(addr);
    await refreshAddr();
    const p = await getFullProfile();
    setProfile(p);
    showToast('Address saved successfully!', 'success');
  }, [saveAddr, refreshAddr]);

  if (loading) return <LoadingSkeleton />;
  if (error || !profile) return <ErrorState message={error || 'No profile data'} onRetry={load} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-5">

        <ProfileHeader
          profile={profile}
          onPhotoUpdate={handlePhotoUpdate}
        />

        <CompletionCard profile={profile} />

        <LocationCard
          address={address}
          saving={addrSaving}
          onSave={handleAddrSave}
        />

        {/* AddressPicker — GPS + geocode + auto-notifies KVK widget on save */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">📍</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">Quick Address Picker</div>
              <div className="text-xs text-gray-400">GPS auto-detect or enter manually — updates KVK finder instantly</div>
            </div>
          </div>
          <div className="p-5">
            <AddressPicker value={address} onSave={handleAddrSave} saving={addrSaving} />
          </div>
        </div>

        <BasicInfoCard
          profile={profile}
          onSaved={setProfile}
          onToast={showToast}
        />

        <ProfileSummaryCard profile={profile} />

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
