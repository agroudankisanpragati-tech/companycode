'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchDiseaseRecords, createDiseaseRecord, updateDiseaseRecord, deleteDiseaseRecord } from '@/components/admin/admin-api';
import { StatCard } from '@/components/admin/AdminUi';
import type { DiseaseRecord, DiseaseKnowledgeSummary } from '@/components/admin/admin-types';
import { FaMicroscope, FaLeaf, FaSeedling, FaDatabase, FaImages } from 'react-icons/fa';

const ASSET_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000')
    : 'http://localhost:4000';

const EMPTY: Partial<DiseaseRecord> = {
  cropName: '', scientificName: '', cropCategory: '',
  diseaseName: '', diseaseType: '', severityLevel: 'medium',
  description: '',
  leafSymptoms: '', stemSymptoms: '', rootSymptoms: '', fruitSymptoms: '',
  symptomsDescription: '', organicTreatment: '', chemicalTreatment: '',
  recommendedProducts: '', treatmentDescription: '',
  preventionMethods: '', preventionDescription: '',
};

const sevBadge = (s: string) => {
  const m: Record<string, string> = {
    critical: 'bg-red-400/20 text-red-300',
    high: 'bg-orange-400/20 text-orange-300',
    medium: 'bg-amber-400/20 text-amber-300',
    low: 'bg-green-400/20 text-green-300',
  };
  return `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${m[s] || 'bg-slate-400/20 text-slate-300'}`;
};

export default function DiseaseKnowledgeBasePage() {
  const { token } = useAdmin();
  const [records, setRecords] = useState<DiseaseRecord[]>([]);
  const [summary, setSummary] = useState<DiseaseKnowledgeSummary>({
    totalRecords: 0, totalCrops: 0, totalDiseaseImages: 0,
    totalHealthyImages: 0, totalRecommendations: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DiseaseRecord>>(EMPTY);
  const [viewRecord, setViewRecord] = useState<DiseaseRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const diseaseImgRef = useRef<HTMLInputElement>(null);
  const healthyImgRef = useRef<HTMLInputElement>(null);

  const load = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchDiseaseRecords(token, { page, limit: 10, search });
      setRecords(res.data);
      setSummary(res.summary);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [token, search]);

  const f = (k: keyof DiseaseRecord, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setForm(EMPTY); setEditingId(null);
    setMessage(''); setError(''); setShowForm(true);
  };

  const openEdit = (r: DiseaseRecord) => {
    setForm(r); setEditingId(r._id);
    setMessage(''); setError(''); setShowForm(true);
    setTimeout(() => document.getElementById('disease-form')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError(''); setMessage('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null && !Array.isArray(v)) fd.append(k, String(v));
      });
      const dImgs = diseaseImgRef.current?.files;
      const hImgs = healthyImgRef.current?.files;
      if (dImgs) Array.from(dImgs).forEach(fi => fd.append('diseaseImages', fi));
      if (hImgs) Array.from(hImgs).forEach(fi => fd.append('healthyImages', fi));

      if (editingId) {
        await updateDiseaseRecord(token, editingId, fd);
        setMessage('Record updated successfully.');
      } else {
        await createDiseaseRecord(token, fd);
        setMessage('Disease record created successfully.');
      }
      setShowForm(false); setEditingId(null); setForm(EMPTY);
      await load(pagination.page);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteDiseaseRecord(token, id);
      setMessage('Record deleted.'); setDeleteConfirm(null);
      await load(pagination.page);
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-white">Disease Knowledge Base</h2>
        <p className="mt-1 text-sm text-slate-400">Master disease dataset used by the AI Disease Detection engine.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard title="Total Records" value={summary.totalRecords} icon={FaDatabase} accent="from-cyan-500 to-blue-500" />
        <StatCard title="Crops Covered" value={summary.totalCrops} icon={FaLeaf} accent="from-emerald-500 to-teal-500" />
        <StatCard title="Disease Images" value={summary.totalDiseaseImages} icon={FaImages} accent="from-rose-500 to-pink-500" />
        <StatCard title="Healthy Images" value={summary.totalHealthyImages} icon={FaSeedling} accent="from-green-500 to-lime-500" />
        <StatCard title="Total Scans" value={summary.totalRecommendations} icon={FaMicroscope} accent="from-purple-500 to-violet-500" />
      </div>

      {message && <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>}
      {error && <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {/* Form */}
      {showForm && (
        <form id="disease-form" onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-5">
          <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Disease Record' : 'Add Disease Record'}</h3>

          {/* Crop Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Crop Name *</span>
              <input className="admin-input w-full" value={form.cropName || ''} onChange={e => f('cropName', e.target.value)} placeholder="e.g. Rice" required />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Scientific Name</span>
              <input className="admin-input w-full" value={form.scientificName || ''} onChange={e => f('scientificName', e.target.value)} placeholder="e.g. Oryza sativa" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Crop Category *</span>
              <input className="admin-input w-full" value={form.cropCategory || ''} onChange={e => f('cropCategory', e.target.value)} placeholder="Cereal / Vegetable / Fruit" required />
            </label>
          </div>

          {/* Disease Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Disease Name *</span>
              <input className="admin-input w-full" value={form.diseaseName || ''} onChange={e => f('diseaseName', e.target.value)} placeholder="e.g. Rice Blast" required />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Disease Type *</span>
              <input className="admin-input w-full" value={form.diseaseType || ''} onChange={e => f('diseaseType', e.target.value)} placeholder="Fungal / Bacterial / Viral / Pest" required />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Severity Level *</span>
              <select className="admin-input w-full" value={form.severityLevel} onChange={e => f('severityLevel', e.target.value)} required>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5 text-sm text-slate-300">
            <span>Description *</span>
            <textarea className="admin-input min-h-[100px] w-full resize-none" value={form.description || ''} onChange={e => f('description', e.target.value)} placeholder="Comprehensive disease overview..." required />
          </label>

          {/* Symptoms */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-300">🔍 Symptoms</p>
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ['leafSymptoms', 'Leaf Symptoms'],
                ['stemSymptoms', 'Stem Symptoms'],
                ['rootSymptoms', 'Root Symptoms'],
                ['fruitSymptoms', 'Fruit Symptoms'],
              ] as [keyof DiseaseRecord, string][]).map(([k, l]) => (
                <label key={k} className="space-y-1.5 text-sm text-slate-300">
                  <span>{l}</span>
                  <input className="admin-input w-full" value={(form[k] as string) || ''} onChange={e => f(k, e.target.value)} placeholder={`${l}...`} />
                </label>
              ))}
            </div>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Symptoms Description</span>
              <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.symptomsDescription || ''} onChange={e => f('symptomsDescription', e.target.value)} placeholder="Detailed symptoms..." />
            </label>
          </div>

          {/* Treatment */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-300">💊 Treatment</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm text-slate-300">
                <span>Organic Treatment</span>
                <input className="admin-input w-full" value={form.organicTreatment || ''} onChange={e => f('organicTreatment', e.target.value)} placeholder="Neem oil, biopesticides..." />
              </label>
              <label className="space-y-1.5 text-sm text-slate-300">
                <span>Chemical Treatment</span>
                <input className="admin-input w-full" value={form.chemicalTreatment || ''} onChange={e => f('chemicalTreatment', e.target.value)} placeholder="Fungicide, bactericide..." />
              </label>
            </div>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Recommended Products</span>
              <input className="admin-input w-full" value={form.recommendedProducts || ''} onChange={e => f('recommendedProducts', e.target.value)} placeholder="Product names..." />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Treatment Description</span>
              <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.treatmentDescription || ''} onChange={e => f('treatmentDescription', e.target.value)} placeholder="Step-by-step treatment guide..." />
            </label>
          </div>

          {/* Prevention */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-green-300">🛡️ Prevention</p>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Prevention Methods</span>
              <input className="admin-input w-full" value={form.preventionMethods || ''} onChange={e => f('preventionMethods', e.target.value)} placeholder="Seed treatment, crop rotation..." />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Prevention Description</span>
              <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.preventionDescription || ''} onChange={e => f('preventionDescription', e.target.value)} placeholder="Detailed prevention steps..." />
            </label>
          </div>

          {/* Images */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Disease Images (multiple)</span>
              <input ref={diseaseImgRef} type="file" accept="image/*" multiple className="admin-input w-full cursor-pointer" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Healthy Images (multiple)</span>
              <input ref={healthyImgRef} type="file" accept="image/*" multiple className="admin-input w-full cursor-pointer" />
            </label>
          </div>

          {editingId && (form.diseaseImages?.length || 0) > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Existing disease images ({form.diseaseImages?.length}):</p>
              <div className="flex flex-wrap gap-2">
                {form.diseaseImages?.map((url, i) => (
                  <img
                    key={i}
                    src={`${ASSET_BASE}${url}`}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover border border-white/10"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="admin-button-secondary px-6 py-2.5">Cancel</button>
            <button type="submit" disabled={submitting} className="admin-button-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Saving...' : editingId ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">Disease Records</h3>
            <p className="mt-0.5 text-sm text-slate-400">{pagination.total} total records</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              className="admin-input w-52"
              placeholder="Search crop / disease..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {!showForm && (
              <button onClick={openAdd} className="admin-button-primary px-5 py-2">+ Add Disease</button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading records...</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No records found. Add the first disease record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Crop</th>
                  <th className="pb-3 pr-4">Disease</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Severity</th>
                  <th className="pb-3 pr-4">Images</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map(r => (
                  <tr key={r._id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white">{r.cropName}</td>
                    <td className="py-3 pr-4 text-slate-300">{r.diseaseName}</td>
                    <td className="py-3 pr-4 text-slate-400">{r.diseaseType}</td>
                    <td className="py-3 pr-4"><span className={sevBadge(r.severityLevel)}>{r.severityLevel}</span></td>
                    <td className="py-3 pr-4 text-slate-400">{(r.diseaseImages?.length || 0) + (r.healthyImages?.length || 0)} imgs</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setViewRecord(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-blue-300 transition-colors" title="View">👁</button>
                        <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-300 transition-colors" title="Edit">✏️</button>
                        <button onClick={() => setDeleteConfirm({ id: r._id, name: r.diseaseName })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400 transition-colors" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

      {/* View Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{viewRecord.diseaseName}</h3>
                <p className="text-sm text-slate-400">{viewRecord.cropName} · {viewRecord.diseaseType}</p>
                <span className={`mt-1 ${sevBadge(viewRecord.severityLevel)}`}>{viewRecord.severityLevel}</span>
              </div>
              <button onClick={() => setViewRecord(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              {viewRecord.scientificName && <p><span className="text-slate-500">Scientific Name:</span> {viewRecord.scientificName}</p>}
              <p>{viewRecord.description}</p>
              {viewRecord.symptomsDescription && (
                <div>
                  <p className="font-semibold text-amber-300 mb-1">Symptoms:</p>
                  <p className="whitespace-pre-line">{viewRecord.symptomsDescription}</p>
                </div>
              )}
              {viewRecord.treatmentDescription && (
                <div>
                  <p className="font-semibold text-blue-300 mb-1">Treatment:</p>
                  <p className="whitespace-pre-line">{viewRecord.treatmentDescription}</p>
                </div>
              )}
              {viewRecord.preventionDescription && (
                <div>
                  <p className="font-semibold text-green-300 mb-1">Prevention:</p>
                  <p className="whitespace-pre-line">{viewRecord.preventionDescription}</p>
                </div>
              )}
              {viewRecord.recommendedProducts && (
                <p><span className="text-slate-500">Products:</span> {viewRecord.recommendedProducts}</p>
              )}
              {(viewRecord.diseaseImages?.length || 0) > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Disease Images:</p>
                  <div className="flex flex-wrap gap-2">
                    {viewRecord.diseaseImages.map((u, i) => (
                      <img key={i} src={`${ASSET_BASE}${u}`} alt="" className="h-20 w-20 rounded-xl object-cover border border-white/10"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setViewRecord(null); openEdit(viewRecord); }} className="admin-button-secondary flex-1 py-2">Edit</button>
              <button onClick={() => setViewRecord(null)} className="admin-button-primary flex-1 py-2">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-bold text-white">Delete Disease Record?</h3>
            <p className="mt-3 text-sm text-slate-300">Delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="admin-button-secondary flex-1 py-2">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-red-200 hover:bg-red-500/30 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
