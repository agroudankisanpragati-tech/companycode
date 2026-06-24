'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchCropKnowledge, createCrop, updateCrop, deleteCrop, requestJson } from '@/components/admin/admin-api';
import { StatCard } from '@/components/admin/AdminUi';
import type { CropKnowledge, CropKnowledgeSummary } from '@/components/admin/admin-types';
import { FaLeaf, FaSeedling, FaAppleAlt, FaCarrot, FaDatabase } from 'react-icons/fa';

const EMPTY_FORM: Partial<CropKnowledge> = {
  cropName: '', cropCategory: 'Traditional',
  suitableSoilTypes: [], minPH: 0, maxPH: 0,
  minRainfall: 0, maxRainfall: 0, minTemperature: 0, maxTemperature: 0,
  waterRequirement: 'medium', suitableSeasons: [], suitableIrrigationTypes: [],
  growingDuration: 0, averageYield: 0, averageMarketPrice: 0,
  estimatedProfit: 0, cultivationCost: 0, riskLevel: 'medium',
  description: '', cultivationProcess: '', marketDemand: 'medium',
  farmingTypes: [], fertilizerRequirement: '', fertilizerCost: 0,
  seedRequirement: '', recommendedSeedVariety: '',
};

function toArr(val: string) { return val.split(',').map(s => s.trim()).filter(Boolean); }

export default function CropKnowledgeBasePage() {
  const { token } = useAdmin();
  const [crops, setCrops] = useState<CropKnowledge[]>([]);
  const [summary, setSummary] = useState<CropKnowledgeSummary>({ total: 0, traditional: 0, medicinal: 0, fruit: 0, vegetable: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CropKnowledge>>(EMPTY_FORM);
  const [viewCrop, setViewCrop] = useState<CropKnowledge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // array fields stored as comma strings in the form inputs
  const [soilTypes, setSoilTypes] = useState('');
  const [seasons, setSeasons] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [farmingTypes, setFarmingTypes] = useState('');

  const load = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchCropKnowledge(token, { page, limit: 10, search, category });
      setCrops(res.data);
      setSummary(res.summary);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load crops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [token, search, category]);

  const openAdd = () => {
    setForm(EMPTY_FORM); setSoilTypes(''); setSeasons(''); setIrrigation(''); setFarmingTypes('');
    setEditingId(null); setMessage(''); setError(''); setShowForm(true);
  };

  const openEdit = (crop: CropKnowledge) => {
    setForm(crop);
    setSoilTypes((crop.suitableSoilTypes || []).join(', '));
    setSeasons((crop.suitableSeasons || []).join(', '));
    setIrrigation((crop.suitableIrrigationTypes || []).join(', '));
    setFarmingTypes((crop.farmingTypes || []).join(', '));
    setEditingId(crop._id); setMessage(''); setError(''); setShowForm(true);
    setTimeout(() => document.getElementById('crop-form')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError(''); setMessage('');
    const payload = {
      ...form,
      suitableSoilTypes: toArr(soilTypes),
      suitableSeasons: toArr(seasons),
      suitableIrrigationTypes: toArr(irrigation),
      farmingTypes: toArr(farmingTypes),
    };
    try {
      if (editingId) {
        await updateCrop(token, editingId, payload);
        setMessage('Crop updated successfully.');
      } else {
        await createCrop(token, payload);
        setMessage('Crop added successfully.');
      }
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
      await load(pagination.page);
    } catch (e: any) {
      setError(e.message || 'Failed to save crop');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteCrop(token, id);
      setMessage('Crop deleted successfully.');
      setDeleteConfirm(null);
      await load(pagination.page);
    } catch (e: any) {
      setError(e.message || 'Failed to delete crop');
    }
  };

  const handleStatusChange = async (id: string, status: 'active' | 'disabled' | 'archived') => {
    if (!token) return;
    try {
      await requestJson(`/admin/ai-recommendations/${id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage(`Status updated to ${status}.`);
      await load(pagination.page);
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    }
  };

  const f = (field: keyof CropKnowledge, val: any) => setForm(prev => ({ ...prev, [field]: val }));

  const badge = (level: string) => {
    const map: Record<string, string> = {
      low: 'bg-emerald-400/20 text-emerald-300',
      medium: 'bg-amber-400/20 text-amber-300',
      high: 'bg-red-400/20 text-red-300',
      Traditional: 'bg-cyan-400/20 text-cyan-300',
      Medicinal: 'bg-purple-400/20 text-purple-300',
      Fruit: 'bg-orange-400/20 text-orange-300',
      Vegetable: 'bg-green-400/20 text-green-300',
    };
    return `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[level] || 'bg-slate-400/20 text-slate-300'}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-white">Crop Knowledge Base</h2>
        <p className="mt-1 text-sm text-slate-400">Manage the crop database used by the AI advisory system.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard title="Total Crops" value={summary.total} icon={FaDatabase} accent="from-cyan-500 to-blue-500" />
        <StatCard title="Traditional" value={summary.traditional} icon={FaLeaf} accent="from-amber-400 to-orange-500" />
        <StatCard title="Medicinal" value={summary.medicinal} icon={FaSeedling} accent="from-purple-500 to-violet-500" />
        <StatCard title="Fruit" value={summary.fruit} icon={FaAppleAlt} accent="from-orange-400 to-pink-500" />
        <StatCard title="Vegetable" value={summary.vegetable} icon={FaCarrot} accent="from-emerald-500 to-teal-500" />
      </div>

      {/* Alerts */}
      {message && <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>}
      {error && <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {/* Form */}
      {showForm && (
        <form id="crop-form" onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-5">
          <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Crop' : 'Add New Crop'}</h3>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Crop Name *</span>
              <input className="admin-input w-full" value={form.cropName || ''} onChange={e => f('cropName', e.target.value)} placeholder="e.g. Wheat" required />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Category *</span>
              <select className="admin-input w-full" value={form.cropCategory} onChange={e => f('cropCategory', e.target.value)} required>
                <option value="Traditional">Traditional</option>
                <option value="Medicinal">Medicinal</option>
                <option value="Fruit">Fruit</option>
                <option value="Vegetable">Vegetable</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Suitable Soil Types (comma separated)</span>
              <input className="admin-input w-full" value={soilTypes} onChange={e => setSoilTypes(e.target.value)} placeholder="Loamy, Sandy, Clay" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {([['minPH', 'Min pH'], ['maxPH', 'Max pH'], ['minRainfall', 'Min Rainfall (mm)'], ['maxRainfall', 'Max Rainfall (mm)'], ['minTemperature', 'Min Temp (°C)'], ['maxTemperature', 'Max Temp (°C)']] as [keyof CropKnowledge, string][]).map(([key, label]) => (
              <label key={key} className="space-y-1.5 text-sm text-slate-300">
                <span>{label} *</span>
                <input className="admin-input w-full" type="number" step="any" value={(form[key] as number) ?? 0} onChange={e => f(key, parseFloat(e.target.value) || 0)} required />
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Water Requirement *</span>
              <select className="admin-input w-full" value={form.waterRequirement} onChange={e => f('waterRequirement', e.target.value)} required>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Risk Level *</span>
              <select className="admin-input w-full" value={form.riskLevel} onChange={e => f('riskLevel', e.target.value)} required>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Market Demand</span>
              <select className="admin-input w-full" value={form.marketDemand} onChange={e => f('marketDemand', e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Suitable Seasons (comma separated)</span>
              <input className="admin-input w-full" value={seasons} onChange={e => setSeasons(e.target.value)} placeholder="Kharif, Rabi, Zaid" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Irrigation Types (comma separated)</span>
              <input className="admin-input w-full" value={irrigation} onChange={e => setIrrigation(e.target.value)} placeholder="Drip, Flood, Sprinkler" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Farming Types (comma separated)</span>
              <input className="admin-input w-full" value={farmingTypes} onChange={e => setFarmingTypes(e.target.value)} placeholder="Organic, Conventional" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([['growingDuration', 'Growing Duration (days)', 1], ['averageYield', 'Avg Yield (q/ha)', 0.1], ['averageMarketPrice', 'Avg Market Price (₹/q)', 0.1], ['cultivationCost', 'Cultivation Cost (₹/ha)', 0.1]] as [keyof CropKnowledge, string, number][]).map(([key, label, step]) => (
              <label key={key} className="space-y-1.5 text-sm text-slate-300">
                <span>{label} *</span>
                <input className="admin-input w-full" type="number" step={step} value={(form[key] as number) ?? 0} onChange={e => f(key, parseFloat(e.target.value) || 0)} required />
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Estimated Profit (₹/ha) *</span>
              <input className="admin-input w-full" type="number" step="0.1" value={form.estimatedProfit ?? 0} onChange={e => f('estimatedProfit', parseFloat(e.target.value) || 0)} required />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Fertilizer Cost (₹/ha)</span>
              <input className="admin-input w-full" type="number" step="0.1" value={form.fertilizerCost ?? 0} onChange={e => f('fertilizerCost', parseFloat(e.target.value) || 0)} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Fertilizer Requirement</span>
              <input className="admin-input w-full" value={form.fertilizerRequirement || ''} onChange={e => f('fertilizerRequirement', e.target.value)} placeholder="NPK 120:60:40 kg/ha" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Seed Requirement</span>
              <input className="admin-input w-full" value={form.seedRequirement || ''} onChange={e => f('seedRequirement', e.target.value)} placeholder="e.g. 20 kg/ha" />
            </label>
          </div>

          <label className="space-y-1.5 text-sm text-slate-300">
            <span>Recommended Seed Variety</span>
            <input className="admin-input w-full" value={form.recommendedSeedVariety || ''} onChange={e => f('recommendedSeedVariety', e.target.value)} placeholder="e.g. HD-2967, PBW-343" />
          </label>

          <label className="space-y-1.5 text-sm text-slate-300">
            <span>Description *</span>
            <textarea className="admin-input min-h-[100px] w-full resize-none" value={form.description || ''} onChange={e => f('description', e.target.value)} placeholder="Crop overview and key characteristics..." required />
          </label>

          <label className="space-y-1.5 text-sm text-slate-300">
            <span>Cultivation Process *</span>
            <textarea className="admin-input min-h-[120px] w-full resize-none" value={form.cultivationProcess || ''} onChange={e => f('cultivationProcess', e.target.value)} placeholder="Step-by-step cultivation guide..." required />
          </label>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="admin-button-secondary px-6 py-2.5">Cancel</button>
            <button type="submit" disabled={submitting} className="admin-button-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Saving...' : editingId ? 'Update Crop' : 'Add Crop'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">All Crops</h3>
            <p className="mt-0.5 text-sm text-slate-400">{pagination.total} total records</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              className="admin-input w-48"
              placeholder="Search crop name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="admin-input w-40" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Traditional">Traditional</option>
              <option value="Medicinal">Medicinal</option>
              <option value="Fruit">Fruit</option>
              <option value="Vegetable">Vegetable</option>
            </select>
            {!showForm && (
              <button onClick={openAdd} className="admin-button-primary px-5 py-2">+ Add Crop</button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading crops...</p>
        ) : crops.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No crops found. Add your first crop.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Crop Name</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Seasons / Region</th>
                  <th className="pb-3 pr-4">Market Price</th>
                  <th className="pb-3 pr-4">Risk</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {crops.map(crop => (
                  <tr key={crop._id} className="group hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white">{crop.cropName}</td>
                    <td className="py-3 pr-4"><span className={badge(crop.cropCategory)}>{crop.cropCategory}</span></td>
                    <td className="py-3 pr-4">
                      <span className={crop.sourceType === 'AI'
                        ? 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-400/20 text-purple-300'
                        : 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-400/20 text-slate-300'}>
                        {crop.sourceType === 'AI' ? '🤖 AI' : '📋 Manual'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {(crop.suitableSeasons || []).join(', ') || (crop.season ? `${crop.season}${crop.district ? ` · ${crop.district}` : ''}` : '—')}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{crop.averageMarketPrice ? `₹${crop.averageMarketPrice}/q` : (crop.marketPrice ? `₹${crop.marketPrice}/q` : '—')}</td>
                    <td className="py-3 pr-4"><span className={badge(crop.riskLevel)}>{crop.riskLevel}</span></td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        !crop.status || crop.status === 'active' ? 'bg-emerald-400/20 text-emerald-300' :
                        crop.status === 'disabled' ? 'bg-red-400/20 text-red-300' :
                        'bg-slate-400/20 text-slate-300'
                      }`}>{crop.status || 'active'}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setViewCrop(crop)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-blue-300 transition-colors" title="View">👁</button>
                        <button onClick={() => openEdit(crop)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-300 transition-colors" title="Edit">✏️</button>
                        {crop.sourceType === 'AI' && crop.status !== 'disabled' && (
                          <button onClick={() => handleStatusChange(crop._id, 'disabled')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-orange-300 transition-colors" title="Disable">🚫</button>
                        )}
                        {crop.sourceType === 'AI' && crop.status === 'disabled' && (
                          <button onClick={() => handleStatusChange(crop._id, 'active')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-emerald-300 transition-colors" title="Activate">✅</button>
                        )}
                        <button onClick={() => setDeleteConfirm({ id: crop._id, name: crop.cropName })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400 transition-colors" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="admin-button-secondary px-3 py-1.5 disabled:opacity-40">← Prev</button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)} className="admin-button-secondary px-3 py-1.5 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </section>

      {/* View Detail Modal */}
      {viewCrop && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{viewCrop.cropName}</h3>
                <div className="mt-1 flex gap-2 flex-wrap">
                  <span className={badge(viewCrop.cropCategory)}>{viewCrop.cropCategory}</span>
                  {viewCrop.sourceType === 'AI' && (
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-400/20 text-purple-300">
                      🤖 AI Generated
                    </span>
                  )}
                  {viewCrop.status && viewCrop.status !== 'active' && (
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-400/20 text-red-300 capitalize">
                      {viewCrop.status}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setViewCrop(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <p>{viewCrop.description}</p>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
                {[
                  ['pH Range', `${viewCrop.minPH} – ${viewCrop.maxPH}`],
                  ['Rainfall', `${viewCrop.minRainfall}–${viewCrop.maxRainfall} mm`],
                  ['Temperature', `${viewCrop.minTemperature}–${viewCrop.maxTemperature}°C`],
                  ['Water Req.', viewCrop.waterRequirement],
                  ['Duration', `${viewCrop.growingDuration} days`],
                  ['Avg Yield', `${viewCrop.averageYield} q/ha`],
                  ['Market Price', `₹${viewCrop.averageMarketPrice}/q`],
                  ['Cultivation Cost', `₹${viewCrop.cultivationCost}/ha`],
                  ['Est. Profit', `₹${viewCrop.estimatedProfit}/ha`],
                  ['Risk Level', viewCrop.riskLevel],
                  ['Market Demand', viewCrop.marketDemand],
                  ['Fertilizer Cost', viewCrop.fertilizerCost ? `₹${viewCrop.fertilizerCost}` : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="font-semibold text-white capitalize">{val}</p>
                  </div>
                ))}
              </div>
              {viewCrop.sourceType === 'AI' && viewCrop.aiRecommendation && (
                <div>
                  <p className="mb-1 text-slate-500">AI Recommendation:</p>
                  <p className="whitespace-pre-line rounded-xl bg-white/5 p-3">{viewCrop.aiRecommendation}</p>
                </div>
              )}
              {viewCrop.sourceType === 'AI' && (viewCrop.district || viewCrop.state) && (
                <p><span className="text-slate-500">Location:</span> {[viewCrop.district, viewCrop.state].filter(Boolean).join(', ')}</p>
              )}
              {viewCrop.suitableSeasons?.length > 0 && <p><span className="text-slate-500">Seasons:</span> {viewCrop.suitableSeasons.join(', ')}</p>}
              {viewCrop.suitableSoilTypes?.length > 0 && <p><span className="text-slate-500">Soil Types:</span> {viewCrop.suitableSoilTypes.join(', ')}</p>}
              {viewCrop.suitableIrrigationTypes?.length > 0 && <p><span className="text-slate-500">Irrigation:</span> {viewCrop.suitableIrrigationTypes.join(', ')}</p>}
              {viewCrop.fertilizerRequirement && <p><span className="text-slate-500">Fertilizer:</span> {viewCrop.fertilizerRequirement}</p>}
              {viewCrop.seedRequirement && <p><span className="text-slate-500">Seed Req.:</span> {viewCrop.seedRequirement}</p>}
              {viewCrop.recommendedSeedVariety && <p><span className="text-slate-500">Seed Variety:</span> {viewCrop.recommendedSeedVariety}</p>}
              {viewCrop.cultivationProcess && (
                <div>
                  <p className="mb-1 text-slate-500">Cultivation Process:</p>
                  <p className="whitespace-pre-line rounded-xl bg-white/5 p-3">{viewCrop.cultivationProcess}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setViewCrop(null); openEdit(viewCrop); }} className="admin-button-secondary flex-1 py-2">Edit Crop</button>
              <button onClick={() => setViewCrop(null)} className="admin-button-primary flex-1 py-2">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-bold text-white">Delete Crop?</h3>
            <p className="mt-3 text-sm text-slate-300">Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="admin-button-secondary flex-1 py-2">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-red-200 transition-colors hover:bg-red-500/30">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
