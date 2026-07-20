'use client';

import { useState } from 'react';
import {
  FaTimes, FaSpinner, FaSave, FaToggleOn, FaToggleOff,
} from 'react-icons/fa';
import { createKVK, updateKVK } from '@/components/admin/admin-api';
import type { KVKRecord } from '@/components/admin/admin-types';

type FormState = {
  name: string; address: string; village: string; district: string;
  state: string; pincode: string; latitude: string; longitude: string;
  phone: string; altPhone: string; email: string; website: string;
  officeTimings: string; servicesOffered: string; notes: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: '', address: '', village: '', district: '', state: '', pincode: '',
  latitude: '', longitude: '', phone: '', altPhone: '', email: '',
  website: '', officeTimings: '', servicesOffered: '', notes: '', isActive: true,
};

function toForm(k: KVKRecord): FormState {
  return {
    name: k.name, address: k.address, village: k.village || '',
    district: k.district, state: k.state, pincode: k.pincode || '',
    latitude: String(k.latitude), longitude: String(k.longitude),
    phone: k.phone || '', altPhone: k.altPhone || '', email: k.email || '',
    website: k.website || '', officeTimings: k.officeTimings || '',
    servicesOffered: (k.servicesOffered || []).join(', '),
    notes: k.notes || '', isActive: k.isActive,
  };
}

interface Props {
  editing: KVKRecord | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AdminKVKForm({ editing, token, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(editing ? toForm(editing) : EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const validate = (): string => {
    if (!form.name.trim() || !form.address.trim() || !form.district.trim() || !form.state.trim())
      return 'Name, Address, District and State are required.';
    const lat = parseFloat(form.latitude), lng = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lng)) return 'Valid Latitude and Longitude are required.';
    if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
    if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email format.';
    if (form.phone && !/^[+\d\s\-()]{7,20}$/.test(form.phone)) return 'Invalid phone number format.';
    return '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const validErr = validate();
    if (validErr) { setErr(validErr); return; }
    setErr('');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (photo) fd.append('photo', photo);
      if (editing) await updateKVK(token, editing._id, fd);
      else await createKVK(token, fd);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to save KVK');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition';
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">
            {editing ? 'Edit KVK Center' : 'Add New KVK Center'}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition">
            <FaTimes size={16} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {err && (
            <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>KVK Name *</label>
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Krishi Vigyan Kendra, District Name" required />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Full Address *</label>
              <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="Building, Street, Area" required />
            </div>
            <div>
              <label className={labelCls}>Village / Town</label>
              <input className={inputCls} value={form.village} onChange={e => set('village', e.target.value)} placeholder="Village or Town" />
            </div>
            <div>
              <label className={labelCls}>District *</label>
              <input className={inputCls} value={form.district} onChange={e => set('district', e.target.value)} placeholder="District" required />
            </div>
            <div>
              <label className={labelCls}>State *</label>
              <input className={inputCls} value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" required />
            </div>
            <div>
              <label className={labelCls}>Pincode</label>
              <input className={inputCls} value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="000000" maxLength={6} />
            </div>
            <div>
              <label className={labelCls}>Latitude *</label>
              <input className={inputCls} type="number" step="any" value={form.latitude}
                onChange={e => set('latitude', e.target.value)} placeholder="e.g. 26.9124" required />
            </div>
            <div>
              <label className={labelCls}>Longitude *</label>
              <input className={inputCls} type="number" step="any" value={form.longitude}
                onChange={e => set('longitude', e.target.value)} placeholder="e.g. 75.7873" required />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <label className={labelCls}>Alternate Phone</label>
              <input className={inputCls} value={form.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="kvk@example.gov.in" />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://kvk.icar.gov.in" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Office Timings</label>
              <input className={inputCls} value={form.officeTimings} onChange={e => set('officeTimings', e.target.value)}
                placeholder="Mon–Sat: 9:00 AM – 5:00 PM" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Services Offered{' '}
                <span className="normal-case font-normal text-slate-500">(comma separated)</span>
              </label>
              <input className={inputCls} value={form.servicesOffered} onChange={e => set('servicesOffered', e.target.value)}
                placeholder="Soil Testing, Seed Distribution, Training, Crop Advisory" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Any additional information..." />
            </div>
            <div>
              <label className={labelCls}>Photo (optional)</label>
              <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20 transition" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className={`${labelCls} mb-0`}>Active</label>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={`text-2xl transition ${form.isActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                {form.isActive ? <FaToggleOn /> : <FaToggleOff />}
              </button>
              <span className="text-xs text-slate-400">{form.isActive ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={() => handleSubmit()} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition">
            {saving ? <FaSpinner className="animate-spin" size={13} /> : <FaSave size={13} />}
            {saving ? 'Saving...' : editing ? 'Update KVK' : 'Add KVK'}
          </button>
        </div>
      </div>
    </div>
  );
}
