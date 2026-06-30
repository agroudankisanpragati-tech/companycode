'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import ToastContainer from '@/components/shopkeeper/Toast';
import {
  Package, Star, Eye, TrendingUp, Phone, MessageCircle,
  ArrowUpRight, ArrowRight, Plus, Bell, Search, ChevronRight, Store,
  BarChart3, Settings, Users, Activity, Zap, Shield, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function ShopkeeperDashboard() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    if (user?.role !== 'shopkeeper') { router.replace('/auth/role-select'); return; }
    loadData();
  }, [isAuthenticated, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const profileData = await shopkeeperApi.getProfile();
      if (profileData.profile) setProfile(profileData.profile);
      const shopType = profileData.profile?.shopType;
      const [fertData, nurseryData] = await Promise.all([
        shopType === 'fertilizer' ? shopkeeperApi.getFertilizerProducts().catch(() => ({ products: [] })) : Promise.resolve({ products: [] }),
        shopType === 'nursery' ? shopkeeperApi.getNurseryProducts().catch(() => ({ products: [] })) : Promise.resolve({ products: [] }),
      ]);
      const allProducts = [
        ...(fertData.products || []).map((p: any) => ({ ...p, _productType: 'fertilizer', displayName: p.productName, displayPrice: `₹${p.sellingPrice}` })),
        ...(nurseryData.products || []).map((p: any) => ({ ...p, _productType: 'nursery', displayName: p.plantName, displayPrice: `₹${p.price}` })),
      ];
      setProducts(allProducts);
    } catch {}
    setLoading(false);
  };

  if (!isAuthenticated || user?.role !== 'shopkeeper') return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  const verificationStatus = profile?.verificationStatus;
  const isFertilizer = profile?.shopType === 'fertilizer';
  const productRoute = isFertilizer ? '/dashboard/shopkeeper/products/fertilizer' : '/dashboard/shopkeeper/products/nursery';

  const VerificationBanner = () => {
    if (!profile) return null;
    if (verificationStatus === 'verified') return (
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <p className="text-sm text-emerald-700 font-medium">Your shop is <span className="font-bold">Verified</span> ✓</p>
        <span className="ml-auto px-2.5 py-1 bg-emerald-500 text-white text-xs rounded-full font-semibold">Verified Shop</span>
      </div>
    );
    if (verificationStatus === 'rejected') return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm text-red-700 font-semibold">Verification Rejected</p>
          {profile.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{profile.rejectionReason}</p>}
        </div>
        {profile.reApplicationAllowed && (
          <Link href="/dashboard/shopkeeper/complete-profile" className="ml-auto px-3 py-1.5 bg-red-500 text-white text-xs rounded-xl font-semibold hover:bg-red-600 transition-colors">
            Re-apply
          </Link>
        )}
      </div>
    );
    if (profile.verificationSubmitted) return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-700">Verification pending admin review — <span className="font-semibold">Unverified Shop</span></p>
      </div>
    );
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0" />
        <p className="text-sm text-blue-700">Submit your documents to get your shop verified.</p>
        <Link href="/dashboard/shopkeeper/complete-profile" className="ml-auto px-3 py-1.5 bg-blue-500 text-white text-xs rounded-xl font-semibold hover:bg-blue-600 transition-colors">
          Submit Docs
        </Link>
      </div>
    );
  };

  const stats = [
    { label: 'Total Products', value: products.length, icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'Profile Views', value: 0, icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Avg. Rating', value: '—', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
    { label: 'Revenue', value: '₹0', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ];

  const quickActions = [
    { label: 'Add Product', href: productRoute + '/create', icon: Plus, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' },
    { label: 'My Products', href: productRoute, icon: Package, cls: 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200' },
    { label: 'Edit Profile', href: '/dashboard/shopkeeper/complete-profile', icon: Store, cls: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' },
    { label: 'Analytics', href: '/dashboard/shopkeeper/analytics', icon: BarChart3, cls: 'bg-gray-800 hover:bg-gray-900 text-white shadow-gray-200' },
  ];

  return (
    <>
      <ToastContainer />
      <div className="p-4 md:p-6 xl:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{greeting}, {firstName} 👋</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {profile?.shopName ? `Managing · ${profile.shopName}` : 'Welcome to your shopkeeper panel'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input placeholder="Search…" className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52 shadow-sm" />
            </div>
            <button className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <Bell style={{ width: 18, height: 18 }} className="text-gray-600" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-1 ring-white" />
            </button>
            <Link href={productRoute + '/create'} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold shadow-sm shadow-emerald-200 transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Product</span>
            </Link>
          </div>
        </div>

        <VerificationBanner />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`bg-white rounded-2xl border ${s.border} shadow-sm p-4 md:p-5 hover:shadow-md transition-all duration-200`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</span>
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                    <Icon className={s.color} style={{ width: 17, height: 17 }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" />All time</p>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href} className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-sm font-semibold shadow transition-all ${a.cls}`}>
                  <Icon className="w-4 h-4" />{a.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" />Recent Products</h2>
              <Link href={productRoute} className="text-emerald-600 text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-emerald-50">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center py-16 px-6 text-center">
                <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-dashed border-gray-200">
                  <Package className="w-7 h-7 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-600 text-sm">No products yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Add your first product to start selling</p>
                <Link href={productRoute + '/create'} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700">
                  + Add Product
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50/80">
                {products.slice(0, 6).map((p: any) => (
                  <div key={p._id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors group">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200/60">
                      {p.productImages?.[0] ? (
                        <img src={`${API_BASE}${p.productImages[0]}`} alt={p.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-lg">🌿</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{p.displayName}</p>
                      <p className="text-xs text-gray-400">{p._productType === 'fertilizer' ? p.brandName : p.variety}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900 text-sm">{p.displayPrice}</p>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5 ${p.stockStatus === 'in_stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {p.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            {profile && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    {profile.profileImage ? (
                      <img src={`${API_BASE}${profile.profileImage}`} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <Store className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider">Your Shop</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm truncate">{profile.shopName || 'Unnamed Shop'}</p>
                      {verificationStatus === 'verified' && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-white/40 text-[10px]">
                      {verificationStatus === 'verified' ? 'Verified Shop' : 'Unverified Shop'}
                    </p>
                  </div>
                </div>
                {profile.district && <p className="text-white/50 text-xs mb-4">{profile.district}, {profile.state}</p>}
                <div className="flex gap-2">
                  <Link href="/dashboard/shopkeeper/complete-profile" className="flex-1 text-center px-3 py-2 bg-white text-gray-900 text-xs font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                    Edit Shop
                  </Link>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
              </div>
              <div className="flex flex-col items-center py-10 px-5 text-center">
                <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 border border-dashed border-gray-200">
                  <Zap className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No activity yet</p>
                <p className="text-gray-400 text-xs mt-1">Actions will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
