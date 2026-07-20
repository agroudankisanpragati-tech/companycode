'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  fetchReviewQueue,
  approveQueueItem,
  rejectQueueItem,
  mergeQueueItem,
  fetchDictionaryEntries,
  deleteDictionaryEntry,
} from '@/components/admin/admin-api';
import type { ReviewQueueItem, DictionaryEntry, DictionaryCategory } from '@/components/admin/admin-types';

const CATEGORIES: DictionaryCategory[] = [
  'crops', 'diseases', 'pests', 'fertilizers', 'soil', 'weather', 'government', 'agriculture', 'ui',
];

const DIALECT_FIELDS = [
  'marwari', 'mewari', 'dhundhari', 'hadoti', 'shekhawati',
  'bagri', 'wagdi', 'mewati', 'godwari', 'ahirwati', 'malvi',
] as const;

// ─── Approve Modal ────────────────────────────────────────────────────────────

function ApproveModal({
  item,
  onClose,
  onDone,
  token,
}: {
  item: ReviewQueueItem;
  onClose: () => void;
  onDone: () => void;
  token: string;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    english: item.suggestedEnglish || item.rawInput,
    hindi: '',
    category: item.pageContext || 'agriculture',
    reviewNote: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleApprove = async () => {
    if (!form.english || !form.hindi || !form.category) {
      setError('English, Hindi and Category are required');
      return;
    }
    setSaving(true);
    try {
      await approveQueueItem(token, item._id, form as any);
      onDone();
    } catch (e: any) {
      setError(e.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Approve Term</h2>
        <p className="text-sm text-gray-500">Raw input: <span className="font-mono bg-gray-100 px-1 rounded">{item.rawInput}</span></p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">English *</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.english} onChange={(e) => set('english', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Hindi *</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.hindi} onChange={(e) => set('hindi', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Category *</label>
          <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {DIALECT_FIELDS.map((d) => (
            <div key={d}>
              <label className="text-xs font-medium text-gray-600 capitalize">{d}</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form[d] || ''} onChange={(e) => set(d, e.target.value)} placeholder="optional" />
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Review Note</label>
          <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.reviewNote} onChange={(e) => set('reviewNote', e.target.value)} placeholder="optional" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleApprove} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Approve & Add to Dictionary'}
          </button>
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Modal ──────────────────────────────────────────────────────────────

function MergeModal({
  item,
  onClose,
  onDone,
  token,
}: {
  item: ReviewQueueItem;
  onClose: () => void;
  onDone: () => void;
  token: string;
}) {
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (search.length < 2) return;
    fetchDictionaryEntries(token, { search, limit: 10 }).then((r) => setEntries(r.data)).catch(() => {});
  }, [search, token]);

  const handleMerge = async () => {
    if (!selected) { setError('Select a target entry'); return; }
    setSaving(true);
    try {
      await mergeQueueItem(token, item._id, selected);
      onDone();
    } catch (e: any) {
      setError(e.message || 'Failed to merge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Merge as Alias</h2>
        <p className="text-sm text-gray-500">Add <span className="font-mono bg-gray-100 px-1 rounded">{item.rawInput}</span> as an alias of an existing entry.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Search existing entry…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-48 overflow-y-auto space-y-1">
          {entries.map((e) => (
            <button key={e._id} onClick={() => setSelected(e._id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${selected === e._id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="font-medium">{e.english}</span> <span className="text-gray-400">({e.category})</span> — {e.hindi}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleMerge} disabled={saving || !selected} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {saving ? 'Merging…' : 'Merge'}
          </button>
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'queue' | 'dictionary';

export default function LanguageDictionaryPage() {
  const { token } = useAdmin();
  const [tab, setTab] = useState<Tab>('queue');

  // Review Queue state
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [queueStatus, setQueueStatus] = useState('pending');
  const [pendingCount, setPendingCount] = useState(0);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);

  // Dictionary state
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [dictSearch, setDictSearch] = useState('');
  const [dictCategory, setDictCategory] = useState('');
  const [dictPage, setDictPage] = useState(1);
  const [dictTotal, setDictTotal] = useState(0);
  const [dictLoading, setDictLoading] = useState(false);

  // Modals
  const [approveItem, setApproveItem] = useState<ReviewQueueItem | null>(null);
  const [mergeItem, setMergeItem] = useState<ReviewQueueItem | null>(null);

  const loadQueue = useCallback(async () => {
    if (!token) return;
    setQueueLoading(true);
    try {
      const r = await fetchReviewQueue(token, { status: queueStatus, page: queuePage, limit: 20 });
      setQueue(r.data);
      setQueueTotal(r.pagination.total);
      setPendingCount(r.pendingCount);
    } catch { /* non-blocking */ }
    finally { setQueueLoading(false); }
  }, [token, queueStatus, queuePage]);

  const loadDictionary = useCallback(async () => {
    if (!token) return;
    setDictLoading(true);
    try {
      const r = await fetchDictionaryEntries(token, { search: dictSearch, category: dictCategory, page: dictPage, limit: 20 });
      setEntries(r.data);
      setDictTotal(r.pagination.total);
    } catch { /* non-blocking */ }
    finally { setDictLoading(false); }
  }, [token, dictSearch, dictCategory, dictPage]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { loadDictionary(); }, [loadDictionary]);

  const handleReject = async (id: string) => {
    if (!token) return;
    await rejectQueueItem(token, id);
    loadQueue();
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Delete this entry?')) return;
    await deleteDictionaryEntry(token, id);
    loadDictionary();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Language Dictionary</h1>
          <p className="text-sm text-gray-500 mt-1">Manage translations and review unknown terms from farmers.</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
            {pendingCount} pending review{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['queue', 'dictionary'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'queue' ? `Review Queue${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'Dictionary'}
          </button>
        ))}
      </div>

      {/* ── Review Queue Tab ── */}
      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected', 'merged'] as const).map((s) => (
              <button key={s} onClick={() => { setQueueStatus(s); setQueuePage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${queueStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {queueLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No {queueStatus} items.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Raw Input</th>
                    <th className="px-4 py-3 text-left">Normalized Key</th>
                    <th className="px-4 py-3 text-left">Page Context</th>
                    <th className="px-4 py-3 text-left">Submitted</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.rawInput}</td>
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">{item.normalizedKey}</td>
                      <td className="px-4 py-3">
                        {item.pageContext && (
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{item.pageContext}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => setApproveItem(item)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-md">Approve</button>
                            <button onClick={() => setMergeItem(item)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md">Merge</button>
                            <button onClick={() => handleReject(item._id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-md">Reject</button>
                          </div>
                        )}
                        {item.status !== 'pending' && (
                          <span className="text-xs text-gray-400 capitalize">{item.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {queueTotal > 20 && (
            <div className="flex gap-2 justify-end text-sm">
              <button disabled={queuePage === 1} onClick={() => setQueuePage((p) => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-gray-500">Page {queuePage} of {Math.ceil(queueTotal / 20)}</span>
              <button disabled={queuePage >= Math.ceil(queueTotal / 20)} onClick={() => setQueuePage((p) => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* ── Dictionary Tab ── */}
      {tab === 'dictionary' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              placeholder="Search by English term…"
              value={dictSearch}
              onChange={(e) => { setDictSearch(e.target.value); setDictPage(1); }}
            />
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={dictCategory}
              onChange={(e) => { setDictCategory(e.target.value); setDictPage(1); }}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {dictLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No entries found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">English</th>
                    <th className="px-4 py-3 text-left">Hindi</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Aliases</th>
                    <th className="px-4 py-3 text-left">Confidence</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((e) => (
                    <tr key={e._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.english}</td>
                      <td className="px-4 py-3 text-gray-700">{e.hindi}</td>
                      <td className="px-4 py-3">
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{e.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{e.aliases.slice(0, 4).join(', ')}{e.aliases.length > 4 ? '…' : ''}</td>
                      <td className="px-4 py-3 text-gray-500">{Math.round(e.confidence * 100)}%</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(e._id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-md">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dictTotal > 20 && (
            <div className="flex gap-2 justify-end text-sm">
              <button disabled={dictPage === 1} onClick={() => setDictPage((p) => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-gray-500">Page {dictPage} of {Math.ceil(dictTotal / 20)}</span>
              <button disabled={dictPage >= Math.ceil(dictTotal / 20)} onClick={() => setDictPage((p) => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {approveItem && (
        <ApproveModal
          item={approveItem}
          token={token!}
          onClose={() => setApproveItem(null)}
          onDone={() => { setApproveItem(null); loadQueue(); loadDictionary(); }}
        />
      )}
      {mergeItem && (
        <MergeModal
          item={mergeItem}
          token={token!}
          onClose={() => setMergeItem(null)}
          onDone={() => { setMergeItem(null); loadQueue(); }}
        />
      )}
    </div>
  );
}
