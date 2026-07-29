'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard } from '@/components/admin/AdminUi';
import { FaDatabase, FaLeaf, FaBug, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const ASSET_BASE = API_BASE.replace(/\/api$/, '');

type DPSRecord = {
  _id: string;
  cropName: string;
  recordType: string;
  diseasePestName: string;
  aiLabel?: string;
  aliases?: string[];
  severity: string;
  description?: string;
  symptoms?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  urgentPrevention?: string;
  recoveryTips?: string;
  preventiveMeasures?: string;
  dos?: string;
  donts?: string;
  recommendedProducts?: string;
  farmerAdvice?: string;
  referenceImages: string[];
  tags: string[];
  keywords: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

const EMPTY: Partial<DPSRecord> = {
  cropName: '', recordType: 'Disease', diseasePestName: '', aiLabel: '', aliases: [],
  severity: 'medium',
  description: '', symptoms: '', organicSolution: '', chemicalSolution: '',
  urgentPrevention: '', recoveryTips: '', preventiveMeasures: '',
  dos: '', donts: '', recommendedProducts: '', farmerAdvice: '',
  referenceImages: [], tags: [], keywords: [], status: 'draft',
};

const sevBadge = (s: string) => {
  const m: Record<string, string> = {
    critical: 'bg-red-400/20 text-red-300', high: 'bg-orange-400/20 text-orange-300',
    medium: 'bg-amber-400/20 text-amber-300', low: 'bg-green-400/20 text-green-300',
  };
  return `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${m[s] || 'bg-slate-400/20 text-slate-300'}`;
};

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    published: 'bg-emerald-400/20 text-emerald-300',
    draft: 'bg-slate-400/20 text-slate-300',
  };
  return `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${m[s] || 'bg-slate-400/20 text-slate-300'}`;
};

export default function DiseasePestKnowledgePage() {
  const { token } = useAdmin();
  const [records, setRecords] = useState<DPSRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, totalCrops: 0, totalPublished: 0, totalDraft: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DPSRecord>>(EMPTY);
  const [viewRecord, setViewRecord] = useState<DPSRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const imgRef = useRef<HTMLInputElement>(null);

  const authH = () => ({ Authorization: `Bearer ${token}` });

  const load = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      if (filterType) q.set('recordType', filterType);
      if (filterStatus) q.set('status', filterStatus);
      const res = await fetch(`${API_BASE}/disease-pest-solutions?${q}`, { headers: authH() });
      const json = await res.json();
      setRecords(json.data || []);
      setSummary(json.summary || { total: 0, totalCrops: 0, totalPublished: 0, totalDraft: 0 });
      setPagination(json.pagination || { total: 0, page: 1, limit: 20, pages: 1 });
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(1); }, [token, search, filterType, filterStatus]);

  const f = (k: keyof DPSRecord, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setForm(EMPTY); setEditingId(null); setMsg(''); setErr(''); setShowForm(true); };
  const openEdit = (r: DPSRecord) => { setForm(r); setEditingId(r._id); setMsg(''); setErr(''); setShowForm(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setErr(''); setMsg('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) v.forEach(item => fd.append(k, item));
        else fd.append(k, String(v));
      });
      if (imgRef.current?.files) Array.from(imgRef.current.files).forEach(fi => fd.append('referenceImages', fi));

      const url = editingId
        ? `${API_BASE}/disease-pest-solutions/${editingId}`
        : `${API_BASE}/disease-pest-solutions`;
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: authH(), body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setMsg(editingId ? 'Record updated.' : 'Record created.');
      setShowForm(false); setEditingId(null); setForm(EMPTY);
      await load(pagination.page);
    } catch (e: any) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/disease-pest-solutions/${id}`, { method: 'DELETE', headers: authH() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setMsg('Deleted.'); setDeleteConfirm(null); setSelected(s => s.filter(x => x !== id));
      await load(pagination.page);
    } catch (e: any) { setErr(e.message); }
  };

  const handleBulkDelete = async () => {
    if (!token || !selected.length) return;
    if (!window.confirm(`Delete ${selected.length} records?`)) return;
    try {
      const res = await fetch(`${API_BASE}/disease-pest-solutions/bulk-delete`, {
        method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setMsg(`Deleted ${json.deleted} records.`); setSelected([]);
      await load(1);
    } catch (e: any) { setErr(e.message); }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/disease-pest-solutions/export/json`, { headers: authH() });
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'disease-pest-solutions.json'; a.click();
    } catch (e: any) { setErr(e.message); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !token) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const records = parsed.data || parsed;
      const res = await fetch(`${API_BASE}/disease-pest-solutions/import/json`, {
        method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: records }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      setMsg(`Imported: ${json.created} created, ${json.updated} updated, ${json.errors} errors.`);
      await load(1);
    } catch (e: any) { setErr(e.message); }
    e.target.value = '';
  };

  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const ta = (k: keyof DPSRecord, label: string, rows = 3) => (
    <label className="space-y-1.5 text-sm text-slate-300 block">
      <span>{label}</span>
      <textarea className="admin-input min-h-[60px] w-full resize-none" rows={rows}
        value={(form[k] as string) || ''} onChange={e => f(k, e.target.value)} />
    </label>
  );

  const inp = (k: keyof DPSRecord, label: string, required = false) => (
    <label className="space-y-1.5 text-sm text-slate-300">
      <span>{label}{required ? ' *' : ''}</span>
      <input className="admin-input w-full" value={(form[k] as string) || ''}
        onChange={e => f(k, e.target.value)} required={required} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-white">Disease &amp; Pest Knowledge</h2>
        <p className="mt-1 text-sm text-slate-400">Unified management for diseases, pests, deficiencies and healthy crop records.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Total Records"  value={summary.total}          icon={FaDatabase} accent="from-cyan-500 to-blue-500" />
        <StatCard title="Crops Covered"  value={summary.totalCrops}     icon={FaLeaf}     accent="from-emerald-500 to-teal-500" />
        <StatCard title="Published"      value={summary.totalPublished}  icon={FaCheckCircle} accent="from-green-500 to-lime-500" />
        <StatCard title="Drafts"         value={summary.totalDraft}      icon={FaBug}      accent="from-rose-500 to-pink-500" />
      </div>

      {msg && <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{msg}</div>}
      {err && <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-5">
          <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Record' : 'Add Record'}</h3>

          <div className="grid gap-4 md:grid-cols-3">
            {inp('cropName', 'Crop Name', true)}
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Record Type *</span>
              <select className="admin-input w-full" value={form.recordType || 'Disease'} onChange={e => f('recordType', e.target.value)} required>
                {['Disease','Pest','Deficiency','Healthy'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {inp('diseasePestName', 'Disease / Pest Name', true)}
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Severity</span>
              <select className="admin-input w-full" value={form.severity || 'medium'} onChange={e => f('severity', e.target.value)}>
                {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>Status</span>
              <select className="admin-input w-full" value={form.status || 'draft'} onChange={e => f('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-cyan-300">🤖 AI Matching (optional but recommended)</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm text-slate-300">
                <span>AI Label (raw YOLO class_name)</span>
                <input className="admin-input w-full" placeholder="e.g. Black_Gram_Cercospora_Leaf_Spot"
                  value={(form.aiLabel as string) || ''} onChange={e => f('aiLabel', e.target.value)} />
                <span className="text-xs text-slate-500">Exact YOLO prediction label for guaranteed match</span>
              </label>
              <label className="space-y-1.5 text-sm text-slate-300">
                <span>Aliases (comma-separated)</span>
                <input className="admin-input w-full" placeholder="e.g. cercospora, leaf spot, CLS"
                  value={(form.aliases || []).join(', ')}
                  onChange={e => f('aliases', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} />
                <span className="text-xs text-slate-500">Alternative names for fuzzy matching</span>
              </label>
            </div>
          </div>

          {ta('description', 'Description', 3)}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-300">🔍 Symptoms &amp; Solutions</p>
            {ta('symptoms', 'Symptoms')}
            <div className="grid gap-4 md:grid-cols-2">
              {ta('organicSolution', 'Organic Solution')}
              {ta('chemicalSolution', 'Chemical Solution')}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-300">🛡️ Prevention &amp; Recovery</p>
            {ta('urgentPrevention', 'Urgent Prevention')}
            {ta('recoveryTips', 'Recovery Tips')}
            {ta('preventiveMeasures', 'Preventive Measures')}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-green-300">✅ Do's &amp; Don'ts</p>
            <div className="grid gap-4 md:grid-cols-2">
              {ta('dos', "Do's")}
              {ta('donts', "Don'ts")}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-purple-300">📦 Products &amp; Advice</p>
            {ta('recommendedProducts', 'Recommended Products')}
            {ta('farmerAdvice', 'Farmer Advice')}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300 block">
              <span>Tags (comma-separated)</span>
              <input className="admin-input w-full" value={(form.tags || []).join(', ')}
                onChange={e => f('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300 block">
              <span>Keywords (comma-separated)</span>
              <input className="admin-input w-full" value={(form.keywords || []).join(', ')}
                onChange={e => f('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </label>
          </div>

          <label className="space-y-1.5 text-sm text-slate-300 block">
            <span>Reference Images</span>
            <input ref={imgRef} type="file" accept="image/*" multiple className="admin-input w-full cursor-pointer" />
          </label>

          {editingId && (form.referenceImages?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.referenceImages?.map((url, i) => (
                <img key={i} src={`${ASSET_BASE}${url}`} alt="" className="h-16 w-16 rounded-lg object-cover border border-white/10"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="admin-button-secondary px-6 py-2.5">Cancel</button>
            <button type="submit" disabled={submitting} className="admin-button-primary px-6 py-2.5 disabled:opacity-60">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">All Records</h3>
            <p className="mt-0.5 text-sm text-slate-400">{pagination.total} total</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input className="admin-input w-44" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-input w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {['Disease','Pest','Deficiency','Healthy'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="admin-input w-32" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            {!showForm && <button onClick={openAdd} className="admin-button-primary px-4 py-2">+ Add</button>}
            {selected.length > 0 && (
              <button onClick={handleBulkDelete} className="rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30">
                Delete ({selected.length})
              </button>
            )}
            <button onClick={handleExport} className="admin-button-secondary px-4 py-2 text-xs">Export JSON</button>
            <label className="admin-button-secondary px-4 py-2 text-xs cursor-pointer">
              Import JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-2"><input type="checkbox" onChange={e => setSelected(e.target.checked ? records.map(r => r._id) : [])} checked={selected.length === records.length && records.length > 0} /></th>
                  <th className="pb-3 pr-4">Crop</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Disease / Pest</th>
                  <th className="pb-3 pr-4">Severity</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map(r => (
                  <tr key={r._id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-2"><input type="checkbox" checked={selected.includes(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                    <td className="py-3 pr-4 font-semibold text-white">{r.cropName}</td>
                    <td className="py-3 pr-4 text-slate-400">{r.recordType}</td>
                    <td className="py-3 pr-4 text-slate-300">{r.diseasePestName}</td>
                    <td className="py-3 pr-4"><span className={sevBadge(r.severity)}>{r.severity}</span></td>
                    <td className="py-3 pr-4"><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setViewRecord(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-blue-300">👁</button>
                        <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-300">✏️</button>
                        <button onClick={() => setDeleteConfirm({ id: r._id, name: r.diseasePestName })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400">🗑️</button>
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

      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{viewRecord.diseasePestName}</h3>
                <p className="text-sm text-slate-400">{viewRecord.cropName} · {viewRecord.recordType}</p>
                <div className="mt-1 flex gap-2">
                  <span className={sevBadge(viewRecord.severity)}>{viewRecord.severity}</span>
                  <span className={statusBadge(viewRecord.status)}>{viewRecord.status}</span>
                </div>
              </div>
              <button onClick={() => setViewRecord(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
              {viewRecord.description && <p>{viewRecord.description}</p>}
              {viewRecord.symptoms && <div><p className="font-semibold text-amber-300 mb-1">Symptoms:</p><p className="whitespace-pre-line">{viewRecord.symptoms}</p></div>}
              {viewRecord.organicSolution && <div><p className="font-semibold text-green-300 mb-1">Organic Solution:</p><p className="whitespace-pre-line">{viewRecord.organicSolution}</p></div>}
              {viewRecord.chemicalSolution && <div><p className="font-semibold text-blue-300 mb-1">Chemical Solution:</p><p className="whitespace-pre-line">{viewRecord.chemicalSolution}</p></div>}
              {viewRecord.urgentPrevention && <div><p className="font-semibold text-orange-300 mb-1">Urgent Prevention:</p><p className="whitespace-pre-line">{viewRecord.urgentPrevention}</p></div>}
              {viewRecord.recoveryTips && <div><p className="font-semibold text-pink-300 mb-1">Recovery Tips:</p><p className="whitespace-pre-line">{viewRecord.recoveryTips}</p></div>}
              {viewRecord.preventiveMeasures && <div><p className="font-semibold text-teal-300 mb-1">Preventive Measures:</p><p className="whitespace-pre-line">{viewRecord.preventiveMeasures}</p></div>}
              {viewRecord.dos && <div><p className="font-semibold text-emerald-300 mb-1">Do's:</p><p className="whitespace-pre-line">{viewRecord.dos}</p></div>}
              {viewRecord.donts && <div><p className="font-semibold text-red-300 mb-1">Don'ts:</p><p className="whitespace-pre-line">{viewRecord.donts}</p></div>}
              {viewRecord.recommendedProducts && <div><p className="font-semibold text-violet-300 mb-1">Products:</p><p>{viewRecord.recommendedProducts}</p></div>}
              {viewRecord.farmerAdvice && <div><p className="font-semibold text-yellow-300 mb-1">Farmer Advice:</p><p>{viewRecord.farmerAdvice}</p></div>}
              {(viewRecord.tags?.length || 0) > 0 && <p><span className="text-slate-500">Tags:</span> {viewRecord.tags.join(', ')}</p>}
              {(viewRecord.referenceImages?.length || 0) > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Images:</p>
                  <div className="flex flex-wrap gap-2">
                    {viewRecord.referenceImages.map((u, i) => (
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

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-bold text-white">Delete Record?</h3>
            <p className="mt-3 text-sm text-slate-300">Delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="admin-button-secondary flex-1 py-2">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-red-200 hover:bg-red-500/30">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
