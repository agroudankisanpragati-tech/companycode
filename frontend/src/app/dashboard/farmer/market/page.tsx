'use client';

import { useMarketPrice } from '@/services/useMarketPrice';
import { SUPPORTED_CROPS } from '@/services/marketPrice';
import { useState } from 'react';
import Link from 'next/link';
import { FaSpinner, FaArrowUp, FaArrowDown, FaSync } from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';

function MarketContent() {
  const { preference, price, history, locationMissing, loading, error, selectCrop, saveLocation, refresh } = useMarketPrice();
  const [locForm, setLocForm] = useState({ state: '', district: '' });
  const [saving, setSaving] = useState(false);

  const yesterday = history.length >= 2 ? history[history.length - 2] : null;
  const changePercent =
    price && yesterday && yesterday.modalPrice > 0
      ? ((price.modalPrice - yesterday.modalPrice) / yesterday.modalPrice) * 100
      : null;
  const isUp = changePercent === null || changePercent >= 0;

  async function handleSave() {
    if (!locForm.state.trim() || !locForm.district.trim()) return;
    setSaving(true);
    await saveLocation(locForm.state.trim(), locForm.district.trim());
    setSaving(false);
  }

  const maxModal = history.length ? Math.max(...history.map((h) => h.modalPrice)) : 1;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Market Price</h1>
            <p className="text-xs text-slate-500">Live Government Mandi Data · Auto-refreshes every 24h</p>
          </div>
          <button
            onClick={() => refresh()}
            className="flex items-center gap-2 rounded-lg border border-emerald-500 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
          >
            <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Crop Selector */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Select Crop</label>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_CROPS.map((c) => (
              <button
                key={c}
                onClick={() => selectCrop(c)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  preference?.selectedCrop === c
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {preference?.selectedCrop && (
            <p className="mt-2 text-xs text-slate-400">
              Selected: <span className="font-semibold text-slate-600">{preference.selectedCrop}</span>
              {' '}· Saved until you change it or logout.
            </p>
          )}
        </div>

        {/* Location Missing */}
        {locationMissing && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <p className="text-sm text-amber-800 font-medium">Please select your location to get mandi prices.</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="State (e.g. Rajasthan)"
                value={locForm.state}
                onChange={(e) => setLocForm((f) => ({ ...f, state: e.target.value }))}
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <input
                placeholder="District (e.g. Jaipur)"
                value={locForm.district}
                onChange={(e) => setLocForm((f) => ({ ...f, district: e.target.value }))}
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !locForm.state || !locForm.district}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Location & Fetch Prices'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <FaSpinner className="animate-spin text-3xl text-emerald-500" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-700">Failed to load mandi data</p>
            <p className="text-xs text-red-600 break-words">{error}</p>
            <button
              onClick={() => refresh()}
              className="mt-1 rounded-lg bg-red-100 border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Current Price Card */}
        {!loading && !locationMissing && price && (
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Price</div>
                <div className="mt-1 text-4xl font-extrabold text-slate-800">
                  ₹{price.modalPrice.toLocaleString('en-IN')}
                </div>
                <div className="text-sm font-medium text-slate-500">per Quintal · {price.commodity}</div>
              </div>
              <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {isUp ? <FaArrowUp /> : <FaArrowDown />}
                {changePercent !== null ? `${Math.abs(changePercent).toFixed(1)}%` : '—'}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Min Price', value: `₹${price.minPrice.toLocaleString('en-IN')}` },
                { label: 'Modal Price', value: `₹${price.modalPrice.toLocaleString('en-IN')}` },
                { label: 'Max Price', value: `₹${price.maxPrice.toLocaleString('en-IN')}` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3 text-center">
                  <div className="text-xs text-slate-400">{item.label}</div>
                  <div className="text-base font-bold text-slate-800">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
              <div><span className="font-medium">Market:</span> {price.market}</div>
              <div><span className="font-medium">District:</span> {price.district}</div>
              <div><span className="font-medium">State:</span> {price.state}</div>
              <div><span className="font-medium">Arrival:</span> {price.arrivalDate}</div>
            </div>

            {price.searchLevel !== 'district' && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                ℹ️ Showing {price.searchLevel === 'state' ? 'state-level' : 'pan-India'} data (no data found in your district).
              </div>
            )}
          </div>
        )}

        {/* Price Trend Chart */}
        {history.length > 1 && (
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Price Trend · {preference?.selectedCrop} (last {history.length} days)
            </h2>
            <div className="flex items-end gap-1 h-32">
              {history.map((h, i) => {
                const heightPct = maxModal > 0 ? (h.modalPrice / maxModal) * 100 : 0;
                const isLatest = i === history.length - 1;
                return (
                  <div key={i} className="flex flex-col items-center flex-1 gap-1 group relative">
                    <div
                      className={`w-full rounded-t-sm transition-all ${isLatest ? 'bg-emerald-500' : 'bg-emerald-200 group-hover:bg-emerald-400'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      ₹{h.modalPrice.toLocaleString('en-IN')} · {h.date}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate w-full text-center">
                      {h.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Min: ₹{Math.min(...history.map((h) => h.modalPrice)).toLocaleString('en-IN')} ·
              Max: ₹{Math.max(...history.map((h) => h.modalPrice)).toLocaleString('en-IN')}
            </div>
          </div>
        )}

        {/* History Table */}
        {history.length > 0 && (
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-slate-700">Price History (last 20 days)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-right">Min</th>
                    <th className="px-4 py-2 text-right">Modal</th>
                    <th className="px-4 py-2 text-right">Max</th>
                    <th className="px-4 py-2 text-left">Market</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...history].reverse().map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-slate-600">{h.date}</td>
                      <td className="px-4 py-2 text-right text-slate-700">₹{h.minPrice.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">₹{h.modalPrice.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right text-slate-700">₹{h.maxPrice.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{h.market}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-2">
          <Link href="/dashboard/farmer" className="text-sm text-emerald-600">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function MarketPage() {
  return <ProtectedRoute><MarketContent /></ProtectedRoute>;
}
