'use client';

import { useState } from 'react';
import { CropRecommendationRequest } from '@/services/cropRecommendation';

interface FarmerInputFormProps {
  onSubmit: (data: CropRecommendationRequest) => void;
  loading: boolean;
  prefill?: Partial<CropRecommendationRequest>;
  prefillBanner?: string;
}

const soilTypes = ['Loamy', 'Sandy', 'Sandy Loam', 'Clay', 'Clay Loam', 'Black', 'Red', 'Alluvial', 'Laterite'];
const irrigationTypes = ['Drip', 'Sprinkler', 'Flood', 'Canal', 'Borewell', 'Rainfed'];
const seasons = ['Kharif', 'Rabi', 'Zaid', 'Year-round'];
const farmingTypes = ['conventional', 'organic', 'mixed'];
const areaUnits = ['acre', 'bigha', 'hectare'];

const indianStates = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const defaultForm: CropRecommendationRequest = {
  farmArea: 1, areaUnit: 'acre', state: '', district: '', village: '',
  soilType: '', soilPH: 7, organicCarbon: undefined, nitrogen: undefined,
  phosphorus: undefined, potassium: undefined, ecValue: undefined,
  waterAvailability: 'medium', irrigationType: '', rainfall: undefined,
  averageTemperature: undefined, season: '', farmingType: 'conventional',
  budget: 50000, previousCrop: '', preferredCrop: '',
};

export default function FarmerInputForm({ onSubmit, loading, prefill, prefillBanner }: FarmerInputFormProps) {
  const [form, setForm] = useState<CropRecommendationRequest>({ ...defaultForm, ...prefill });
  const [errors, setErrors] = useState<Partial<Record<keyof CropRecommendationRequest, string>>>({});

  const set = (key: keyof CropRecommendationRequest, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.farmArea || form.farmArea <= 0) e.farmArea = 'Required';
    if (!form.state) e.state = 'Required';
    if (!form.district) e.district = 'Required';
    if (!form.soilType) e.soilType = 'Required';
    if (!form.soilPH || form.soilPH < 0 || form.soilPH > 14) e.soilPH = 'Enter valid pH (0-14)';
    if (!form.waterAvailability) e.waterAvailability = 'Required';
    if (!form.irrigationType) e.irrigationType = 'Required';
    if (!form.season) e.season = 'Required';
    if (!form.budget || form.budget <= 0) e.budget = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {prefillBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700 flex items-center gap-2">
          🌱 {prefillBanner}
        </div>
      )}
      {/* Farm Details */}
      <Section title="🌾 Farm Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Farm Area *" error={errors.farmArea}>
            <input type="number" min={0.1} step={0.1} value={form.farmArea}
              onChange={(e) => set('farmArea', parseFloat(e.target.value))}
              className={inputCls(errors.farmArea)} placeholder="e.g. 2.5" />
          </Field>
          <Field label="Unit">
            <select value={form.areaUnit} onChange={(e) => set('areaUnit', e.target.value)} className={inputCls()}>
              {areaUnits.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Budget (₹) *" error={errors.budget}>
            <input type="number" min={1000} value={form.budget}
              onChange={(e) => set('budget', parseInt(e.target.value))}
              className={inputCls(errors.budget)} placeholder="e.g. 50000" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="State *" error={errors.state}>
            <select value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls(errors.state)}>
              <option value="">Select State</option>
              {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="District *" error={errors.district}>
            <input value={form.district} onChange={(e) => set('district', e.target.value)}
              className={inputCls(errors.district)} placeholder="e.g. Jaipur" />
          </Field>
          <Field label="Village">
            <input value={form.village || ''} onChange={(e) => set('village', e.target.value)}
              className={inputCls()} placeholder="Optional" />
          </Field>
        </div>
      </Section>

      {/* Soil Info */}
      <Section title="🪨 Soil Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Soil Type *" error={errors.soilType}>
            <select value={form.soilType} onChange={(e) => set('soilType', e.target.value)} className={inputCls(errors.soilType)}>
              <option value="">Select Soil Type</option>
              {soilTypes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Soil pH *" error={errors.soilPH}>
            <input type="number" min={0} max={14} step={0.1} value={form.soilPH}
              onChange={(e) => set('soilPH', parseFloat(e.target.value))}
              className={inputCls(errors.soilPH)} placeholder="e.g. 6.5" />
          </Field>
          <Field label="Organic Carbon (%)">
            <input type="number" min={0} step={0.01} value={form.organicCarbon ?? ''}
              onChange={(e) => set('organicCarbon', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
          <Field label="Nitrogen (kg/acre)">
            <input type="number" min={0} value={form.nitrogen ?? ''}
              onChange={(e) => set('nitrogen', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
          <Field label="Phosphorus (kg/acre)">
            <input type="number" min={0} value={form.phosphorus ?? ''}
              onChange={(e) => set('phosphorus', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
          <Field label="Potassium (kg/acre)">
            <input type="number" min={0} value={form.potassium ?? ''}
              onChange={(e) => set('potassium', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
        </div>
      </Section>

      {/* Water & Climate */}
      <Section title="💧 Water & Climate">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Water Availability *" error={errors.waterAvailability}>
            <select value={form.waterAvailability} onChange={(e) => set('waterAvailability', e.target.value)} className={inputCls(errors.waterAvailability)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Irrigation Type *" error={errors.irrigationType}>
            <select value={form.irrigationType} onChange={(e) => set('irrigationType', e.target.value)} className={inputCls(errors.irrigationType)}>
              <option value="">Select Type</option>
              {irrigationTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Annual Rainfall (mm)">
            <input type="number" min={0} value={form.rainfall ?? ''}
              onChange={(e) => set('rainfall', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
          <Field label="Avg. Temperature (°C)">
            <input type="number" min={0} max={60} value={form.averageTemperature ?? ''}
              onChange={(e) => set('averageTemperature', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputCls()} placeholder="Optional" />
          </Field>
        </div>
      </Section>

      {/* Farming Preferences */}
      <Section title="🌱 Farming Preferences">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Season *" error={errors.season}>
            <select value={form.season} onChange={(e) => set('season', e.target.value)} className={inputCls(errors.season)}>
              <option value="">Select Season</option>
              {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Farming Type">
            <select value={form.farmingType} onChange={(e) => set('farmingType', e.target.value)} className={inputCls()}>
              {farmingTypes.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Previous Crop">
            <input value={form.previousCrop || ''} onChange={(e) => set('previousCrop', e.target.value)}
              className={inputCls()} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Preferred Crop (Optional)">
          <input value={form.preferredCrop || ''} onChange={(e) => set('preferredCrop', e.target.value)}
            className={inputCls()} placeholder="e.g. Wheat, Ashwagandha..." />
        </Field>
      </Section>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analyzing your farm conditions...
          </span>
        ) : '🌾 Get AI Crop Recommendations'}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(error?: string) {
  return `w-full rounded-xl border px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-300 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
  }`;
}
