'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';
import ConfirmDialog from '@/components/shopkeeper/ConfirmDialog';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function NurseryProductsPage() {
  const { isAuthenticated } = useAuth();
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
    const d = await shopkeeperApi.getNurseryProducts();
    setProducts(d.products || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const d = await shopkeeperApi.deleteNurseryProduct(id);
    if (d.success) { setProducts(p => p.filter(x => x._id !== id)); toast('Product deleted', 'success'); }
    else toast(d.error || 'Failed', 'error');
    setDeleteId(null);
  };

  const filtered = products.filter(p => p.plantName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <ToastContainer />
      <ConfirmDialog open={!!deleteId} title="Delete Plant" message="This will permanently remove the plant listing." confirmLabel="Delete" danger onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nursery Products</h1>
            <p className="text-gray-500 text-sm mt-0.5">{filtered.length} plants listed</p>
          </div>
          <Link href="/dashboard/shopkeeper/products/nursery/create" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />Add Plant
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plants…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <Package className="w-12 h-12 text-gray-200 mb-4" />
              <p className="font-semibold text-gray-600">No plants listed yet</p>
              <Link href="/dashboard/shopkeeper/products/nursery/create" className="mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">+ Add Plant</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filtered.map(p => (
                <div key={p._id} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="h-40 bg-gray-100 overflow-hidden relative">
                    {p.productImages?.[0] ? (
                      <img src={`${API_BASE}${p.productImages[0]}`} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-4xl">🌿</div>
                    )}
                    {p.organicCertified && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">Organic</span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900">{p.plantName}</p>
                    {p.variety && <p className="text-xs text-gray-500">{p.variety}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-emerald-600">₹{p.price}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.stockStatus === 'in_stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {p.stockStatus === 'in_stock' ? `${p.availableQuantity} available` : 'Out of Stock'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/dashboard/shopkeeper/products/nursery/${p._id}/edit`}
                        className="flex-1 text-center py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                        <Edit className="w-3 h-3" />Edit
                      </Link>
                      <button onClick={() => setDeleteId(p._id)}
                        className="flex-1 py-2 border border-red-100 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1">
                        <Trash2 className="w-3 h-3" />Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
