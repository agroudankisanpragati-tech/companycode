'use client';

import { useEffect, useState, useCallback } from 'react';
import { FaClipboardList, FaSearch, FaSpinner, FaSyncAlt } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchSchemeApplications, updateApplicationStatus, formatDate } from '@/components/admin/admin-api';
import type { SchemeApplication, SchemeApplicationStatus } from '@/components/admin/admin-types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '',             label: 'All Statuses' },
    { value: 'submitted',    label: '📋 Submitted' },
    { value: 'under_review', label: '🔄 Under Review' },
    { value: 'approved',     label: '✅ Approved' },
    { value: 'rejected',     label: '❌ Rejected' },
];

const STATUS_STYLES: Record<SchemeApplicationStatus, string> = {
    submitted:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    under_review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    approved:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    rejected:     'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_LABELS: Record<SchemeApplicationStatus, string> = {
    submitted:    '📋 Submitted',
    under_review: '🔄 Under Review',
    approved:     '✅ Approved',
    rejected:     '❌ Rejected',
};

export default function SchemeApplicationsPage() {
    const { token } = useAdmin();

    const [applications, setApplications] = useState<SchemeApplication[]>([]);
    const [total, setTotal]               = useState(0);
    const [page, setPage]                 = useState(1);
    const [pages, setPages]               = useState(1);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');
    const [success, setSuccess]           = useState('');

    const [filterStatus, setFilterStatus] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const [updating, setUpdating]         = useState<string | null>(null);

    const load = useCallback(async (p = 1) => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetchSchemeApplications(token, {
                page: p, limit: 20,
                status: filterStatus || undefined,
                search: filterSearch.trim() || undefined,
            });
            setApplications(res.data);
            setTotal(res.total);
            setPage(res.page);
            setPages(res.pages);
        } catch (e: any) {
            setError(e.message || 'Failed to load applications');
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, filterSearch]);

    useEffect(() => { void load(1); }, [load]);

    const handleStatusChange = async (id: string, status: string) => {
        if (!token) return;
        setUpdating(id);
        setError('');
        setSuccess('');
        try {
            await updateApplicationStatus(token, id, status);
            setSuccess(`Status updated to "${STATUS_LABELS[status as SchemeApplicationStatus]}" — SMS sent to applicant.`);
            setApplications(prev => prev.map(a => a._id === id ? { ...a, status: status as SchemeApplicationStatus } : a));
        } catch (e: any) {
            setError(e.message || 'Status update failed');
        } finally {
            setUpdating(null);
        }
    };

    const maskAccount = (acc = '') =>
        acc.length > 4 ? '*'.repeat(acc.length - 4) + acc.slice(-4) : acc;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <FaClipboardList className="text-emerald-400 text-2xl" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Scheme Applications</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {total} total · Seva Mitra citizen submissions
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => load(page)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                    <FaSyncAlt size={12} /> Refresh
                </button>
            </div>

            {success && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
            {error   && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            {/* Filters */}
            <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                    <input
                        className="admin-input pl-8 w-full text-sm py-2"
                        placeholder="Search by name, phone, receipt, scheme..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && load(1)}
                    />
                </div>
                <select
                    className="admin-input text-sm py-2"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <section className="glass-panel rounded-3xl p-5 overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                        <FaSpinner className="animate-spin text-emerald-400" /> Loading applications...
                    </div>
                ) : applications.length === 0 ? (
                    <p className="text-center py-16 text-slate-500 text-sm">No applications found.</p>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                                <th className="pb-3 pr-4">Applicant</th>
                                <th className="pb-3 pr-4">Scheme</th>
                                <th className="pb-3 pr-4">Receipt</th>
                                <th className="pb-3 pr-4">Bank / IFSC</th>
                                <th className="pb-3 pr-4">Date</th>
                                <th className="pb-3 pr-4">Status</th>
                                <th className="pb-3">Update Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {applications.map(app => (
                                <tr key={app._id} className="hover:bg-white/[0.02] transition">
                                    <td className="py-3 pr-4">
                                        <p className="font-semibold text-white">{app.profile?.name || '—'}</p>
                                        <p className="text-xs text-slate-500">{app.phone}</p>
                                        <p className="text-xs text-slate-600">{app.profile?.district}, {app.profile?.stateName}</p>
                                    </td>
                                    <td className="py-3 pr-4 max-w-[180px]">
                                        <p className="text-white font-medium line-clamp-2 text-xs">{app.schemeTitle}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{app.profile?.occupation} · {app.profile?.category?.toUpperCase()}</p>
                                    </td>
                                    <td className="py-3 pr-4 font-mono text-xs text-slate-300">{app.receiptNumber}</td>
                                    <td className="py-3 pr-4 text-xs text-slate-400">
                                        <p>{maskAccount(app.applyData?.bankAccount)}</p>
                                        <p className="text-slate-500">{app.applyData?.ifsc || '—'}</p>
                                        {app.applyData?.mutationNumber && (
                                            <p className="text-slate-600">Mut: {app.applyData.mutationNumber}</p>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                                        {formatDate(app.submittedAt)}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLES[app.status]}`}>
                                            {STATUS_LABELS[app.status]}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <select
                                            value={app.status}
                                            disabled={updating === app._id}
                                            onChange={e => handleStatusChange(app._id, e.target.value)}
                                            className="admin-input text-xs py-1.5 min-w-[140px] disabled:opacity-50"
                                        >
                                            <option value="submitted">📋 Submitted</option>
                                            <option value="under_review">🔄 Under Review</option>
                                            <option value="approved">✅ Approved</option>
                                            <option value="rejected">❌ Rejected</option>
                                        </select>
                                        {updating === app._id && (
                                            <FaSpinner className="animate-spin text-emerald-400 mt-1 ml-1 inline" size={10} />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => load(page - 1)}
                        className="admin-button-secondary px-4 py-2 text-sm disabled:opacity-40"
                    >
                        ← Prev
                    </button>
                    <span className="text-sm text-slate-400">Page {page} of {pages}</span>
                    <button
                        disabled={page >= pages}
                        onClick={() => load(page + 1)}
                        className="admin-button-secondary px-4 py-2 text-sm disabled:opacity-40"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
