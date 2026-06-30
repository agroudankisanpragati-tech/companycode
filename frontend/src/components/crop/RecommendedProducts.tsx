'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Phone, Store, ChevronDown, ChevronUp, Loader2, ShoppingBag, Navigation } from 'lucide-react';
import { shopkeeperApi } from '@/services/shopkeeperApi';

const SUBCATEGORY_LABELS: Record<string, string> = {
  seed: '🌱 Seeds',
  fertilizer: '🧪 Fertilizers',
  pesticide: '🛡️ Pesticides',
  fungicide: '🍄 Fungicides',
  herbicide: '🌿 Herbicides',
  micronutrient: '💊 Micronutrients',
  bio_fertilizer: '♻️ Bio-Fertilizers',
  growth_regulator: '📈 Growth Promoters',
  other: '📦 Other Products',
};

const SUBCATEGORY_COLORS: Record<string, string> = {
  seed: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  fertilizer: 'bg-blue-50 border-blue-200 text-blue-800',
  pesticide: 'bg-red-50 border-red-200 text-red-800',
  fungicide: 'bg-purple-50 border-purple-200 text-purple-800',
  herbicide: 'bg-lime-50 border-lime-200 text-lime-800',
  micronutrient: 'bg-amber-50 border-amber-200 text-amber-800',
  bio_fertilizer: 'bg-teal-50 border-teal-200 text-teal-800',
  growth_regulator: 'bg-orange-50 border-orange-200 text-orange-800',
  other: 'bg-gray-50 border-gray-200 text-gray-800',
};

interface ShopEntry {
  shop: {
    _id: string;
    shopName: string;
    ownerName: string;
    mobileNumber: string;
    village: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
    verificationStatus: string;
  };
  products: {
    _id: string;
    productName: string;
    brandName: string;
    variety: string;
    sellingPrice: number;
    mrp: number;
    quantity: number;
    unit: string;
  }[];
  distance: number | null;
}

interface Props {
  cropName: string;
  farmerVillage?: string;
  farmerTehsil?: string;
  farmerDistrict?: string;
  farmerState?: string;
  farmerLat?: number;
  farmerLng?: number;
}

export default function RecommendedProducts({
  cropName, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng,
}: Props) {
  const [results, setResults] = useState<Record<string, ShopEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (fetched) { setExpanded(e => !e); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const params: Record<string, string> = {};
      if (farmerVillage) params.village = farmerVillage;
      if (farmerTehsil) params.tehsil = farmerTehsil;
      if (farmerDistrict) params.district = farmerDistrict;
      if (farmerState) params.state = farmerState;
      if (farmerLat) params.lat = String(farmerLat);
      if (farmerLng) params.lng = String(farmerLng);
      const data = await shopkeeperApi.getCropProducts(cropName, params);
      setResults(data.results || {});
      setFetched(true);
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, [cropName, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng, fetched]);

  const totalCount = Object.values(results).reduce((sum, shops) => sum + shops.length, 0);
  const categoryCount = Object.keys(results).length;

  return (
    <div className="mx-5 mb-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
      <button
        onClick={fetchProducts}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-emerald-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-emerald-800">
          <ShoppingBag className="w-3.5 h-3.5" />
          Recommended Products Available Near You
          {fetched && totalCount > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded-full text-[10px] font-bold">
              {categoryCount} categories
            </span>
          )}
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
        ) : expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
        )}
      </button>

      {expanded && !loading && (
        <div className="px-4 pb-4 space-y-3">
          {totalCount === 0 ? (
            <p className="text-xs text-emerald-700 py-2 text-center">
              No products found for {cropName} in nearby shops. Check back later.
            </p>
          ) : (
            Object.entries(results).map(([subcat, shops]) => (
              <CategorySection key={subcat} subcat={subcat} shops={shops} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ subcat, shops }: { subcat: string; shops: ShopEntry[] }) {
  const label = SUBCATEGORY_LABELS[subcat] || `📦 ${subcat}`;
  const colorClass = SUBCATEGORY_COLORS[subcat] || SUBCATEGORY_COLORS.other;

  return (
    <div className="space-y-1.5">
      <p className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
        {label}
      </p>
      {shops.map(entry => <ShopProductCard key={entry.shop._id} entry={entry} />)}
    </div>
  );
}

function ShopProductCard({ entry }: { entry: ShopEntry }) {
  const { shop, products, distance } = entry;
  const hasGps = shop.latitude && shop.longitude;
  const mapsUrl = hasGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([shop.shopName, shop.village, shop.district].filter(Boolean).join(', '))}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold text-gray-900 truncate">{shop.shopName}</p>
            {shop.verificationStatus === 'verified' && (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">✓ Verified</span>
            )}
          </div>
          <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {[shop.village, shop.district, shop.state].filter(Boolean).join(', ')}
          </p>
        </div>
        {distance !== null && (
          <span className={`flex-shrink-0 px-2 py-1 text-[10px] font-bold rounded-full text-white ${
            distance < 5 ? 'bg-emerald-500' : distance < 20 ? 'bg-amber-500' : 'bg-slate-400'
          }`}>
            {distance} km
          </span>
        )}
      </div>

      <div className="space-y-1">
        {products.map(p => (
          <div key={p._id} className="flex items-center justify-between text-[10px]">
            <span className="text-gray-600 truncate max-w-[65%]">
              {p.productName}{p.brandName ? ` — ${p.brandName}` : ''}{p.variety ? ` (${p.variety})` : ''}
            </span>
            <span className="font-bold text-emerald-700 ml-2 flex-shrink-0">
              ₹{p.sellingPrice}/{p.unit}
              {p.quantity > 0 && <span className="text-gray-400 font-normal ml-1">({p.quantity}{p.unit})</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 pt-1">
        <Link
          href={`/shops/${shop._id}`}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors"
        >
          <Store className="w-2.5 h-2.5" />View Shop
        </Link>
        {shop.mobileNumber && (
          <a
            href={`tel:${shop.mobileNumber}`}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
          >
            <Phone className="w-2.5 h-2.5" />Call
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
        >
          <Navigation className="w-2.5 h-2.5" />Navigate
        </a>
      </div>
    </div>
  );
}
