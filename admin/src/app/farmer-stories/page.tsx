'use client';

import { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  fetchAdminStories,
  adminUploadStory,
  updateAdminStory,
  updateStoryStatus,
  toggleStoryFeatured,
  deleteAdminStory,
  ASSET_BASE,
} from '@/components/admin/admin-api';
import type { FarmerStory, FarmerStorySummary, StoryCategory } from '@/components/admin/admin-types';
import { StatCard } from '@/components/admin/AdminUi';
import {
  FaVideo, FaCheck, FaTimes, FaStar, FaTrash, FaEdit,
  FaUpload, FaSpinner, FaRegClock, FaEye, FaHeart,
} from 'react-icons/fa';

const CATEGORIES: StoryCategory[] = [
  'Success Story', 'Organic Farming', 'Medicinal Farming',
  'High Profit Farming', 'Innovation', 'Water Saving', 'Technology Adoption',
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

// ─── Upload / Edit Form Modal ─────────────────────────────────────────────────
function StoryFormModal({
  token,
  editing,
  onClose,
  onSaved,
}: {
  token: string;
  editing: FarmerStory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [farmerName, setFarmerName] = useState(editing?.farmerName || '');
  const [village, setVillage] = useState(editing?.village || '');
  const [district, setDistrict] = useState(editing?.district || '');
  const [state, setState] = useState(editing?.state || '');
  const [cropName, setCropName] = useState(editing?.cropName || '');
  const [title, setTitle] = useState(editing?.title || '');
  const [caption, setCaption] = useState(editing?.caption || '');
  const [successDescription, setSuccessDescription] = useState(editing?.successDescription || '');
  const [category, setCategory] = useState<StoryCategory>(editing?.category || 'Success Story');
  const [featured, setFeatured] = useState(editing?.featured || false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !videoFile) { setError('Video file is required.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      if (videoFile) fd.append('video', videoFile);
      if (thumbFile) fd.append('thumbnail', thumbFile);
      fd.append('farmerName', farmerName);
      fd.append('village', village);
      fd.append('district', district);
      fd.append('state', state);
      fd.append('cropName', cropName);
      fd.append('title', title);
      fd.append('caption', caption);
      fd.append('successDescription', successDescription);
      fd.append('category', category);
      fd.append('featured', String(featured));

      if (editing) {
        const res = await updateAdminStory(token, editing._id, fd);
        if (!res.success) throw new Error('Update failed');
      } else {
        await adminUploadStory(token, fd);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/10 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">{editing ? 'Edit Story' : 'Upload New Story'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><FaTimes /></button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-300">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Farmer Name *</label>
              <input className="admin-input" value={farmerName} onChange={e => setFarmerName(e.target.value)} placeholder="Farmer Name" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Crop Name</label>
              <input className="admin-input" value={cropName} onChange={e => setCropName(e.target.value)} placeholder="e.g. Wheat" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Village</label>
              <input className="admin-input" value={village} onChange={e => setVillage(e.target.value)} placeholder="Village" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">District</label>
              <input className="admin-input" value={district} onChange={e => setDistrict(e.target.value)} placeholder="District" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">State</label>
              <input className="admin-input" value={state} onChange={e => setState(e.target.value)} placeholder="State" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Story Title *</label>
            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
              <select className="admin-input" value={category} onChange={e => setCategory(e.target.value as StoryCategory)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} className="w-4 h-4 rounded accent-amber-400" />
                Feature this story ⭐
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Caption</label>
            <textarea className="admin-input resize-none min-h-[70px]" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Short caption..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Success Description</label>
            <textarea className="admin-input resize-none min-h-[80px]" value={successDescription} onChange={e => setSuccessDescription(e.target.value)} placeholder="Describe the success story in detail..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Video File {!editing && '*'} {editing && <span className="text-slate-500">(leave empty to keep existing)</span>}
              </label>
              <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Thumbnail (optional)</label>
              <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-300" />
            </div>
          </div>
          <div className="pt-1 flex gap-3">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition">
              {submitting ? <><FaSpinner className="animate-spin" /> Saving...</> : <><FaUpload /> {editing ? 'Save Changes' : 'Upload Story'}</>}
            </button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Video Preview Modal ──────────────────────────────────────────────────────
function VideoPreviewModal({ story, onClose }: { story: FarmerStory; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -right-3 -top-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><FaTimes /></button>
        <video className="w-full rounded-2xl" controls autoPlay playsInline>
          <source src={`${ASSET_BASE}${story.videoUrl}`} />
        </video>
        <div className="mt-3 text-center text-white">
          <p className="font-bold">{story.title}</p>
          <p className="text-sm text-slate-400">{story.farmerName} · {story.state}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminFarmerStoriesPage() {
  const { token } = useAdmin();
  const [stories, setStories] = useState<FarmerStory[]>([]);
  const [summary, setSummary] = useState<FarmerStorySummary>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingStory, setEditingStory] = useState<FarmerStory | null>(null);
  const [previewStory, setPreviewStory] = useState<FarmerStory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchAdminStories(token, { page, limit: 15, status: statusFilter || undefined });
      setStories(res.data);
      setSummary(res.summary);
      setTotalPages(res.pagination.pages || 1);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, page, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatus = async (id: string, status: string) => {
    if (!token) return;
    try {
      await updateStoryStatus(token, id, status);
      flash(`Story ${status}`);
      load();
    } catch (e: any) { flash(e.message || 'Failed'); }
  };

  const handleFeature = async (id: string, featured: boolean) => {
    if (!token) return;
    try {
      await toggleStoryFeatured(token, id, featured);
      flash(featured ? 'Story featured ⭐' : 'Feature removed');
      load();
    } catch (e: any) { flash(e.message || 'Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!token || !window.confirm('Delete this story permanently?')) return;
    try {
      await deleteAdminStory(token, id);
      flash('Story deleted');
      load();
    } catch (e: any) { flash(e.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Farmer Stories</h1>
          <p className="mt-1 text-sm text-slate-400">Manage, approve, and feature farmer success stories</p>
        </div>
        <button
          onClick={() => { setEditingStory(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition"
        >
          <FaUpload size={12} /> Upload Story
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">{msg}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Stories" value={summary.total} icon={FaVideo} accent="from-cyan-500 to-blue-500" />
        <StatCard title="Pending" value={summary.pending} icon={FaRegClock} accent="from-amber-400 to-orange-500" />
        <StatCard title="Approved" value={summary.approved} icon={FaCheck} accent="from-emerald-500 to-teal-500" />
        <StatCard title="Rejected" value={summary.rejected} icon={FaTimes} accent="from-red-500 to-rose-500" />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ label: 'All', value: '' }, { label: '⏳ Pending', value: 'pending' }, { label: '✅ Approved', value: 'approved' }, { label: '❌ Rejected', value: 'rejected' }].map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${statusFilter === f.value ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stories table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <FaSpinner className="animate-spin text-2xl mr-2" /> Loading stories...
          </div>
        ) : stories.length === 0 ? (
          <div className="py-16 text-center text-slate-500">No stories found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Story</th>
                  <th className="px-4 py-3 text-left">Farmer</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Likes / Views</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stories.map(story => (
                  <tr key={story._id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setPreviewStory(story)} className="relative flex-shrink-0 h-14 w-10 rounded-xl overflow-hidden bg-slate-800 hover:ring-2 hover:ring-emerald-500 transition">
                          {story.thumbnailUrl ? (
                            <img src={`${ASSET_BASE}${story.thumbnailUrl}`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-600"><FaVideo /></div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
                            <FaEye className="text-white text-xs" />
                          </div>
                        </button>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-xs line-clamp-1">{story.title}</p>
                          {story.cropName && <p className="text-[10px] text-emerald-400">{story.cropName}</p>}
                          {story.featured && <span className="text-[10px] text-amber-400">⭐ Featured</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-200 font-medium">{story.farmerName}</p>
                      <p className="text-[10px] text-slate-500">{[story.village, story.district, story.state].filter(Boolean).join(', ') || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{story.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS[story.status] || ''}`}>
                        {story.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">
                      <span className="flex items-center justify-end gap-2">
                        <span className="flex items-center gap-1"><FaHeart size={9} className="text-red-400" /> {story.likes}</span>
                        <span className="flex items-center gap-1"><FaEye size={9} /> {story.views}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {story.status === 'pending' && (
                          <>
                            <button onClick={() => handleStatus(story._id, 'approved')} title="Approve"
                              className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/40 transition">
                              <FaCheck size={11} />
                            </button>
                            <button onClick={() => handleStatus(story._id, 'rejected')} title="Reject"
                              className="rounded-lg bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/40 transition">
                              <FaTimes size={11} />
                            </button>
                          </>
                        )}
                        {story.status === 'rejected' && (
                          <button onClick={() => handleStatus(story._id, 'approved')} title="Approve"
                            className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/40 transition">
                            <FaCheck size={11} />
                          </button>
                        )}
                        {story.status === 'approved' && (
                          <button onClick={() => handleFeature(story._id, !story.featured)} title={story.featured ? 'Unfeature' : 'Feature'}
                            className={`rounded-lg p-1.5 transition ${story.featured ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/50' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>
                            <FaStar size={11} />
                          </button>
                        )}
                        <button onClick={() => { setEditingStory(story); setFormOpen(true); }} title="Edit"
                          className="rounded-lg bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 transition">
                          <FaEdit size={11} />
                        </button>
                        <button onClick={() => handleDelete(story._id)} title="Delete"
                          className="rounded-lg bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/40 transition">
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 disabled:opacity-30 transition">
              ← Prev
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/10 disabled:opacity-30 transition">
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Upload/Edit Form Modal */}
      {formOpen && (
        <StoryFormModal
          token={token!}
          editing={editingStory}
          onClose={() => { setFormOpen(false); setEditingStory(null); }}
          onSaved={() => { flash(editingStory ? 'Story updated!' : 'Story uploaded and auto-approved!'); load(); }}
        />
      )}

      {/* Video Preview Modal */}
      {previewStory && <VideoPreviewModal story={previewStory} onClose={() => setPreviewStory(null)} />}
    </div>
  );
}
