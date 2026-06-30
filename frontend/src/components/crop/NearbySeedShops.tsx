'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Phone, Store, ChevronDown, ChevronUp, Loader2, Sprout, Navigation } from 'lucide-react';
import { shopkeeperApi } from '@/services/shopkeeperApi';

interface SeedResult {
  shop: {
    _id: string;
    shopName: string;
    ownerName: string;
    mobileNumber: string;
    village: string;
    tehsil: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
    verificationStatus: string;
  };
  seeds: {
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
  score: number;
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

export default function NearbySeedShops({ cropName, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng }: Props) {
  const [results, setResults] = useState<SeedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchShops = useCallback(async () => {
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
      const data = await shopkeeperApi.searchSeedsByByCrop(cropName, params);
      setResults(data.results || []);
      setFetched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [cropName, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng, fetched]);

  return (
    <div className="mx-5 mb-4 rounded-xl border border-amber-100 bg-amber-50 overflow-hidden">
      <button
        onClick={fetchShops}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-amber-800">
          <Sprout className="w-3.5 h-3.5" />
          Nearby Shops Selling {cropName} Seeds
          {fetched && results.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[10px] font-bold">
              {results.length}
            </span>
          )}
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
        ) : expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        )}
      </button>

      {expanded && !loading && (
        <div className="px-4 pb-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-xs text-amber-700 py-2 text-center">
              No nearby seed shops found for {cropName}. Check back later.
            </p>
          ) : (
            results.slice(0, 5).map(r => {
              const hasGps = r.shop.latitude && r.shop.longitude;
              const mapsUrl = hasGps
                ? `https://www.google.com/maps/dir/?api=1&destination=${r.shop.latitude},${r.shop.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.shop.shopName, r.shop.village, r.shop.district].filter(Boolean).join(', '))}`;

              return (
                <div key={r.shop._id} className="bg-white rounded-xl border border-amber-100 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-gray-900 truncate">{r.shop.shopName}</p>
                        {r.shop.verificationStatus === 'verified' && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">✓ Verified</span>
                        )}
                      </div>
                      <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {[r.shop.village, r.shop.district, r.shop.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    {r.distance !== null && (
                      <span className={`flex-shrink-0 px-2 py-1 text-[10px] font-bold rounded-full text-white ${
                        r.distance < 5 ? 'bg-emerald-500' : r.distance < 20 ? 'bg-amber-500' : 'bg-slate-400'
                      }`}>
                        {r.distance} km
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {r.seeds.slice(0, 3).map(seed => (
                      <div key={seed._id} className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-600 truncate max-w-[65%]">
                          {seed.productName}{seed.variety ? ` — ${seed.variety}` : ''}
                        </span>
                        <span className="font-bold text-emerald-700 ml-2 flex-shrink-0">
                          ₹{seed.sellingPrice}/{seed.unit}
                          {seed.quantity > 0 && <span className="text-gray-400 font-normal ml-1">({seed.quantity}{seed.unit})</span>}
                        </span>
                      </div>
                    ))}
                    {r.seeds.length > 3 && (
                      <p className="text-[10px] text-gray-400">+{r.seeds.length - 3} more varieties</p>
                    )}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <Link
                      href={`/shops/${r.shop._id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <Store className="w-2.5 h-2.5" />View Shop
                    </Link>
                    {r.shop.mobileNumber && (
                      <a
                        href={`tel:${r.shop.mobileNumber}`}
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
            })
          )}

          {results.length > 5 && (
            <Link
              href="/marketplace/shops?type=fertilizer"
              className="block text-center text-xs text-amber-700 font-semibold hover:underline pt-1"
            >
              View all {results.length} seed shops →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
