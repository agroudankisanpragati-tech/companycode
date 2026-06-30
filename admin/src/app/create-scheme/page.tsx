'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { requestJson, requestFormData, formatDate, updateGovtScheme, deleteGovtScheme, uploadSchemeMedia, fetchSchemesFromAPI } from '@/components/admin/admin-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import type { GovtScheme, SchemeType } from '@/components/admin/admin-types';
import { ASSET_BASE } from '@/components/admin/admin-api';

const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const empty = () => ({
    title: '', summary: '', description: '', department: '', audience: '',
    benefits: '', eligibility: '', requiredDocuments: '', applicationProcess: '',
    applicationLink: '', officialLink: '', coverImage: '', tags: '', keywords: '',
    schemeType: 'central' as SchemeType, state: '', status: 'published' as 'draft' | 'published',
    images: [] as string[], videos: [] as string[],
});

export default function CreateSchemePage() {
    const { token } = useAdmin();
    const [form, setForm] = useState(empty());
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [fetchingApi, setFetchingApi] = useState(false);
    const [schemes, setSchemes] = useState<GovtScheme[]>([]);
    const [loadingSchemes, setLoadingSchemes] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
    const [filterType, setFilterType] = useState<'' | SchemeType>('');
    const [filterState, setFilterState] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

    const loadSchemes = async () => {
        if (!token) return;
        setLoadingSchemes(true);
        try {
            const qs = new URLSearchParams();
            if (filterType) qs.set('schemeType', filterType);
            if (filterState && filterType === 'state') qs.set('state', filterState);
            if (filterSearch) qs.set('search', filterSearch);
            const res = await requestJson<{ success: boolean; data: GovtScheme[] }>(
                `/schemes/admin/all${qs.toString() ? '?' + qs.toString() : ''}`, token
            );
            setSchemes(res.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load schemes');
        } finally {
            setLoadingSchemes(false);
        }
    };

    useEffect(() => { void loadSchemes(); }, [token, filterType, filterState, filterSearch]);

    const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value }));

    const handleUploadMedia = async (e: ChangeEvent<HTMLInputElement>, type: 'images' | 'videos') => {
        if (!token || !e.target.files?.length) return;
        setUploadingMedia(true);
        try {
            const fd = new FormData();
            Array.from(e.target.files).forEach((f) => fd.append(type, f));
            const res = await uploadSchemeMedia(token, fd);
            setForm((p) => ({ ...p, [type]: [...p[type], ...res.data[type]] }));
            setMessage(`${type === 'images' ? 'Images' : 'Videos'} uploaded successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploadingMedia(false);
            e.target.value = '';
        }
    };

    const removeMedia = (type: 'images' | 'videos', url: string) => {
        setForm((p) => ({ ...p, [type]: p[type].filter((u) => u !== url) }));
    };

    const handleFetchFromApi = async () => {
        if (!token) return;
        setFetchingApi(true);
        setError('');
        setMessage('');
        try {
            const res = await fetchSchemesFromAPI(token, form.schemeType, form.state || undefined);
            setMessage(res.message);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'API fetch failed');
        } finally {
            setFetchingApi(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!token) { setError('Admin token missing. Please re-login.'); return; }
        setSubmitting(true);
        setError('');
        setMessage('');
        const payload = {
            title: form.title,
            summary: form.summary,
            description: form.description,
            department: form.department,
            audience: form.audience,
            benefits: form.benefits.split(',').map((s) => s.trim()).filter(Boolean),
            eligibility: form.eligibility,
            requiredDocuments: form.requiredDocuments.split(',').map((s) => s.trim()).filter(Boolean),
            applicationProcess: form.applicationProcess,
            applicationLink: form.applicationLink,
            officialLink: form.officialLink,
            coverImage: form.coverImage,
            images: form.images,
            videos: form.videos,
            tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
            keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
            schemeType: form.schemeType,
            state: form.schemeType === 'state' ? form.state : '',
            status: form.status,
        };
        try {
            if (editingId) {
                await updateGovtScheme(token, editingId, payload);
                setMessage('Scheme updated successfully.');
            } else {
                await requestJson('/schemes/admin', token, { method: 'POST', body: JSON.stringify(payload) });
                setMessage(form.status === 'published' ? 'Scheme published successfully.' : 'Draft saved successfully.');
            }
            setForm(empty());
            setEditingId(null);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save scheme');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (s: GovtScheme) => {
        setForm({
            title: s.title, summary: s.summary, description: s.description,
            department: s.department, audience: s.audience,
            benefits: s.benefits.join(', '),
            eligibility: s.eligibility || '',
            requiredDocuments: (s.requiredDocuments || []).join(', '),
            applicationProcess: s.applicationProcess || '',
            applicationLink: s.applicationLink || '',
            officialLink: s.officialLink || '',
            coverImage: s.coverImage || '',
            tags: s.tags.join(', '),
            keywords: (s.keywords || []).join(', '),
            schemeType: s.schemeType || 'central',
            state: s.state || '',
            status: s.status,
            images: s.images || [],
            videos: s.videos || [],
        });
        setEditingId(s._id);
        setMessage('');
        setError('');
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        try {
            await deleteGovtScheme(token, id);
            setMessage('Scheme deleted.');
            setDeleteConfirm(null);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const handleCancel = () => { setForm(empty()); setEditingId(null); setMessage(''); setError(''); };

    const mediaBase = ASSET_BASE;

    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
                <h2 className="text-2xl font-bold text-white">{editingId ? 'Edit Government Scheme' : 'Create Government Scheme'}</h2>
                <p className="mt-2 text-sm text-slate-400">Manage Central and State government schemes visible to farmers.</p>
            </div>

            {message ? <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
            {error ? <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

            <div ref={formRef}>
            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-5">
                {/* Scheme Type */}
                <div className="grid gap-4 lg:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Scheme Type *</span>
                        <select className="admin-input w-full" value={form.schemeType} onChange={set('schemeType')}>
                            <option value="central">Central Government</option>
                            <option value="state">State Government</option>
                        </select>
                    </label>

                    {form.schemeType === 'state' && (
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>State *</span>
                            <select className="admin-input w-full" value={form.state} onChange={set('state')} required>
                                <option value="">Select State</option>
                                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                    )}

                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Status</span>
                        <select className="admin-input w-full" value={form.status} onChange={set('status')}>
                            <option value="published">Publish now</option>
                            <option value="draft">Save as draft</option>
                        </select>
                    </label>
                </div>

                {/* Basic Info */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Scheme Title *</span>
                        <input className="admin-input w-full" value={form.title} onChange={set('title')} placeholder="Enter scheme title" required />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Department *</span>
                        <input className="admin-input w-full" value={form.department} onChange={set('department')} placeholder="Ministry of Agriculture" required />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Summary *</span>
                        <input className="admin-input w-full" value={form.summary} onChange={set('summary')} placeholder="Short scheme summary" required />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Target Audience *</span>
                        <input className="admin-input w-full" value={form.audience} onChange={set('audience')} placeholder="Small farmers, women SHGs" required />
                    </label>
                </div>

                <label className="space-y-2 text-sm text-slate-300">
                    <span>Detailed Description *</span>
                    <textarea className="admin-input min-h-[160px] w-full resize-none" value={form.description} onChange={set('description')} placeholder="Explain the scheme in detail..." required />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Eligibility</span>
                        <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.eligibility} onChange={set('eligibility')} placeholder="Who is eligible for this scheme?" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Application Process</span>
                        <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.applicationProcess} onChange={set('applicationProcess')} placeholder="How to apply step by step..." />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Benefits (comma separated)</span>
                        <input className="admin-input w-full" value={form.benefits} onChange={set('benefits')} placeholder="Subsidy, training, loan support" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Required Documents (comma separated)</span>
                        <input className="admin-input w-full" value={form.requiredDocuments} onChange={set('requiredDocuments')} placeholder="Aadhaar, land records, bank passbook" />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Application Link</span>
                        <input className="admin-input w-full" value={form.applicationLink} onChange={set('applicationLink')} placeholder="https://..." />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Official Link</span>
                        <input className="admin-input w-full" value={form.officialLink} onChange={set('officialLink')} placeholder="https://official-site.gov.in" />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Cover Image URL</span>
                        <input className="admin-input w-full" value={form.coverImage} onChange={set('coverImage')} placeholder="https://example.com/scheme.jpg" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Tags (comma separated)</span>
                        <input className="admin-input w-full" value={form.tags} onChange={set('tags')} placeholder="subsidy, loan, welfare" />
                    </label>
                </div>

                <label className="space-y-2 text-sm text-slate-300">
                    <span>Keywords (comma separated — used for search)</span>
                    <input className="admin-input w-full" value={form.keywords} onChange={set('keywords')} placeholder="pm kisan, drip irrigation, crop insurance" />
                </label>

                {/* Media Upload */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white">Media Upload</h4>
                    <div className="flex flex-wrap gap-3">
                        <div>
                            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadMedia(e, 'images')} />
                            <button type="button" disabled={uploadingMedia} onClick={() => imageInputRef.current?.click()} className="admin-button-secondary text-sm px-4 py-2">
                                {uploadingMedia ? 'Uploading...' : '+ Upload Images'}
                            </button>
                        </div>
                        <div>
                            <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleUploadMedia(e, 'videos')} />
                            <button type="button" disabled={uploadingMedia} onClick={() => videoInputRef.current?.click()} className="admin-button-secondary text-sm px-4 py-2">
                                {uploadingMedia ? 'Uploading...' : '+ Upload Videos'}
                            </button>
                        </div>
                    </div>

                    {form.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.images.map((url) => (
                                <div key={url} className="relative group">
                                    <img src={url.startsWith('/') ? `${mediaBase}${url}` : url} alt="" className="h-20 w-20 rounded-lg object-cover border border-white/10" />
                                    <button type="button" onClick={() => removeMedia('images', url)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {form.videos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.videos.map((url) => (
                                <div key={url} className="relative group">
                                    <video src={url.startsWith('/') ? `${mediaBase}${url}` : url} className="h-20 w-32 rounded-lg object-cover border border-white/10" muted />
                                    <button type="button" onClick={() => removeMedia('videos', url)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                    {editingId && (
                        <button type="button" onClick={handleCancel} className="admin-button-secondary px-6 py-3">Cancel</button>
                    )}
                    <button type="submit" disabled={submitting} className="admin-button-primary px-6 py-3 disabled:opacity-60">
                        {submitting ? 'Saving...' : editingId ? 'Update Scheme' : form.status === 'published' ? 'Publish Scheme' : 'Save Draft'}
                    </button>
                </div>
            </form>
            </div>

            {/* ── Schemes List ── */}
            <section className="glass-panel rounded-3xl p-6">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white">All Government Schemes</h3>
                        <p className="mt-1 text-sm text-slate-400">Admin-created and API-imported schemes from the same database.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button type="button" onClick={handleFetchFromApi} disabled={fetchingApi} className="admin-button-secondary text-sm px-4 py-2 disabled:opacity-60">
                            {fetchingApi ? 'Fetching...' : 'Fetch from API'}
                        </button>
                        <button type="button" onClick={loadSchemes} className="admin-button-secondary text-sm px-4 py-2">Refresh</button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-3">
                    <select className="admin-input text-sm py-1.5" value={filterType} onChange={(e) => setFilterType(e.target.value as '' | SchemeType)}>
                        <option value="">All Types</option>
                        <option value="central">Central</option>
                        <option value="state">State</option>
                    </select>
                    {filterType === 'state' && (
                        <select className="admin-input text-sm py-1.5" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                            <option value="">All States</option>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                    <input
                        className="admin-input text-sm py-1.5 flex-1 min-w-[200px]"
                        placeholder="Search by name, state, tag..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                    />
                </div>

                {loadingSchemes && <p className="text-sm text-slate-400">Loading schemes...</p>}
                {!loadingSchemes && schemes.length === 0 && <p className="text-sm text-slate-400">No schemes found.</p>}

                <div className="grid gap-4 md:grid-cols-2">
                    {schemes.map((s) => (
                        <article key={s._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-semibold text-white truncate">{s.title}</h4>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === 'published' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>{s.status}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.schemeType === 'central' ? 'bg-sky-400/20 text-sky-200' : 'bg-violet-400/20 text-violet-200'}`}>{s.schemeType}</span>
                                        {s.state && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{s.state}</span>}
                                        {s.source === 'api' && <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-xs text-orange-200">API</span>}
                                    </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button type="button" onClick={() => handleEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-blue-400" title="Edit">✏️</button>
                                    <button type="button" onClick={() => setDeleteConfirm({ id: s._id, title: s.title })} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-red-400" title="Delete">🗑️</button>
                                </div>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-slate-400">{s.summary}</p>
                            <div className="mt-2 text-xs text-slate-500">Updated: {formatDate(s.updatedAt)}</div>
                        </article>
                    ))}
                </div>
            </section>

            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6">
                        <h3 className="text-lg font-bold text-white">Delete Scheme?</h3>
                        <p className="mt-3 text-sm text-slate-300">Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>? This cannot be undone.</p>
                        <div className="mt-6 flex gap-3">
                            <button type="button" onClick={() => setDeleteConfirm(null)} className="admin-button-secondary flex-1 rounded-lg px-4 py-2">Cancel</button>
                            <button type="button" onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-red-200 hover:bg-red-500/30">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
