'use client';
import { useEffect, useState } from 'react';
import { Store, Trash2, Eye, Ban, CheckCircle, XCircle, Clock, Package, MapPin, Sprout, Leaf, Search } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');
const TOKEN_KEY = 'kisan-unnati-admin-token';

export default function RegisteredShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<any>({});

  useEffect(() => { load(); }, [typeFilter]);

  const tok = () => localStorage.getItem(TOKEN_KEY) || '';

  const load = async () => {
    setLoading(true);
    const qs = typeFilter ? `?type=${typeFilter}` : '';
    const r = await fetch(`${API}/admin/shopkeeper/shops${qs}`, { headers: { Authorization: `Bearer ${tok()}` } });
    const d = await r.json();
    setShops(d.shops || []);
    setSummary(d.summary || {});
    setLoading(false);
  };

  const loadShopDetail = async (id: string) => {
    const r = await fetch(`${API}/admin/shopkeeper/shops/${id}`, { headers: { Authorization: `Bearer ${tok()}` } });
    const d = await r.json();
    setSelected(d.shop);
    setSelectedProducts({ fertilizer: d.fertProducts || [], nursery: d.nurseryProducts || [] });
  };

  const toggleSuspend = async (id: string, cur: boolean) => {
    await fetch(`${API}/admin/shopkeeper/shops/${id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ suspended: !cur }),
    });
    load();
  };

  const deleteShop = async (id: string) => {
    if (!confirm('Delete this shop and all its products?')) return;
    await fetch(`${API}/admin/shopkeeper/shops/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
    load();
  };

  const filtered = shops.filter(s =>
    s.shopName?.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.district?.toLowerCase().includes(search.toLowerCase())
  );

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'verified') return <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full"><CheckCircle className="w-3 h-3" />Verified</span>;
    if (status === 'rejected') return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full"><XCircle className="w-3 h-3" />Rejected</span>;
    return <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full"><Clock className="w-3 h-3" />Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Store className="w-6 h-6 text-emerald-400" />Registered Shops</h1>
        <p className="text-slate-400 text-sm mt-1">Manage all registered shopkeepers</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total || 0, color: 'from-slate-500 to-slate-600' },
          { label: 'Fertilizer', value: summary.fertilizer || 0, color: 'from-amber-500 to-amber-600' },
          { label: 'Nursery', value: summary.nursery || 0, color: 'from-green-500 to-green-600' },
          { label: 'Verified', value: summary.verified || 0, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Pending', value: summary.pending || 0, color: 'from-yellow-500 to-yellow-600' },
          { label: 'Rejected', value: summary.rejected || 0, color: 'from-red-500 to-red-600' },
        ].map(s => (
          <div key={s.label} className="glass-panel rounded-2xl p-4">
            <div className={`mb-2 inline-flex rounded-lg bg-gradient-to-br ${s.color} p-2 text-white shadow`}>
              <Store className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shops…"
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600" />
        </div>
        {[
          { value: '', label: 'All Types' },
          { value: 'fertilizer', label: 'Fertilizer' },
          { value: 'nursery', label: 'Nursery' },
        ].map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${typeFilter === f.value ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/8">
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Shop</th>
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Location</th>
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Products</th>
                <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(shop => (
                  <tr key={shop._id} className="hover:bg-white/3 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10 overflow-hidden flex-shrink-0">
                          {shop.profileImage ? <img src={`${API_BASE}${shop.profileImage}`} alt="" className="h-full w-full object-cover" /> : <Store className="w-5 h-5 text-slate-500 m-2.5" />}
                        </div>
                        <div>
                          <p className="text-slate-200 font-medium">{shop.shopName || 'Unnamed'}</p>
                          <p className="text-slate-500 text-xs">{shop.ownerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 text-[10px] font-bold rounded-full ${shop.shopType === 'nursery' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {shop.shopType === 'nursery' ? <Leaf className="w-3 h-3" /> : <Sprout className="w-3 h-3" />}
                        {shop.shopType === 'nursery' ? 'Nursery' : 'Fertilizer'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="flex items-center gap-1 text-slate-400 text-xs"><MapPin className="w-3 h-3" />{[shop.district, shop.state].filter(Boolean).join(', ') || '—'}</p>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={shop.verificationStatus} /></td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-slate-400 text-xs"><Package className="w-3 h-3" />{shop.productCount || 0}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => loadShopDetail(shop._id)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleSuspend(shop._id, shop.suspended)} className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Ban className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteShop(shop._id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-16"><Store className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-500">No shops found</p></div>
            )}
          </div>
        )}
      </div>

      {/* Shop Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{selected.shopName}</h2>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Owner', selected.ownerName],['Mobile', selected.mobileNumber],['Email', selected.email],['District', selected.district],['State', selected.state],['GST', selected.gstNumber]].map(([k,v]) => v ? (
                <div key={k} className="bg-white/5 rounded-xl p-3">
                  <p className="text-slate-500 text-[11px] uppercase font-semibold">{k}</p>
                  <p className="text-slate-200 mt-0.5">{v}</p>
                </div>
              ) : null)}
            </div>
            {selectedProducts.fertilizer?.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase mb-2">Fertilizer Products ({selectedProducts.fertilizer.length})</p>
                <div className="space-y-1">
                  {selectedProducts.fertilizer.slice(0,5).map((p: any) => (
                    <div key={p._id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-sm">
                      <span className="text-slate-200">{p.productName}</span>
                      <span className="text-slate-400 text-xs">₹{p.sellingPrice}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedProducts.nursery?.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase mb-2">Nursery Products ({selectedProducts.nursery.length})</p>
                <div className="space-y-1">
                  {selectedProducts.nursery.slice(0,5).map((p: any) => (
                    <div key={p._id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-sm">
                      <span className="text-slate-200">{p.plantName}</span>
                      <span className="text-slate-400 text-xs">₹{p.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
