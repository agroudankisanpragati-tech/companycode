'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import {
  MapPin, Phone, CheckCircle, Search, Store, Leaf, Sprout,
  Navigation, Package, ChevronRight, RefreshCw, X,
  TreePine, FlaskConical, Bug, Wheat, ExternalLink,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

type ShopTab = 'all' | 'fertilizer' | 'nursery';

interface Shop {
  _id: string;
  shopType: 'fertilizer' | 'nursery';
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  profileImage?: string;
  verificationStatus: string;
  distance: number | null;
  productCount: number;
}

interface UserLocation { lat: number; lng: number; village?: string; tehsil?: string; district?: string; state?: string; }

function DistanceBadge({ distance }: { distance: number | null }) {
  if (distance === null) return null;
  const color = distance < 5 ? 'bg-emerald-500' : distance < 20 ? 'bg-amber-500' : 'bg-slate-500';
  return (
    <span className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 ${color} text-white text-[10px] font-bold rounded-full shadow-sm`}>
      <MapPin className="w-2.5 h-2.5" />{distance} km
    </span>
  );
}

function ShopCard({ shop }: { shop: Shop }) {
  const isFertilizer = shop.shopType === 'fertilizer';
  const hasGps = shop.latitude && shop.longitude;
  const mapsUrl = hasGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([shop.shopName, shop.village, shop.district].filter(Boolean).join(', '))}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Cover image */}
      <div className={`relative h-36 overflow-hidden ${isFertilizer ? 'bg-gradient-to-br from-amber-50 to-orange-100' : 'bg-gradient-to-br from-emerald-50 to-teal-100'}`}>
        {shop.profileImage ? (
          <img src={`${API_BASE}${shop.profileImage}`} alt={shop.shopName}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            {isFertilizer ? <Sprout className="w-14 h-14 text-amber-300" /> : <Leaf className="w-14 h-14 text-emerald-300" />}
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {shop.verificationStatus === 'verified' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-sm">
              <CheckCircle className="w-2.5 h-2.5" />Verified
            </span>
          )}
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full shadow-sm ${isFertilizer ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
            {isFertilizer ? '🌾 Fertilizer' : '🌿 Nursery'}
          </span>
        </div>
        <DistanceBadge distance={shop.distance} />
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{shop.shopName || 'Unnamed Shop'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{shop.ownerName}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{[shop.village, shop.tehsil, shop.district].filter(Boolean).join(', ') || shop.state}</span>
        </div>

        {shop.productCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
            <Package className="w-3 h-3" />{shop.productCount} products available
          </span>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <Link href={`/shops/${shop._id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors">
            <Store className="w-3.5 h-3.5" />View Shop
          </Link>
          {shop.mobileNumber && (
            <a href={`tel:${shop.mobileNumber}`}
              className="flex items-center justify-center px-3 py-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors">
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors"
            title="Navigate">
            <Navigation className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-36 bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-8 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function FarmerMarketplacePage() {
  const [tab, setTab] = useState<ShopTab>('all');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);

  // On mount, try to load farmer profile GPS for auto-proximity
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return;
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'farmer') return;
    fetch('/api/farmer-profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const profile = d?.data;
        if (!profile) return;
        const coords = profile.user?.location?.coordinates;
        const loc: UserLocation = {
          lat: coords?.latitude || 0,
          lng: coords?.longitude || 0,
          village: profile.ext?.village || '',
          district: profile.user?.location?.district || profile.ext?.district || '',
          state: profile.user?.location?.state || profile.ext?.state || '',
        };
        if (loc.lat && loc.lng) setUserLoc(loc);
        else if (loc.district || loc.state) setUserLoc({ ...loc, lat: 0, lng: 0 });
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (tab !== 'all') params.type = tab;
    if (userLoc) {
      if (userLoc.lat) params.lat = String(userLoc.lat);
      if (userLoc.lng) params.lng = String(userLoc.lng);
      if (userLoc.district) params.district = userLoc.district;
      if (userLoc.state) params.state = userLoc.state;
    }
    if (search) params.search = search;
    const d = await shopkeeperApi.getMarketplace(params);
    setShops(d.shops || []);
    setLoading(false);
  }, [tab, userLoc, search]);

  useEffect(() => { load(); }, [tab, userLoc]);

  useEffect(() => {
    const t = setTimeout(() => { if (!loading) load(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const detectLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
          const data = await r.json();
          const addr = data.address || {};
          setUserLoc({
            lat, lng,
            village: addr.village || addr.hamlet || addr.suburb || '',
            tehsil: addr.county || '',
            district: addr.state_district || addr.county || '',
            state: addr.state || '',
          });
        } catch {
          setUserLoc({ lat, lng });
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  };

  const fertilizerShops = shops.filter(s => s.shopType === 'fertilizer');
  const nurseryShops = shops.filter(s => s.shopType === 'nursery');
  const displayShops = tab === 'all' ? shops : tab === 'fertilizer' ? fertilizerShops : nurseryShops;

  const tabs = [
    { key: 'all' as ShopTab,        label: 'All Shops',           icon: Store,  count: shops.length },
    { key: 'fertilizer' as ShopTab, label: 'Registered Shops',    icon: Sprout, count: fertilizerShops.length },
    { key: 'nursery' as ShopTab,    label: 'Registered Nurseries', icon: Leaf,  count: nurseryShops.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-5xl mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-xs font-semibold mb-4">
            <Sprout className="w-3.5 h-3.5" />Agri Marketplace
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight">
            Find Agricultural Shops<br className="hidden sm:block" /> Near You
          </h1>
          <p className="text-white/80 text-sm md:text-base mb-8 max-w-xl mx-auto">
            Discover nearby fertilizer shops, seed suppliers, nurseries and plant dealers — sorted by distance.
          </p>
          <div className="max-w-2xl mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search shops, district, village…"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white shadow-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={detectLocation}
              disabled={locating}
              className="flex items-center gap-2 px-5 py-3.5 bg-white text-emerald-700 rounded-2xl text-sm font-bold hover:bg-emerald-50 disabled:opacity-70 transition-colors shadow-sm"
            >
              <Navigation className="w-4 h-4" />
              {locating ? 'Locating…' : 'Near Me'}
            </button>
          </div>
          {userLoc && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-full text-xs">
              <span className="h-2 w-2 bg-emerald-300 rounded-full animate-pulse" />
              Showing results near your location
              {userLoc.district && ` · ${userLoc.district}`}
              <button onClick={() => setUserLoc(null)} className="ml-1 text-white/60 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-7">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap items-center">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
                  tab === t.key
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {loading ? '…' : t.count}
                </span>
              </button>
            );
          })}
          <button onClick={load} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-2xl hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>

        {/* Category info banners */}
        {tab === 'fertilizer' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🌾', label: 'Fertilizer Shops',  desc: 'NPK, DAP, Urea' },
              { icon: '🌱', label: 'Seed Suppliers',    desc: 'Certified seeds' },
              { icon: '🧪', label: 'Pesticide Dealers', desc: 'Crop protection' },
              { icon: '🧫', label: 'Input Suppliers',   desc: 'Micronutrients & bio' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-amber-100 p-3 flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-xs font-bold text-gray-800">{c.label}</p>
                  <p className="text-[10px] text-gray-400">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'nursery' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🌳', label: 'Nursery Shops',     desc: 'Saplings & plants' },
              { icon: '🍎', label: 'Fruit Plants',      desc: 'Mango, Guava…' },
              { icon: '🌿', label: 'Medicinal Plants',  desc: 'Tulsi, Aloe…' },
              { icon: '🌸', label: 'Ornamental Plants', desc: 'Garden plants' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-green-100 p-3 flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-xs font-bold text-gray-800">{c.label}</p>
                  <p className="text-[10px] text-gray-400">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-sm text-gray-500">
            {displayShops.length === 0
              ? 'No shops found'
              : `${displayShops.length} shop${displayShops.length !== 1 ? 's' : ''} found${userLoc ? ', sorted by distance' : ''}`}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <ShopCardSkeleton key={i} />)}
          </div>
        ) : displayShops.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-4">🏪</div>
            <p className="font-bold text-gray-700 text-lg">No shops found</p>
            <p className="text-gray-400 text-sm mt-2">
              {search ? `No results for "${search}"` : 'No shops registered in this category yet.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayShops.map(shop => <ShopCard key={shop._id} shop={shop} />)}
          </div>
        )}
      </div>
    </div>
  );
}
