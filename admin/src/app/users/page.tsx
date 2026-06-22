'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaUsers, FaUserShield, FaCheckCircle, FaToggleOn, FaToggleOff,
  FaSearch, FaEye, FaTrash, FaUserCheck, FaUserTimes, FaTimes,
  FaSyncAlt, FaChevronLeft, FaChevronRight, FaSeedling, FaRobot,
} from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard } from '@/components/admin/AdminUi';
import { fetchAdminUsers } from '@/components/admin/admin-api';
import { formatDate } from '@/components/admin/admin-api';
import type { AdminUser, UserSummary, UserPagination } from '@/components/admin/admin-types';

const PAGE_SIZE = 20;

function DetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Full Name', user.name],
    ['Email', user.email],
    ['Mobile', user.phone || '—'],
    ['Role', user.role],
    ['Account Status', user.isActive ? 'Active' : 'Disabled'],
    ['Verification', user.verified ? 'Verified' : 'Unverified'],
    ['Registration Date', formatDate(user.createdAt)],
    ['Last Login', formatDate(user.lastLogin)],
    ['Location', [user.location?.village, user.location?.district, user.location?.state].filter(Boolean).join(', ') || '—'],
    ['Farm Size', user.farmSize ? `${user.farmSize} acres` : '—'],
    ['Points', String(user.points ?? 0)],
    ['Crops', user.crops?.join(', ') || '—'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">User Details</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <FaTimes />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2 border-b border-white/5 pb-2">
              <span className="w-40 shrink-0 text-slate-400">{label}</span>
              <span className="text-white break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { token, pendingAction, updateUserRole, toggleVerification, disableUser, deleteUser, userSummary: ctxSummary } = useAdmin();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(ctxSummary);
  const [pagination, setPagination] = useState<UserPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [page, setPage] = useState(1);

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminUsers(token, {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        verified: verifiedFilter || undefined,
      });
      setUsers(res.data);
      setPagination(res.pagination);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedSearch, roleFilter, verifiedFilter]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [roleFilter, verifiedFilter]);

  const summaryCards = useMemo(() => [
    { title: 'Total Users', value: summary?.total ?? 0, icon: FaUsers, accent: 'from-cyan-500 to-blue-500' },
    { title: 'Farmers', value: summary?.farmers ?? 0, icon: FaSeedling, accent: 'from-emerald-500 to-teal-500' },
    { title: 'Admins', value: summary?.admins ?? 0, icon: FaUserShield, accent: 'from-fuchsia-500 to-pink-500' },
    { title: 'Verified', value: summary?.verified ?? 0, icon: FaCheckCircle, accent: 'from-amber-400 to-orange-500' },
    { title: 'Active Users', value: summary?.active ?? 0, icon: FaToggleOn, accent: 'from-indigo-500 to-violet-500' },
  ], [summary]);

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    void loadUsers();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} accent={card.accent} />
        ))}
      </div>

      {/* Main Table Panel */}
      <section className="glass-panel rounded-3xl p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">User Management</h3>
            <p className="mt-1 text-sm text-slate-400">
              {pagination ? `${pagination.total} registered users` : 'Live data from MongoDB'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="admin-button-secondary text-xs"
            disabled={loading}
          >
            <FaSyncAlt className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search name, email, mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input pl-8 py-2 text-sm w-full"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Roles</option>
            <option value="farmer">Farmer</option>
            <option value="vendor">Vendor</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No users found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-4 pr-4 font-medium">Name</th>
                    <th className="pb-4 pr-4 font-medium">Email</th>
                    <th className="pb-4 pr-4 font-medium hidden md:table-cell">Mobile</th>
                    <th className="pb-4 pr-4 font-medium">Role</th>
                    <th className="pb-4 pr-4 font-medium">Status</th>
                    <th className="pb-4 pr-4 font-medium hidden lg:table-cell">Verified</th>
                    <th className="pb-4 pr-4 font-medium hidden xl:table-cell">Registered</th>
                    <th className="pb-4 pr-4 font-medium hidden xl:table-cell">Last Login</th>
                    <th className="pb-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.map((user) => (
                    <tr key={user._id} className="align-top text-slate-200">
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-white">{user.name}</p>
                        <p className="text-xs text-slate-400">Points: {user.points ?? 0}</p>
                      </td>
                      <td className="py-4 pr-4 text-slate-300 text-xs">{user.email}</td>
                      <td className="py-4 pr-4 text-slate-300 hidden md:table-cell">{user.phone || '—'}</td>
                      <td className="py-4 pr-4">
                        <select
                          className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
                          aria-label={`Change role for ${user.name}`}
                          value={user.role}
                          onChange={(e) => handleAction(() => updateUserRole(user._id, e.target.value as AdminUser['role']))}
                          disabled={pendingAction === `role-${user._id}`}
                        >
                          <option value="farmer">Farmer</option>
                          <option value="vendor">Vendor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-4 pr-4 hidden lg:table-cell">
                        <button
                          type="button"
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${user.verified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-300'}`}
                          onClick={() => handleAction(() => toggleVerification(user._id, !user.verified))}
                          disabled={pendingAction === `verify-${user._id}`}
                        >
                          {user.verified ? 'Verified' : 'Unverified'}
                        </button>
                      </td>
                      <td className="py-4 pr-4 text-slate-300 text-xs hidden xl:table-cell">{formatDate(user.createdAt)}</td>
                      <td className="py-4 pr-4 text-slate-300 text-xs hidden xl:table-cell">{formatDate(user.lastLogin)}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            title="View Details"
                            className="admin-button-secondary text-xs px-2"
                            onClick={() => setDetailUser(user)}
                          >
                            <FaEye />
                          </button>
                          <button
                            type="button"
                            title={user.verified ? 'Unverify' : 'Verify'}
                            className="admin-button-secondary text-xs px-2"
                            onClick={() => handleAction(() => toggleVerification(user._id, !user.verified))}
                            disabled={pendingAction === `verify-${user._id}`}
                          >
                            {user.verified ? <FaUserTimes /> : <FaUserCheck />}
                          </button>
                          <button
                            type="button"
                            title={user.isActive ? 'Disable User' : 'Enable User'}
                            className="admin-button-secondary text-xs px-2"
                            onClick={() => handleAction(() => disableUser(user._id, !user.isActive))}
                            disabled={pendingAction === `disable-${user._id}`}
                          >
                            {user.isActive ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff className="text-red-400" />}
                          </button>
                          <button
                            type="button"
                            title="Delete User"
                            className="admin-button-secondary text-xs px-2 hover:border-red-400/40 hover:text-red-300"
                            onClick={() => handleAction(() => deleteUser(user._id))}
                            disabled={pendingAction === `delete-user-${user._id}`}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
                <p>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="admin-button-secondary text-xs px-3"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <FaChevronLeft />
                  </button>
                  <span className="px-2 py-1 text-white">
                    {page} / {pagination.pages}
                  </span>
                  <button
                    type="button"
                    className="admin-button-secondary text-xs px-3"
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                  >
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Detail Modal */}
      {detailUser && <DetailModal user={detailUser} onClose={() => setDetailUser(null)} />}
    </div>
  );
}
