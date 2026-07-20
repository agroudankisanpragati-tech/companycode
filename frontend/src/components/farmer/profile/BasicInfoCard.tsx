'use client';

import { useState } from 'react';
import {
  FaUser, FaPhone, FaEnvelope, FaVenusMars, FaCalendarAlt,
  FaTractor, FaIdCard, FaShieldAlt, FaGlobe, FaCheck,
} from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import { saveFullProfile } from '@/services/farmerProfile';
import { FARMER_CATEGORIES, GENDERS, LANGUAGES, type FullProfile } from './types';

interface Props {
  profile: FullProfile;
  onSaved: (updated: FullProfile) => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';
const readonlyCls =
  'w-full rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 cursor-not-allowed';

function Field({
  label, icon, children, span2 = false,
}: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; span2?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${span2 ? 'sm:col-span-2' : ''}`}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}

export default function BasicInfoCard({ profile, onSaved, onToast }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile.user.name || '',
    phone: profile.user.phone || '',
    gender: profile.ext.gender || '',
    dateOfBirth: profile.ext.dateOfBirth || '',
    farmingType: profile.ext.farmingType || '',
    languagePreference: profile.ext.languagePreference || '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await saveFullProfile({
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        farmingType: form.farmingType,
        languagePreference: form.languagePreference,
      });
      onSaved(updated);
      onToast('Profile saved successfully!', 'success');
    } catch (e: any) {
      onToast(e.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <FaUser size={14} />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">Personal Information</div>
          <div className="text-xs text-gray-400">Your basic profile details</div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" icon={<FaUser size={11} />}>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your full name"
              className={inputCls}
            />
          </Field>

          <Field label="Mobile Number" icon={<FaPhone size={11} />}>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className={inputCls}
            />
          </Field>

          <Field label="Email Address" icon={<FaEnvelope size={11} />} span2>
            <div className="relative">
              <input value={profile.user.email || ''} readOnly className={readonlyCls} />
              <MdVerified className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
            </div>
          </Field>

          <Field label="Gender" icon={<FaVenusMars size={11} />}>
            <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
              <option value="">Select Gender</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>

          <Field label="Date of Birth" icon={<FaCalendarAlt size={11} />}>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={e => set('dateOfBirth', e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Farmer Category" icon={<FaTractor size={11} />}>
            <select value={form.farmingType} onChange={e => set('farmingType', e.target.value)} className={inputCls}>
              <option value="">Select Category</option>
              {FARMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Preferred Language" icon={<FaGlobe size={11} />}>
            <select value={form.languagePreference} onChange={e => set('languagePreference', e.target.value)} className={inputCls}>
              <option value="">Select Language</option>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.label}>{l.label} — {l.native}</option>
              ))}
            </select>
          </Field>

          <Field label="Aadhaar Status" icon={<FaIdCard size={11} />}>
            <div className="relative">
              <input value="XXXX XXXX XXXX" readOnly className={readonlyCls} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <FaShieldAlt size={11} /> Verified
              </div>
            </div>
          </Field>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-6 py-2.5 text-sm font-semibold text-white transition shadow-sm shadow-emerald-200 hover:-translate-y-0.5"
          >
            {saving
              ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <FaCheck size={12} />
            }
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
