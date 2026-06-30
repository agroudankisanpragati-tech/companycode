'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { MapPin, Phone, CheckCircle, ArrowLeft, Sprout, Leaf, Package, Navigation, MessageCircle } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

// Sub-category display config
const FERT_SUBCATS: Record<string, { label: string; emoji: string }> = {
  seed:             { label: 'Seeds',             emoji: '🌾' },
  fertilizer:      { label: 'Fertilizers',        emoji: '🧪' },
  pesticide:       { label: 'Pesticides',         emoji: '🐛' },
  herbicide:       { label: 'Herbicides',         emoji: '🌿' },
  fungicide:       { label: 'Fungicides',         emoji: '🍄' },
  micronutrient:   { label: 'Micronutrients',     emoji: '⚗️' },
  bio_fertilizer:  { label: 'Bio Fertilizers',    emoji: '🌱' },
  growth_regulator:{ label: 'Growth Regulators',  emoji: '📈' },
  other:           { label: 'Other',              emoji: '📦' },
};

const NURSERY_PLANT_TYPES: Record<string, { label: string; emoji: string }> = {
  fruit:      { label: 'Fruit Plants',      emoji: '🍎' },
  vegetable:  { label: 'Vegetable Plants',  emoji: '🥦' },
  medicinal:  { label: 'Medicinal Plants',  emoji: '🌿' },
  forestry:   { label: 'Forestry Plants',   emoji: '🌲' },
  ornamental: { label: 'Ornamental Plants', emoji: '🌸' },
  other:      { label: 'Other Plants',      emoji: '🪴' },
};

function inferNurseryType(plantName: string, variety: string): string {
  const txt = `${plantName} ${variety}`.toLowerCase();
  if (/mango|guava|banana|papaya|lemon|lime|orange|amla|jackfruit|pomegranate|fig|grape|litchi|apple|pear|peach|plum|coconut|date/.test(txt)) return 'fruit';
  if (/tomato|potato|brinjal|cauliflower|cabbage|onion|garlic|carrot|radish|spinach|palak|gourd|cucumber|bitter|bottle/.test(txt)) return 'vegetable';
  if (/tulsi|aloe|neem|giloy|ashwagandha|brahmi|stevia|moringa|medicinal|herbal|lemon grass/.test(txt)) return 'medicinal';
  if (/teak|sagwan|eucalyptus|bamboo|poplar|shisham|oak|pine|sal|mahogany/.test(txt)) return 'forestry';
  if (/rose|marigold|jasmine|hibiscus|bougainvillea|ornamental|flower|garden|lily|dahlia/.test(txt)) return 'ornamental';
  return 'other';
}

export default function PublicShopPage() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubcat, setActiveSubcat] = useState('all');

  useEffect(() => {
    if (!id) return;
    shopkeeperApi.getMarketplaceShop(id).then(d => {
      setShop(d.shop);
      setProducts(d.products || []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!shop) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Shop not found</div>
  );

  const isFertilizer = shop.shopType === 'fertilizer';
  const hasGps = shop.latitude && shop.longitude;
  const mapsUrl = hasGps
    ? `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([shop.shopName, shop.village, shop.district].filter(Boolean).join(', '))}`;

  // Build sub-category groups
  let subcatGroups: Record<string, any[]> = {};
  if (isFertilizer) {
    products.forEach(p => {
      const key = p.productSubCategory || 'other';
      if (!subcatGroups[key]) subcatGroups[key] = [];
      subcatGroups[key].push(p);
    });
  } else {
    products.forEach(p => {
      const key = inferNurseryType(p.plantName || '', p.variety || '');
      if (!subcatGroups[key]) subcatGroups[key] = [];
      subcatGroups[key].push(p);
    });
  }

  const subcatKeys = Object.keys(subcatGroups);
  const displayProducts = activeSubcat === 'all' ? products : (subcatGroups[activeSubcat] || []);
  const subcatConfig = isFertilizer ? FERT_SUBCATS : NURSERY_PLANT_TYPES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-emerald-500 to-teal-600 overflow-hidden">
        {shop.coverImage && (
          <img src={`${API_BASE}${shop.coverImage}`} alt="" className="h-full w-full object-cover opacity-70" />
        )}
        <Link href="/marketplace/shops"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-black/40 hover:bg-black/60 text-white rounded-xl text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />Back
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 pb-12 space-y-6">
        {/* Shop Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-gray-100 flex-shrink-0 -mt-10">
              {shop.profileImage ? (
                <img src={`${API_BASE}${shop.profileImage}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  {isFertilizer ? <Sprout className="w-8 h-8 text-emerald-400" /> : <Leaf className="w-8 h-8 text-green-400" />}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{shop.shopName}</h1>
                {shop.verificationStatus === 'verified' && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                    <CheckCircle className="w-3 h-3" />Verified
                  </span>
                )}
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${isFertilizer ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {isFertilizer ? '🌾 Fertilizer & Input' : '🌿 Nursery & Plants'}
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">{shop.ownerName}</p>
              {(shop.village || shop.district) && (
                <p className="flex items-center gap-1 text-gray-400 text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[shop.village, shop.tehsil, shop.district, shop.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-5">
            {shop.mobileNumber && (
              <a href={`tel:${shop.mobileNumber}`}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                <Phone className="w-4 h-4" />Call {shop.mobileNumber}
              </a>
            )}
            {shop.mobileNumber && (
              <a href={`https://wa.me/91${shop.mobileNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
            )}
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Navigation className="w-4 h-4" />Navigate
            </a>
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-400" />
              {isFertilizer ? 'Available Products' : 'Available Plants'} ({products.length})
            </h2>
          </div>

          {/* Sub-category filter tabs */}
          {subcatKeys.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setActiveSubcat('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeSubcat === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
              >
                All ({products.length})
              </button>
              {subcatKeys.map(key => {
                const cfg = subcatConfig[key] || { label: key, emoji: '📦' };
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSubcat(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeSubcat === key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                  >
                    {cfg.emoji} {cfg.label} ({subcatGroups[key].length})
                  </button>
                );
              })}
            </div>
          )}

          {displayProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No products listed yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProducts.map(p => (
                <ProductCard key={p._id} product={p} isFertilizer={isFertilizer} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product: p, isFertilizer }: { product: any; isFertilizer: boolean }) {
  const name = isFertilizer ? p.productName : p.plantName;
  const subtitle = isFertilizer
    ? [p.brandName, p.cropType && `For: ${p.cropType}`, p.variety].filter(Boolean).join(' · ')
    : p.variety;
  const price = isFertilizer ? p.sellingPrice : p.price;
  const mrp = isFertilizer ? p.mrp : null;
  const qty = isFertilizer ? `${p.quantity} ${p.unit}` : `${p.availableQuantity} plants`;
  const subcatCfg = isFertilizer ? (FERT_SUBCATS[p.productSubCategory] || { label: p.productSubCategory, emoji: '📦' }) : null;
  const img = p.productImages?.[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-gray-100 overflow-hidden relative">
        {img ? (
          <img src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '')}${img}`}
            alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-4xl">
            {isFertilizer ? (FERT_SUBCATS[p.productSubCategory]?.emoji || '🌱') : '🌿'}
          </div>
        )}
        {subcatCfg && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
            {subcatCfg.emoji} {subcatCfg.label}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 leading-tight">{name}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{subtitle}</p>}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="font-bold text-emerald-600 text-lg">₹{price}</span>
            {mrp && mrp > price && (
              <span className="text-xs text-gray-400 line-through ml-1">₹{mrp}</span>
            )}
          </div>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold">In Stock</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Available: {qty}</p>
        {p.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{p.description}</p>}
      </div>
    </div>
  );
}
