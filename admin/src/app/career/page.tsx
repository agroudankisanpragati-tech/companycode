'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FaBriefcase, FaUsers, FaMoneyBillWave, FaBan, FaFilePdf,
  FaQrcode, FaTrash, FaSync, FaCopy, FaEye, FaPrint,
  FaUpload, FaSearch, FaFilter, FaDownload, FaCheckCircle,
} from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard } from '@/components/admin/AdminUi';
import {
  fetchCareerStats, fetchCertificates, createCertificate,
  deleteCertificate, regenerateCertificate,
  fetchCertificateAssets, uploadCertificateAssets,
  formatDate, ASSET_BASE,
  type InternCertificate, type CareerStats, type CertificateAsset,
} from '@/components/admin/admin-api';

const ASSET_FIXED_PATHS: Record<string, string> = {
  companyLogo:      'uploads/certificates/assets/company-logo.png',
  founderSignature: 'uploads/certificates/assets/founder-signature.png',
  companySeal:      'uploads/certificates/assets/company-seal.png',
};

const DOMAINS = [
  'Web Development', 'Frontend Development', 'Backend Development',
  'Full Stack Development', 'AI & Machine Learning', 'Digital Marketing',
  'Graphic Design', 'UI/UX Design', 'Business Development', 'Sales',
  'Data Analytics', 'Content Writing', 'Other',
];

const DURATIONS = ['1 Month', '2 Months', '3 Months', '6 Months', 'Custom'];

const emptyForm = {
  name: '', collegeName: '', internshipDomain: '', internshipType: 'Unpaid',
  duration: '', startDate: '', endDate: '', email: '', phone: '', remarks: '',
};

export default function CareerPage() {
  const { token } = useAdmin();

  const [stats, setStats]           = useState<CareerStats | null>(null);
  const [certs, setCerts]           = useState<InternCertificate[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [assets, setAssets]         = useState<Partial<CertificateAsset>>({});
  const [form, setForm]             = useState({ ...emptyForm });
  const [customDuration, setCustomDuration] = useState('');
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [loading, setLoading]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [preview, setPreview]       = useState<InternCertificate | null>(null);
  const logoRef  = useRef<HTMLInputElement>(null);
  const sigRef   = useRef<HTMLInputElement>(null);
  const sealRef  = useRef<HTMLInputElement>(null);

  const notify = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const loadAll = async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsRes, certsRes, assetsRes] = await Promise.all([
        fetchCareerStats(token),
        fetchCertificates(token, {
          page, search, internshipType: filterType,
          domain: filterDomain, year: filterYear,
        }),
        fetchCertificateAssets(token),
      ]);
      setStats(statsRes.data);
      setCerts(certsRes.data);
      setPagination({ total: certsRes.pagination.total, page: certsRes.pagination.page, pages: certsRes.pagination.pages });
      setAssets(assetsRes.data || {});
    } catch (e: any) {
      notify(e.message || 'Failed to load data', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [token, search, filterType, filterDomain, filterYear]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGenerating(true);
    try {
      const payload = {
        ...form,
        duration: form.duration === 'Custom' ? customDuration : form.duration,
      };
      await createCertificate(token, payload);
      notify('Certificate generated successfully!');
      setForm({ ...emptyForm });
      setCustomDuration('');
      loadAll();
    } catch (e: any) {
      notify(e.message || 'Failed to generate certificate', true);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !window.confirm('Delete this certificate permanently?')) return;
    try {
      await deleteCertificate(token, id);
      notify('Certificate deleted');
      loadAll();
    } catch (e: any) {
      notify(e.message || 'Delete failed', true);
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!token) return;
    try {
      await regenerateCertificate(token, id);
      notify('Certificate regenerated');
      loadAll();
    } catch (e: any) {
      notify(e.message || 'Regenerate failed', true);
    }
  };

  const handleAssetUpload = async (field: 'companyLogo' | 'founderSignature' | 'companySeal', file: File) => {
    if (!token) return;
    setAssetUploading(true);
    try {
      const fd = new FormData();
      fd.append(field, file);
      const res = await uploadCertificateAssets(token, fd);
      setAssets(res.data || {});
      const labels: Record<string, string> = { companyLogo: 'Logo', founderSignature: 'Signature', companySeal: 'Seal' };
      notify(`${labels[field] || field} uploaded successfully`);
    } catch (e: any) {
      notify(e.message || 'Upload failed', true);
    } finally {
      setAssetUploading(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    notify('Verification link copied!');
  };

  const inputCls = 'w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30';
  const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error   && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {success && <div className="rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-200 flex items-center gap-2"><FaCheckCircle />{success}</div>}

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Interns"          value={stats?.total     ?? 0} icon={FaUsers}          accent="from-cyan-500 to-blue-500" />
        <StatCard title="Paid Interns"           value={stats?.paid      ?? 0} icon={FaMoneyBillWave}  accent="from-green-500 to-emerald-500" />
        <StatCard title="Unpaid Interns"         value={stats?.unpaid    ?? 0} icon={FaBan}            accent="from-amber-500 to-orange-500" />
        <StatCard title="Certificates Generated" value={stats?.generated ?? 0} icon={FaFilePdf}        accent="from-purple-500 to-violet-500" />
      </section>

      {/* Certificate Assets */}
      <section className="glass-panel rounded-3xl p-5 md:p-6">
        <h3 className="text-lg font-bold text-white mb-1">Certificate Assets</h3>
        <p className="text-xs text-slate-400 mb-1">Upload once — automatically used on every certificate. Re-upload to replace. Files are saved with fixed names and never need re-uploading.</p>
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          {(['companyLogo', 'founderSignature', 'companySeal'] as const).map(field => {
            const labels = { companyLogo: 'Company Logo', founderSignature: 'Founder Signature', companySeal: 'Company Seal' };
            const refs   = { companyLogo: logoRef, founderSignature: sigRef, companySeal: sealRef };
            const urlKey = field as keyof typeof assets;
            const assetUrl = (assets as any)[urlKey] as string | undefined;
            return (
              <div key={field} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <p className={labelCls}>{labels[field]}</p>
                <p className="font-mono text-[10px] text-slate-500 mb-2 truncate">{ASSET_FIXED_PATHS[field]}</p>
                {assetUrl ? (
                  <img src={`${ASSET_BASE}${assetUrl}?t=${Date.now()}`} alt={labels[field]}
                    className="h-14 object-contain mb-3 bg-white/5 rounded-lg p-1.5 w-full" />
                ) : (
                  <div className="h-14 flex items-center justify-center rounded-lg border border-dashed border-white/10 text-slate-500 text-xs mb-3">Not uploaded</div>
                )}
                <input ref={refs[field]} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => e.target.files?.[0] && handleAssetUpload(field, e.target.files[0])} />
                <button onClick={() => refs[field].current?.click()} disabled={assetUploading}
                  className="flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs font-semibold text-white transition w-full justify-center">
                  <FaUpload size={10} /> {assetUploading ? 'Uploading...' : `Upload ${labels[field]}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">📁 Stored at: <span className="font-mono text-slate-400">backend/uploads/certificates/assets/</span> — fixed filenames, always overwritten on re-upload.</p>
      </section>

      {/* Generate Certificate Form */}
      <section className="glass-panel rounded-3xl p-5 md:p-6">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><FaBriefcase className="text-cyan-400" /> Generate Internship Certificate</h3>
        <p className="text-xs text-slate-400 mb-5">Fill in the details below. Certificate number, QR code, and PDF are auto-generated.</p>
        <form onSubmit={handleGenerate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input className={inputCls} placeholder="Intern full name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>College / University *</label>
            <input className={inputCls} placeholder="College name" value={form.collegeName}
              onChange={e => setForm(f => ({ ...f, collegeName: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Internship Domain *</label>
            <select className={inputCls} value={form.internshipDomain}
              onChange={e => setForm(f => ({ ...f, internshipDomain: e.target.value }))} required>
              <option value="">Select domain</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Duration *</label>
            <select className={inputCls} value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} required>
              <option value="">Select duration</option>
              {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {form.duration === 'Custom' && (
            <div>
              <label className={labelCls}>Custom Duration *</label>
              <input className={inputCls} placeholder="e.g. 45 Days" value={customDuration}
                onChange={e => setCustomDuration(e.target.value)} required />
            </div>
          )}
          <div>
            <label className={labelCls}>Internship Type *</label>
            <select className={inputCls} value={form.internshipType}
              onChange={e => setForm(f => ({ ...f, internshipType: e.target.value }))} required>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Start Date *</label>
            <input type="date" className={inputCls} value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>End Date *</label>
            <input type="date" className={inputCls} value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Email (Optional)</label>
            <input type="email" className={inputCls} placeholder="intern@email.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Phone (Optional)</label>
            <input className={inputCls} placeholder="+91 XXXXX XXXXX" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Remarks (Optional)</label>
            <textarea className={inputCls} rows={2} placeholder="Any additional remarks..." value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={generating}
              className="admin-button-primary px-6 py-3 flex items-center gap-2">
              <FaFilePdf />
              {generating ? 'Generating Certificate...' : 'Generate Certificate'}
            </button>
          </div>
        </form>
      </section>

      {/* Certificates Table */}
      <section className="glass-panel rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Certificates</h3>
            <p className="text-xs text-slate-400">{pagination.total} total records</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={11} />
              <input className="rounded-xl border border-white/10 bg-slate-900/60 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none w-44"
                placeholder="Search name, cert no..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Type filter */}
            <select className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white focus:outline-none"
              value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            {/* Year filter */}
            <select className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white focus:outline-none"
              value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            {/* Domain filter */}
            <select className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white focus:outline-none"
              value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
              <option value="">All Domains</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          </div>
        ) : certs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No certificates found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  {['Cert No.', 'Name', 'College', 'Domain', 'Duration', 'Type', 'Issue Date', 'Actions'].map(h => (
                    <th key={h} className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {certs.map(cert => (
                  <tr key={cert._id} className="hover:bg-white/2 transition">
                    <td className="py-3 pr-4 font-mono text-xs text-cyan-400">{cert.certificateNumber}</td>
                    <td className="py-3 pr-4 font-semibold text-white">{cert.name}</td>
                    <td className="py-3 pr-4 text-slate-300 max-w-[140px] truncate">{cert.collegeName}</td>
                    <td className="py-3 pr-4 text-slate-300">{cert.internshipDomain}</td>
                    <td className="py-3 pr-4 text-slate-300">{cert.duration}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cert.internshipType === 'Paid' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {cert.internshipType}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(cert.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* View */}
                        <button title="View" onClick={() => setPreview(cert)}
                          className="rounded-lg bg-slate-700 hover:bg-slate-600 p-1.5 text-slate-300 hover:text-white transition">
                          <FaEye size={11} />
                        </button>
                        {/* Download PDF */}
                        {cert.pdfUrl && (
                          <a href={`${ASSET_BASE}${cert.pdfUrl}`} target="_blank" rel="noreferrer" title="Download PDF"
                            className="rounded-lg bg-blue-600/20 hover:bg-blue-600/40 p-1.5 text-blue-400 hover:text-blue-300 transition">
                            <FaDownload size={11} />
                          </a>
                        )}
                        {/* Print */}
                        {cert.pdfUrl && (
                          <a href={`${ASSET_BASE}${cert.pdfUrl}`} target="_blank" rel="noreferrer" title="Print"
                            className="rounded-lg bg-slate-700 hover:bg-slate-600 p-1.5 text-slate-300 hover:text-white transition"
                            onClick={e => { e.preventDefault(); const w = window.open(`${ASSET_BASE}${cert.pdfUrl}`); w?.print(); }}>
                            <FaPrint size={11} />
                          </a>
                        )}
                        {/* Copy verification link */}
                        <button title="Copy Verification Link" onClick={() => copyLink(cert.verificationUrl)}
                          className="rounded-lg bg-slate-700 hover:bg-slate-600 p-1.5 text-slate-300 hover:text-white transition">
                          <FaCopy size={11} />
                        </button>
                        {/* Regenerate */}
                        <button title="Regenerate" onClick={() => handleRegenerate(cert._id)}
                          className="rounded-lg bg-amber-600/20 hover:bg-amber-600/40 p-1.5 text-amber-400 hover:text-amber-300 transition">
                          <FaSync size={11} />
                        </button>
                        {/* Delete */}
                        <button title="Delete" onClick={() => handleDelete(cert._id)}
                          className="rounded-lg bg-red-600/20 hover:bg-red-600/40 p-1.5 text-red-400 hover:text-red-300 transition">
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
        {pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => loadAll(pagination.page - 1)}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-white disabled:opacity-40 hover:bg-white/5 transition">
                Previous
              </button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => loadAll(pagination.page + 1)}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-white disabled:opacity-40 hover:bg-white/5 transition">
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="glass-panel rounded-3xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Certificate Preview</h3>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Certificate No." value={preview.certificateNumber} mono />
              <Row label="Intern Name"     value={preview.name} />
              <Row label="College"         value={preview.collegeName} />
              <Row label="Domain"          value={preview.internshipDomain} />
              <Row label="Duration"        value={preview.duration} />
              <Row label="Type"            value={preview.internshipType} />
              <Row label="Issue Date"      value={formatDate(preview.createdAt)} />
              <Row label="Intern ID"       value={preview.internId} mono />
            </div>
            {preview.qrCodeUrl && (
              <div className="flex justify-center">
                <img src={`${ASSET_BASE}${preview.qrCodeUrl}`} alt="QR Code" className="w-28 h-28 rounded-xl bg-white p-1" />
              </div>
            )}
            <p className="text-xs text-slate-400 leading-relaxed">{preview.certificateDescription}</p>
            <div className="flex gap-2 flex-wrap">
              {preview.pdfUrl && (
                <a href={`${ASSET_BASE}${preview.pdfUrl}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition">
                  <FaDownload size={11} /> Download PDF
                </a>
              )}
              <button onClick={() => copyLink(preview.verificationUrl)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs font-semibold text-white transition">
                <FaCopy size={11} /> Copy Verify Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1.5">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className={`text-white text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
