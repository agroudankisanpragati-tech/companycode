'use client';

import { useState } from 'react';
import { FaMapMarkerAlt, FaEdit, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { FarmerAddress, INDIAN_STATES } from '@/services/addressService';

interface AddressCardProps {
  address: FarmerAddress | null;
  saving?: boolean;
  onSave: (addr: FarmerAddress) => Promise<void>;
  variant?: 'card' | 'compact';
}

const EMPTY: FarmerAddress = { state: '', district: '', tehsil: '', village: '', pincode: '', address: '' };

export default function AddressCard({ address, saving, onSave, variant = 'card' }: AddressCardProps) {
  const hasAddress = !!(address?.state && address?.district && address?.village && address?.pincode);
  const [editing, setEditing] = useState(!hasAddress);
  const [form, setForm] = useState<FarmerAddress>(address ?? EMPTY);
  const [err, setErr] = useState('');

  const set = (k: keyof FarmerAddress, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
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

  const handleCancel = () => {
    if (!hasAddress) return;
    setForm(address!);
    setErr('');
    setEditing(false);
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';

  if (!editing && hasAddress) {
    return (
      <div className={variant === 'card' ? 'rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4' : ''}>
        {variant === 'card' && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <FaMapMarkerAlt />
              Current Address
            </div>
            <button
              onClick={() => { setForm(address!); setEditing(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 transition hover:bg-emerald-50"
            >
              <FaEdit size={11} /> Edit Address
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {[
            { label: 'State', value: address!.state },
            { label: 'District', value: address!.district },
            { label: 'Village / City', value: address!.village },
            { label: 'PIN Code', value: address!.pincode },
            ...(address!.tehsil ? [{ label: 'Tehsil', value: address!.tehsil! }] : []),
            ...(address!.address ? [{ label: 'Street', value: address!.address! }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{value}</div>
            </div>
          ))}
        </div>
        {variant === 'compact' && (
          <button
            onClick={() => { setForm(address!); setEditing(true); }}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition"
          >
            <FaEdit size={11} /> Edit Address
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={variant === 'card' ? 'rounded-2xl border border-amber-200 bg-amber-50/40 p-4' : ''}>
      {variant === 'card' && !hasAddress && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-100 rounded-xl border border-amber-200">
          <FaExclamationTriangle className="text-amber-600 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800">Complete Your Profile</div>
            <div className="text-xs text-amber-700">Address is required to use all features like nearest KVK, disease detection, and market prices.</div>
          </div>
        </div>
      )}

      {variant === 'card' && hasAddress && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
            <FaMapMarkerAlt className="text-emerald-600" />
            Edit Address
          </div>
        </div>
      )}

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
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <FaTimes size={10} /> {err}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition shadow-sm shadow-emerald-200"
        >
          {saving ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <FaCheck size={12} />
          )}
          {saving ? 'Saving…' : 'Save Address'}
        </button>
        {hasAddress && (
          <button onClick={handleCancel} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
            <FaTimes size={11} /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}
