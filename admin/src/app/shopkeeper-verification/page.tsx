'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Eye, MapPin, FileText, Store, Shield } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');
const TOKEN_KEY = 'kisan-unnati-admin-token';

type Tab = 'pending' | 'verified' | 'rejected';

export default function VerificationCenterPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [allowReApp, setAllowReApp] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    const tok = localStorage.getItem(TOKEN_KEY);
    const r = await fetch(`${API}/admin/shopkeeper/verification/${tab}`, { headers: { Authorization: `Bearer ${tok}` } });
    const d = await r.json();
    setShops(d.shops || []);
    setLoading(false);
  };

  const tok = () => localStorage.getItem(TOKEN_KEY) || '';

  const approve = async (id: string) => {
    setActing(true);
    await fetch(`${API}/admin/shopkeeper/verification/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${tok()}` } });
    setSelected(null);
    await load();
    setActing(false);
  };

  const reject = async (id: string) => {
    setActing(true);
    await fetch(`${API}/admin/shopkeeper/verification/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ rejectionReason: rejectReason, allowReApplication: allowReApp }),
    });
    setSelected(null);
    setRejectReason('');
    await load();
    setActing(false);
  };

  const tabs: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: 'pending', label: 'Pending Requests', icon: Clock, color: 'text-amber-500' },
    { key: 'verified', label: 'Verified Shops', icon: CheckCircle, color: 'text-emerald-500' },
    { key: 'rejected', label: 'Rejected Shops', icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6 text-emerald-400" />Verification Center</h1>
        <p className="text-slate-400 text-sm mt-1">Review and manage shop verification requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-2xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon className={`w-4 h-4 ${tab === t.key ? t.color : ''}`} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Shops List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 glass-panel rounded-2xl animate-pulse" />)}</div>
      ) : shops.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No {tab} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map(shop => (
            <div key={shop._id} className="glass-panel rounded-2xl p-5 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    {shop.profileImage ? (
                      <img src={`${API_BASE}${shop.profileImage}`} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <Store className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold">{shop.shopName || 'Unnamed Shop'}</p>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${shop.shopType === 'nursery' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {shop.shopType === 'nursery' ? 'Nursery' : 'Fertilizer'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{shop.ownerName} · {(shop.userId as any)?.phone}</p>
                    <p className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                      <MapPin className="w-3 h-3" />{[shop.village, shop.district, shop.state].filter(Boolean).join(', ')}
                    </p>
                    {shop.gstNumber && <p className="text-xs text-slate-500 mt-1">GST: <span className="text-slate-300">{shop.gstNumber}</span></p>}
                    {shop.rejectionReason && <p className="text-xs text-red-400 mt-1">Reason: {shop.rejectionReason}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => setSelected(shop)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-medium transition-colors">
                    <Eye className="w-3.5 h-3.5" />View
                  </button>
                  {tab === 'pending' && (
                    <>
                      <button onClick={() => approve(shop._id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />Approve
                      </button>
                      <button onClick={() => setSelected({ ...shop, _rejecting: true })} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-semibold transition-colors">
                        <XCircle className="w-3.5 h-3.5" />Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail / Reject Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{selected._rejecting ? 'Reject Shop' : 'Shop Details'}</h2>
              <button onClick={() => { setSelected(null); setRejectReason(''); }} className="p-2 rounded-xl hover:bg-white/10 text-slate-400">✕</button>
            </div>

            {!selected._rejecting ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Shop Name', selected.shopName],
                    ['Owner', selected.ownerName],
                    ['Type', selected.shopType],
                    ['Mobile', selected.mobileNumber],
                    ['Email', selected.email],
                    ['District', selected.district],
                    ['State', selected.state],
                    ['GST Number', selected.gstNumber],
                    ['License No.', selected.shopLicenseNumber],
                    ['GPS', selected.latitude ? `${selected.latitude}, ${selected.longitude}` : 'Not set'],
                  ].map(([k, v]) => v ? (
                    <div key={k} className="bg-white/5 rounded-xl p-3">
                      <p className="text-slate-500 text-[11px] uppercase font-semibold">{k}</p>
                      <p className="text-slate-200 mt-0.5">{v}</p>
                    </div>
                  ) : null)}
                </div>

                {/* Documents */}
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-semibold uppercase">Submitted Documents</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      ['GST Certificate', selected.gstCertificate],
                      ['Shop Registration', selected.shopRegistrationImage],
                      ['Nursery Photo', selected.nurseryPhoto],
                      ['Nursery Certificate', selected.nurseryRegistrationCertificate],
                    ].filter(([, v]) => v).map(([label, path]) => (
                      <a key={label} href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-medium transition-colors">
                        <FileText className="w-3.5 h-3.5" />{label}
                      </a>
                    ))}
                  </div>
                </div>

                {tab === 'pending' && (
                  <div className="flex gap-3">
                    <button onClick={() => approve(selected._id)} disabled={acting}
                      className="flex-1 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-2xl font-semibold text-sm transition-colors border border-emerald-500/20 disabled:opacity-50">
                      ✓ Approve Verification
                    </button>
                    <button onClick={() => setSelected({ ...selected, _rejecting: true })}
                      className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-2xl font-semibold text-sm transition-colors border border-red-500/20">
                      ✕ Reject
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-300 text-sm">Please provide a reason for rejection. The shopkeeper will be notified.</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Rejection Reason *</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} placeholder="e.g. GST number is invalid, documents unclear…"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={allowReApp} onChange={e => setAllowReApp(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Allow shop to re-apply for verification</span>
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setSelected({ ...selected, _rejecting: false })} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-semibold text-sm transition-colors">Back</button>
                  <button onClick={() => reject(selected._id)} disabled={!rejectReason || acting}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-2xl font-semibold text-sm transition-colors border border-red-500/20 disabled:opacity-50">
                    {acting ? 'Rejecting…' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
