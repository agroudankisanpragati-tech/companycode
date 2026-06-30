'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';
import ConfirmDialog from '@/components/shopkeeper/ConfirmDialog';
import { TableRowSkeleton } from '@/components/shopkeeper/Skeletons';
import {
  Plus, Search, Filter, ChevronDown, Edit, Trash2, Eye,
  Package, ChevronLeft, ChevronRight, ArrowLeft, MoreVertical,
  CheckSquare, Square, Tag,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const PAGE_SIZE = 10;

export default function ProductsPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    const sid = localStorage.getItem('myShopId');
    setShopId(sid);
    loadProducts(sid);
  }, [isAuthenticated]);

  const loadProducts = async (sid: string | null) => {
    setLoading(true);
    if (!sid) { setLoading(false); return; }
    if (sid.startsWith('local-shop-')) {
      setProducts(JSON.parse(localStorage.getItem(`shopProducts_${sid}`) || '[]'));
    } else {
      try {
        const r = await fetch(`${API}/shops/${sid}`);
        const d = await r.json();
        setProducts(d.listings || []);
      } catch { toast('Failed to load products', 'error'); }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const sid = shopId;
    if (!sid) return;
    const token = localStorage.getItem('authToken');
    const isLocal = sid.startsWith('local-shop-') || !token || token.split('.').length !== 3;
    if (isLocal) {
      const next = products.filter(p => p._id !== id);
      localStorage.setItem(`shopProducts_${sid}`, JSON.stringify(next));
      setProducts(next); toast('Product deleted', 'success');
    } else {
      try {
        const r = await fetch(`${API}/shops/${sid}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { setProducts(p => p.filter(x => x._id !== id)); toast('Product deleted', 'success'); }
        else toast('Failed to delete', 'error');
      } catch { toast('Network error', 'error'); }
    }
    setDeleteId(null);
  };

  const filtered = products.filter(p => p.cropName?.toLowerCase().includes(search.toLowerCase()));
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = paginated.length > 0 && paginated.every(p => selected.has(p._id));
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    if (allSelected) paginated.forEach(p => n.delete(p._id)); else paginated.forEach(p => n.add(p._id));
    return n;
  });

  return (
    <>
      <ToastContainer />
      <ConfirmDialog open={!!deleteId} title="Delete Product" message="This will permanently remove the product. This action cannot be undone." confirmLabel="Delete" danger onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />

      <div className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <Link href="/dashboard/shopkeeper" className="hover:text-gray-600">Dashboard</Link>
              <ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Products</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} product{total !== 1 ? 's' : ''} in your shop</p>
          </div>
          <Link href="/dashboard/shopkeeper/products/create" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">
            <Plus className="w-4 h-4" />Add Product
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search products…" className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {['Category', 'Status', 'Stock', 'Price'].map(f => (
            <button key={f} className="flex items-center gap-1.5 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <Filter className="w-3.5 h-3.5" />{f}<ChevronDown className="w-3.5 h-3.5" />
            </button>
          ))}
          {selected.size > 0 && (
            <button className="ml-auto flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />Delete {selected.size}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-4 py-3.5 text-left w-10">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider w-12"></th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Product</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Category</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Price</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Stock</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />) : paginated.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="flex flex-col items-center py-20 px-6 text-center">
                      <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-dashed border-gray-200">
                        <Package className="w-7 h-7 text-gray-300" />
                      </div>
                      <p className="font-semibold text-gray-600">{search ? 'No results found' : 'No products yet'}</p>
                      <p className="text-xs text-gray-400 mt-1 mb-5">{search ? 'Try a different search term' : 'Add your first product to get started'}</p>
                      {!search && <Link href="/dashboard/shopkeeper/products/create" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">+ Add Product</Link>}
                    </div>
                  </td></tr>
                ) : paginated.map(p => (
                  <tr key={p._id} className={`hover:bg-gray-50/60 transition-colors group ${selected.has(p._id) ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-4 py-3.5">
                      <button onClick={() => toggleSelect(p._id)} className="text-gray-400 hover:text-emerald-600">
                        {selected.has(p._id) ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-10 w-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-200/60 flex-shrink-0">
                        {p.image ? <img src={p.image} alt={p.cropName} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-base">🌿</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 leading-snug">{p.cropName}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3.5"><span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium flex items-center gap-1 w-fit"><Tag className="w-3 h-3" />Agriculture</span></td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900">₹{p.pricePerUnit}<span className="text-gray-400 font-normal text-xs">/{p.unit}</span></td>
                    <td className="px-4 py-3.5 text-gray-600 text-sm">{p.quantity} {p.unit}</td>
                    <td className="px-4 py-3.5"><span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Active</span></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/dashboard/shopkeeper/products/edit/${p._id}`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></Link>
                        <button onClick={() => setDeleteId(p._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50">
              <p className="text-sm text-gray-500">Showing {Math.min((page-1)*PAGE_SIZE+1, total)}–{Math.min(page*PAGE_SIZE, total)} of {total}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: pages }, (_, i) => i+1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 1).map((n, i, arr) => (
                  <span key={n}>
                    {i > 0 && arr[i-1] !== n-1 && <span className="text-gray-400 px-1">…</span>}
                    <button onClick={() => setPage(n)} className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${page === n ? 'bg-emerald-600 text-white shadow-sm' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>{n}</button>
                  </span>
                ))}
                <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <Link href="/dashboard/shopkeeper/products/create" className="fixed bottom-6 right-6 h-14 w-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-300/50 flex items-center justify-center transition-all hover:scale-105 md:hidden">
        <Plus className="w-6 h-6" />
      </Link>
    </>
  );
}
