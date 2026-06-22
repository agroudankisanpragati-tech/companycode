'use client';

import { useEffect, useState } from 'react';
import { FaCheckCircle, FaDatabase, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import { API_BASE } from '@/components/admin/admin-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import { TableShell } from '@/components/admin/AdminUi';

export default function AdminSettingsPage() {
  const { session } = useAdmin();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/health`, { signal: AbortSignal.timeout(5000) });
        setHealthStatus(res.ok ? 'ok' : 'error');
      } catch {
        setHealthStatus('error');
      }
    };
    check();
  }, []);

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <TableShell title="System settings" subtitle="Backend and control-plane details for operators">
        <div className="space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-slate-400">API base URL</p>
            <p className="mt-1 font-semibold text-white">{API_BASE}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-slate-400">Signed in user</p>
            <p className="mt-1 font-semibold text-white">{session?.name}</p>
            <p className="text-slate-400">{session?.email}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-slate-400">Bootstrap admin</p>
            <p className="mt-2 leading-6 text-slate-300">
              Configure <span className="font-semibold text-cyan-300">ADMIN_EMAILS</span> and <span className="font-semibold text-cyan-300">ADMIN_PASSWORDS</span> in backend <code>.env</code> to auto-create admin users on startup.
            </p>
          </div>
        </div>
      </TableShell>

      <TableShell title="System status" subtitle="Live connection health and operational summary">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Backend API health</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
              {healthStatus === 'checking' && <><FaSpinner className="animate-spin text-slate-400" /><span className="text-slate-400">Checking...</span></>}
              {healthStatus === 'ok' && <><FaCheckCircle className="text-emerald-400" />Connected</>}
              {healthStatus === 'error' && <><FaTimesCircle className="text-red-400" /><span className="text-red-300">Unreachable</span></>}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Control surfaces</p>
            <ul className="mt-2 space-y-2 text-slate-300">
              <li>• User role and verification management</li>
              <li>• Crop recommendation moderation</li>
              <li>• Marketplace listing status control</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <FaDatabase className="text-cyan-300" />
              Admin shell connected to backend API
            </div>
          </div>
        </div>
      </TableShell>
    </section>
  );
}
