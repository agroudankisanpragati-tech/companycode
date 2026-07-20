'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchKVKList, toggleKVKStatus, deleteKVK } from '@/components/admin/admin-api';
import { StatCard } from '@/components/admin/AdminUi';
import type { KVKRecord, KVKSummary } from '@/components/admin/admin-types';
import AdminKVKForm from '@/components/kvk/AdminKVKForm';
import AdminKVKTable from '@/components/kvk/AdminKVKTable';
import {
  FaMapMarkerAlt, FaPlus, FaToggleOn, FaToggleOff,
  FaSearch, FaTimes,
} from 'react-icons/fa';

export default function KVKManagementPage() {
  const { token } = useAdmin();

  const [kvks, setKvks] = useState<KVKRecord[]>([]);
  const [summary, setSummary] = useState<KVKSummary | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [page, setPage] = useState(1);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<KVKRecord | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchKVKList(token, {
        page, limit: 20, search, state: filterState, district: filterDistrict, isActive: filterActive,
      });
      setKvks(res.data);
      setSummary(res.summary);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load KVK list');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, filterState, filterDistrict, filterActive]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (kvk: KVKRecord) => {
    if (!token) return;
    try {
      await toggleKVKStatus(token, kvk._id);
      setSuccess(`${kvk.name} ${kvk.isActive ? 'disabled' : 'enabled'}`);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (kvk: KVKRecord) => {
    if (!token || !window.confirm(`Delete "${kvk.name}"? This cannot be undone.`)) return;
    try {
      await deleteKVK(token, kvk._id);
      setSuccess('KVK deleted successfully');
      load();
    } catch (e: any) { setError(e.message); }
  };

  const openAdd  = () => { setEditing(null); setShowModal(true); };
  const openEdit = (k: KVKRecord) => { setEditing(k); setShowModal(true); };
  const onSaved  = () => { setSuccess('KVK saved successfully'); load(); };

  // Auto-clear messages
  useEffect(() => {
    if (!success && !error) return;
    const t = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
    return () => clearTimeout(t);
  }, [success, error]);

  const inputCls = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none transition';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">KVK Management</h1>
          <p className="mt-1 text-sm text-slate-400">Manage Krishi Vigyan Kendra centers across India</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90 transition"
        >
          <FaPlus size={12} /> Add KVK Center
        </button>
      </div>

      {/* Toast messages */}
      {success && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Total KVK"  value={summary.total}         icon={FaMapMarkerAlt} accent="from-cyan-500 to-blue-500" />
          <StatCard title="Active"     value={summary.active}        icon={FaToggleOn}     accent="from-emerald-500 to-teal-500" />
          <StatCard title="Inactive"   value={summary.inactive}      icon={FaToggleOff}    accent="from-slate-500 to-slate-600" />
          <StatCard title="Districts"  value={summary.districtCount} icon={FaMapMarkerAlt} accent="from-amber-400 to-orange-500" />
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
            <input
              className={`${inputCls} w-full pl-8`}
              placeholder="Search KVK name, district..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <input className={inputCls} placeholder="Filter by State" value={filterState}
            onChange={e => { setFilterState(e.target.value); setPage(1); }} />
          <input className={inputCls} placeholder="Filter by District" value={filterDistrict}
            onChange={e => { setFilterDistrict(e.target.value); setPage(1); }} />
          <select className={inputCls} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {(search || filterState || filterDistrict || filterActive) && (
            <button
              onClick={() => { setSearch(''); setFilterState(''); setFilterDistrict(''); setFilterActive(''); setPage(1); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <FaTimes size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-white">KVK Centers</h3>
          <span className="text-xs text-slate-400">{pagination.total} total</span>
        </div>

        <AdminKVKTable
          kvks={kvks}
          summary={summary}
          pagination={pagination}
          loading={loading}
          page={page}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      {/* Add/Edit Modal */}
      {showModal && token && (
        <AdminKVKForm
          editing={editing}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
