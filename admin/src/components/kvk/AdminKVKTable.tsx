'use client';

import {
  FaMapMarkerAlt, FaEdit, FaTrash, FaToggleOn, FaToggleOff,
  FaPhone, FaEnvelope, FaSpinner,
} from 'react-icons/fa';
import { ASSET_BASE } from '@/components/admin/admin-api';
import type { KVKRecord, KVKSummary } from '@/components/admin/admin-types';

interface Props {
  kvks: KVKRecord[];
  summary: KVKSummary | null;
  pagination: { total: number; page: number; limit: number; pages: number };
  loading: boolean;
  page: number;
  onEdit: (kvk: KVKRecord) => void;
  onToggle: (kvk: KVKRecord) => void;
  onDelete: (kvk: KVKRecord) => void;
  onPageChange: (p: number) => void;
}

export default function AdminKVKTable({
  kvks, pagination, loading, page,
  onEdit, onToggle, onDelete, onPageChange,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
        <FaSpinner className="animate-spin" size={20} />
        <span className="text-sm">Loading KVK centers...</span>
      </div>
    );
  }

  if (kvks.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl mb-3">📍</p>
        <p className="text-slate-400 font-semibold">No KVK centers found</p>
        <p className="text-slate-500 text-sm mt-1">Add your first KVK center using the button above.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              {['KVK Name', 'District / State', 'Contact', 'Coordinates', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {kvks.map(kvk => (
              <tr key={kvk._id} className="hover:bg-white/[0.03] transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {kvk.photoUrl ? (
                      <img
                        src={`${ASSET_BASE}${kvk.photoUrl}`}
                        alt={kvk.name}
                        className="h-9 w-9 rounded-xl object-cover border border-white/10 flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <FaMapMarkerAlt className="text-cyan-400" size={14} />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-white leading-tight">{kvk.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{kvk.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="text-white font-medium">{kvk.district}</p>
                  <p className="text-xs text-slate-400">{kvk.state}{kvk.pincode ? ` — ${kvk.pincode}` : ''}</p>
                </td>
                <td className="px-5 py-4">
                  {kvk.phone && (
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs">
                      <FaPhone size={9} className="text-emerald-400" /> {kvk.phone}
                    </div>
                  )}
                  {kvk.email && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                      <FaEnvelope size={9} className="text-blue-400" />
                      <span className="truncate max-w-[140px]">{kvk.email}</span>
                    </div>
                  )}
                  {!kvk.phone && !kvk.email && <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-5 py-4">
                  <p className="text-xs text-slate-400 font-mono">
                    {kvk.latitude.toFixed(4)}, {kvk.longitude.toFixed(4)}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${kvk.latitude},${kvk.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition mt-0.5 block"
                  >
                    View on Maps ↗
                  </a>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    kvk.isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${kvk.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {kvk.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEdit(kvk)}
                      title="Edit"
                      className="rounded-lg p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition"
                    >
                      <FaEdit size={13} />
                    </button>
                    <button
                      onClick={() => onToggle(kvk)}
                      title={kvk.isActive ? 'Disable' : 'Enable'}
                      className={`rounded-lg p-2 transition ${
                        kvk.isActive
                          ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-400/10'
                          : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10'
                      }`}
                    >
                      {kvk.isActive ? <FaToggleOn size={15} /> : <FaToggleOff size={15} />}
                    </button>
                    <button
                      onClick={() => onDelete(kvk)}
                      title="Delete"
                      className="rounded-lg p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
          <p className="text-xs text-slate-400">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
