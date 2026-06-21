'use client';
import { FaChartLine, FaArrowUp, FaArrowDown, FaSpinner } from 'react-icons/fa';
import { useMarketPrice } from '@/services/useMarketPrice';
import { SUPPORTED_CROPS } from '@/services/marketPrice';
import { useState } from 'react';

export default function MarketSnapshotCard({ onViewPrices }: { onViewPrices?: () => void }) {
  const { preference, price, history, locationMissing, loading, error, selectCrop, saveLocation } = useMarketPrice();
  const [locForm, setLocForm] = useState({ state: '', district: '' });
  const [saving, setSaving] = useState(false);

  // Price change vs yesterday
  const yesterday = history.length >= 2 ? history[history.length - 2] : null;
  const changePercent =
    price && yesterday && yesterday.modalPrice > 0
      ? ((price.modalPrice - yesterday.modalPrice) / yesterday.modalPrice) * 100
      : null;
  const isUp = changePercent === null || changePercent >= 0;

  async function handleSaveLocation() {
    if (!locForm.state.trim() || !locForm.district.trim()) return;
    setSaving(true);
    await saveLocation(locForm.state.trim(), locForm.district.trim());
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <FaSpinner className="animate-spin text-2xl text-rose-400" />
      </div>
    );
  }

  if (locationMissing) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 px-1">
        <p className="text-xs text-slate-500">Select location to get live mandi prices.</p>
        <input
          placeholder="State (e.g. Rajasthan)"
          value={locForm.state}
          onChange={(e) => setLocForm((f) => ({ ...f, state: e.target.value }))}
          className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
        />
        <input
          placeholder="District (e.g. Jaipur)"
          value={locForm.district}
          onChange={(e) => setLocForm((f) => ({ ...f, district: e.target.value }))}
          className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
        />
        <button
          onClick={handleSaveLocation}
          disabled={saving || !locForm.state || !locForm.district}
          className="rounded-lg bg-rose-500 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Fetch'}
        </button>
      </div>
    );
  }

  if (error || !price) {
    return (
      <div className="flex h-full flex-col justify-center gap-2">
        <p className="text-xs text-red-500 break-words">{error || 'No mandi data available.'}</p>
        {error && (
          <button
            onClick={() => window.location.reload()}
            className="self-start rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between">
      {/* Crop selector */}
      <div className="flex items-center gap-2">
        <FaChartLine className="text-rose-500" />
        <select
          value={preference?.selectedCrop || 'Wheat'}
          onChange={(e) => selectCrop(e.target.value)}
          className="flex-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {SUPPORTED_CROPS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div className="text-center">
        <div className="text-4xl font-extrabold tracking-tight text-slate-800">
          ₹{price.modalPrice.toLocaleString('en-IN')}
        </div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          per Quintal
        </div>
      </div>

      {/* Change */}
      <div className="flex items-center justify-center gap-1 text-sm font-semibold">
        {isUp ? <FaArrowUp className="text-emerald-600" /> : <FaArrowDown className="text-red-500" />}
        <span className={isUp ? 'text-emerald-600' : 'text-red-500'}>
          {changePercent !== null ? `${Math.abs(changePercent).toFixed(1)}% from yesterday` : 'No prev. data'}
        </span>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400">
        {price.market} · {price.district}, {price.state}
      </div>

      <button
        onClick={onViewPrices}
        className="w-full -mx-4 flex items-center justify-between gap-2 border-t border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 rounded-b-2xl"
      >
        <span>View prices</span>
        <span className="text-slate-400">›</span>
      </button>
    </div>
  );
}
