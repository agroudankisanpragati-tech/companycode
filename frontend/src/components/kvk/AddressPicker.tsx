'use client';

import { useState, useCallback } from 'react';
import {
  FaMapMarkerAlt, FaCrosshairs, FaCheck, FaTimes, FaSpinner, FaExclamationTriangle,
} from 'react-icons/fa';
import { geocodeAddress, reverseGeocode } from '@/services/locationService';
import { INDIAN_STATES, type FarmerAddress } from '@/services/addressService';

interface Props {
  value: FarmerAddress | null;
  onSave: (addr: FarmerAddress) => Promise<void>;
  saving?: boolean;
}

const EMPTY: FarmerAddress = { state: '', district: '', village: '', pincode: '', address: '', tehsil: '' };

export default function AddressPicker({ value, onSave, saving = false }: Props) {
  const [editing, setEditing] = useState(!value?.state);
  const [form, setForm] = useState<FarmerAddress>(value ?? EMPTY);
  const [err, setErr] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const set = (k: keyof FarmerAddress, v: string) => setForm(f => ({ ...f, [k]: v }));

  const detectGPS = useCallback(async () => {
    if (!navigator.geolocation) {
      setErr('GPS is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setErr('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const geo = await reverseGeocode(latitude, longitude);
      if (geo) {
        setForm(f => ({
          ...f,
          state: geo.state || f.state,
          district: geo.district || f.district,
          village: geo.village || f.village,
        }));
      }
    } catch (e: any) {
      if (e.code === 1) setErr('Location permission denied. Please allow access or enter manually.');
      else setErr('Could not detect location. Please enter manually.');
    } finally {
      setGpsLoading(false);
    }
  }, []);

  const geocodeAndFill = useCallback(async () => {
    const addrStr = [form.address, form.village, form.district, form.state, form.pincode]
      .filter(Boolean).join(', ');
    if (!addrStr) return;
    setGeocoding(true);
    const coords = await geocodeAddress(addrStr);
    setGeocoding(false);
    if (!coords) {
      setErr('Could not find coordinates for this address. KVK search will use text matching.');
    }
  }, [form]);

  const validate = (): string => {
    if (!form.state) return 'State is required';
    if (!form.district) return 'District is required';
    if (!form.village) return 'Village / City is required';
    if (!form.pincode || !/^\d{6}$/.test(form.pincode)) return 'Valid 6-digit PIN code is required';
    return '';
  };

  const handleSave = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setErr('');
    try {
      await onSave(form);
      setEditing(false);
    } catch (ex: any) {
      setErr(ex.message || 'Failed to save address');
    }
  };

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';

  // Read-only view
  if (!editing && value?.state) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <FaMapMarkerAlt size={13} /> Current Address
          </div>
          <button
            onClick={() => { setForm(value); setEditing(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 transition hover:bg-emerald-50"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {[
            { label: 'State', val: value.state },
            { label: 'District', val: value.district },
            { label: 'Village / City', val: value.village },
            { label: 'PIN Code', val: value.pincode },
            ...(value.tehsil ? [{ label: 'Tehsil', val: value.tehsil }] : []),
            ...(value.address ? [{ label: 'Street', val: value.address }] : []),
          ].map(({ label, val }) => (
            <div key={label} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{val}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
      {!value?.state && (
        <div className="flex items-start gap-2 p-3 bg-amber-100 rounded-xl border border-amber-200">
          <FaExclamationTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={14} />
          <div>
            <p className="text-sm font-bold text-amber-800">Complete Your Address</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Required for nearest KVK, disease detection, and market prices.
            </p>
          </div>
        </div>
      )}

      {/* GPS detect button */}
      <button
        type="button"
        onClick={detectGPS}
        disabled={gpsLoading}
        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 transition w-full justify-center"
      >
        {gpsLoading
          ? <FaSpinner className="animate-spin" size={13} />
          : <FaCrosshairs size={13} />}
        {gpsLoading ? 'Detecting location...' : 'Auto-detect via GPS'}
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">State *</label>
          <select value={form.state} onChange={e => set('state', e.target.value)} className={inputCls}>
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">District *</label>
          <input value={form.district} onChange={e => set('district', e.target.value)} placeholder="e.g. Nagpur" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tehsil</label>
          <input value={form.tehsil || ''} onChange={e => set('tehsil', e.target.value)} placeholder="e.g. Kamptee" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Village / City *</label>
          <input value={form.village} onChange={e => set('village', e.target.value)} placeholder="e.g. Khapri" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PIN Code *</label>
          <input value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="6-digit PIN" maxLength={6} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Street / Landmark</label>
          <input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <FaTimes size={10} /> {err}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || geocoding}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition shadow-sm"
        >
          {saving
            ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            : <FaCheck size={12} />}
          {saving ? 'Saving…' : 'Save Address'}
        </button>
        {value?.state && (
          <button
            onClick={() => { setForm(value); setErr(''); setEditing(false); }}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <FaTimes size={11} /> Cancel
          </button>
        )}
        <button
          onClick={geocodeAndFill}
          disabled={geocoding}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-gray-50 disabled:opacity-50 transition"
          title="Verify coordinates for this address"
        >
          {geocoding ? <FaSpinner className="animate-spin" size={10} /> : <FaMapMarkerAlt size={10} />}
          Verify
        </button>
      </div>
    </div>
  );
}
