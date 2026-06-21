'use client';
import { useState } from 'react';
import { FaMapMarkerAlt, FaCrosshairs, FaSpinner, FaCheck } from 'react-icons/fa';
import { useLocation } from '@/context/LocationContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LocationModal({ open, onClose }: Props) {
  const { location, isDetecting, saveLocation, detectGPS } = useLocation();
  const [manual, setManual] = useState({ state: '', district: '', village: '', country: 'India' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const hasLocation = !!(location.state && location.district);

  async function handleGPS() {
    await detectGPS();
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  async function handleManualSave() {
    if (!manual.state.trim() || !manual.district.trim()) return;
    setSaving(true);
    await saveLocation({
      country: manual.country.trim() || 'India',
      state: manual.state.trim(),
      district: manual.district.trim(),
      village: manual.village.trim(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FaMapMarkerAlt className="text-emerald-600 text-lg" />
            <h2 className="text-base font-bold text-slate-800">Select Your Location</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {/* Current location badge */}
        {hasLocation && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
            <FaMapMarkerAlt className="text-emerald-500 flex-shrink-0" />
            <span className="font-medium">{location.district}, {location.state}</span>
            {location.country && <span className="text-emerald-500">· {location.country}</span>}
          </div>
        )}

        {/* Option 1: GPS */}
        <button
          onClick={handleGPS}
          disabled={isDetecting || saving}
          className="w-full flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition mb-4"
        >
          {isDetecting
            ? <FaSpinner className="animate-spin text-emerald-600" />
            : saved
            ? <FaCheck className="text-emerald-600" />
            : <FaCrosshairs className="text-emerald-600" />}
          <span>{isDetecting ? 'Detecting location…' : 'Detect My Location Automatically'}</span>
        </button>

        <div className="relative flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-slate-400 font-medium">or select manually</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Option 2: Manual */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">State *</label>
              <input
                placeholder="e.g. Rajasthan"
                value={manual.state}
                onChange={(e) => setManual((m) => ({ ...m, state: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">District *</label>
              <input
                placeholder="e.g. Jaipur"
                value={manual.district}
                onChange={(e) => setManual((m) => ({ ...m, district: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Village / City</label>
              <input
                placeholder="e.g. Sanganer"
                value={manual.village}
                onChange={(e) => setManual((m) => ({ ...m, village: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Country</label>
              <input
                value={manual.country}
                onChange={(e) => setManual((m) => ({ ...m, country: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          <button
            onClick={handleManualSave}
            disabled={saving || isDetecting || !manual.state.trim() || !manual.district.trim()}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving ? <FaSpinner className="animate-spin" /> : saved ? <FaCheck /> : null}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Location'}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          Location is saved to your profile and used across all features.
        </p>
      </div>
    </div>
  );
}
