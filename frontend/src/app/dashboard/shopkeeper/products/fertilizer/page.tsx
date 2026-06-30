'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';
import ConfirmDialog from '@/components/shopkeeper/ConfirmDialog';
import { Plus, Search, Edit, Trash2, Package, ChevronRight } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function FertilizerProductsPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    load();
  }, [isAuthenticated]);

  const load = async () => {
    setLoading(true);
    const d = await shopkeeperApi.getFertilizerProducts();
    setProducts(d.products || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const d = await shopkeeperApi.deleteFertilizerProduct(id);
    if (d.success) { setProducts(p => p.filter(x => x._id !== id)); toast('Product deleted', 'success'); }
    else toast(d.error || 'Failed', 'error');
    setDeleteId(null);
  };

  const filtered = products.filter(p => p.productName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <ToastContainer />
      <ConfirmDialog open={!!deleteId} title="Delete Product" message="This will permanently remove the product." confirmLabel="Delete" danger onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fertilizer Products</h1>
            <p className="text-gray-500 text-sm mt-0.5">{filtered.length} products</p>
          </div>
          <Link href="/dashboard/shopkeeper/products/fertilizer/create" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />Add Product
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <Package className="w-12 h-12 text-gray-200 mb-4" />
              <p className="font-semibold text-gray-600">No products yet</p>
              <Link href="/dashboard/shopkeeper/products/fertilizer/create" className="mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">+ Add Product</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-14"></th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">MRP</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Selling</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => (
                    <tr key={p._id} className="hover:bg-gray-50/60 group">
                      <td className="px-4 py-3.5">
                        <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden border border-gray-200/60">
                          {p.productImages?.[0] ? <img src={`${API_BASE}${p.productImages[0]}`} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-lg">🌱</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900">{p.productName}</p>
                        <p className="text-xs text-gray-400">{p.category}</p>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 text-sm">{p.brandName || '—'}</td>
                      <td className="px-4 py-3.5 text-gray-600 text-sm">₹{p.mrp}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900">₹{p.sellingPrice}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.stockStatus === 'in_stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {p.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/dashboard/shopkeeper/products/fertilizer/${p._id}/edit`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></Link>
                          <button onClick={() => setDeleteId(p._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
