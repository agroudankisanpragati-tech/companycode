'use client';

import { useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { RecommendationItem } from '@/services/cropRecommendation';
import { addMyCrop } from '@/services/myCrops';
import NearbySeedShops from './NearbySeedShops';
import RecommendedProducts from './RecommendedProducts';

const VoicePlayer = lazy(() => import('@/components/VoicePlayer'));

const categoryColors: Record<string, string> = {
  Traditional: 'bg-amber-100 text-amber-800',
  Medicinal: 'bg-purple-100 text-purple-800',
  Fruit: 'bg-emerald-100 text-emerald-800',
  Vegetable: 'bg-sky-100 text-sky-800',
};

const riskColors: Record<string, string> = {
  low: 'text-emerald-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
};

const demandColors: Record<string, string> = {
  high: 'text-emerald-700 bg-emerald-50',
  medium: 'text-amber-700 bg-amber-50',
  low: 'text-red-700 bg-red-50',
};

interface CropCardProps {
  crop: RecommendationItem;
  source: 'database' | 'openai';
  rank: number;
  farmerVillage?: string;
  farmerTehsil?: string;
  farmerDistrict?: string;
  farmerState?: string;
  farmerLat?: number;
  farmerLng?: number;
}

export default function CropCard({ crop, source, rank, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng }: CropCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const scoreColor =
    crop.suitabilityScore >= 85 ? 'text-emerald-600' :
    crop.suitabilityScore >= 70 ? 'text-amber-600' : 'text-red-500';

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAddToMyCrops = async () => {
    if (saved) return;
    setSaving(true);
    try {
      await addMyCrop({
        cropName: crop.cropName,
        category: crop.cropCategory,
        description: crop.whySuitable,
        cultivationGuide: crop.cultivationGuide,
        suitabilityScore: crop.suitabilityScore,
        estimatedYield: crop.estimatedYield,
        estimatedCultivationCost: crop.estimatedCultivationCost,
        expectedRevenue: crop.expectedRevenue,
        expectedProfit: crop.expectedProfit,
        waterRequirement: crop.waterRequirement,
        fertilizerRequirement: crop.fertilizerRequirement,
        fertilizerCost: crop.fertilizerCost,
        seedRequirement: crop.seedRequirement,
        recommendedSeedVariety: crop.recommendedSeedVariety,
        currentMarketPrice: crop.currentMarketPrice,
        marketDemand: crop.marketDemand,
        riskLevel: crop.riskLevel,
        recommendationSource: source,
      });
      setSaved(true);
      showToast('Crop added successfully to My Crops.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save crop.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Build TTS text for "Listen Recommendation"
  const ttsEnglish = [
    `${crop.cropName} is recommended.`,
    crop.whySuitable,
    `Expected yield: ${crop.estimatedYield}.`,
    crop.bestSowingTime ? `Best sowing time: ${crop.bestSowingTime}.` : '',
    `Market demand: ${crop.marketDemand}.`,
    `Expected profit: ₹${crop.expectedProfit?.toLocaleString('en-IN')} per acre.`,
  ].filter(Boolean).join(' ');

  const ttsHindi = [
    crop.cropNameHindi ? `${crop.cropNameHindi} की सिफारिश की जाती है।` : '',
    crop.whySuitableHindi || '',
    crop.estimatedYieldHindi ? `अपेक्षित उपज: ${crop.estimatedYieldHindi}।` : '',
    crop.bestSowingTimeHindi ? `बुआई का सही समय: ${crop.bestSowingTimeHindi}।` : '',
    crop.marketDemandHindi ? `बाजार मांग: ${crop.marketDemandHindi}।` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`absolute top-3 left-3 right-3 z-20 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg flex items-center justify-between gap-3 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          <span>{toast.msg}</span>
          {toast.type === 'success' && (
            <button onClick={() => router.push('/dashboard/farmer/my-crops')} className="text-xs underline font-bold whitespace-nowrap">
              View My Crops
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm">
            #{rank}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{crop.cropName}</h3>
            {crop.cropNameHindi && <p className="text-xs text-orange-600 font-semibold">{crop.cropNameHindi}</p>}
            <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[crop.cropCategory] || 'bg-gray-100 text-gray-700'}`}>
              {crop.cropCategory}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${scoreColor}`}>{crop.suitabilityScore}%</p>
          <p className="text-xs text-slate-500">Suitability</p>
        </div>
      </div>

      {/* Score Bar */}
      <div className="px-5 pb-3">
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full transition-all ${crop.suitabilityScore >= 85 ? 'bg-emerald-500' : crop.suitabilityScore >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${crop.suitabilityScore}%` }}
          />
        </div>
      </div>

      {/* Listen Recommendation TTS */}
      <div className="px-5 pb-3 flex flex-wrap gap-2">
        {ttsEnglish && (
          <Suspense fallback={null}>
            <VoicePlayer text={ttsEnglish} lang="en-IN" autoDetect={false} label="Listen (EN)" />
          </Suspense>
        )}
        {ttsHindi && (
          <Suspense fallback={null}>
            <VoicePlayer text={ttsHindi} lang="hi-IN" autoDetect={false} label="सुनें (HI)" />
          </Suspense>
        )}
      </div>

      {/* Economic Info */}
      <div className="px-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Economic Information / आर्थिक जानकारी</p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Est. Yield" value={crop.estimatedYield || 'N/A'} sub={crop.estimatedYieldHindi} />
          <Stat label="Cost / Acre" value={crop.estimatedCultivationCost ? `₹${crop.estimatedCultivationCost.toLocaleString('en-IN')}` : 'N/A'} />
          <Stat label="Revenue" value={crop.expectedRevenue ? `₹${crop.expectedRevenue.toLocaleString('en-IN')}` : 'N/A'} highlight />
          <Stat label="Profit" value={crop.expectedProfit ? `₹${crop.expectedProfit.toLocaleString('en-IN')}` : 'N/A'} highlight />
        </div>
      </div>

      {/* Best Sowing Time */}
      {crop.bestSowingTime && (
        <div className="px-5 pb-2">
          <p className="text-xs text-slate-500">Best Sowing Time / बुआई का समय</p>
          <p className="text-sm font-semibold text-emerald-700">{crop.bestSowingTime}</p>
          {crop.bestSowingTimeHindi && <p className="text-xs text-orange-600">{crop.bestSowingTimeHindi}</p>}
        </div>
      )}

      {/* Market Info */}
      <div className="px-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Market Information / बाज़ार जानकारी</p>
        <div className="grid grid-cols-2 gap-2">
          {crop.currentMarketPrice !== undefined && (
            <Stat label="Market Price" value={`₹${crop.currentMarketPrice.toLocaleString('en-IN')}/q`} highlight />
          )}
          {crop.marketDemand && (
            <div>
              <p className="text-xs text-slate-500">Demand / मांग</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${demandColors[crop.marketDemand.toLowerCase()] || 'text-slate-700 bg-gray-50'}`}>
                {crop.marketDemand}{crop.marketDemandHindi ? ` / ${crop.marketDemandHindi}` : ''}
              </span>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">Risk Level / जोखिम</p>
            <p className={`text-sm font-semibold capitalize ${riskColors[crop.riskLevel || 'medium'] || 'text-slate-700'}`}>
              {crop.riskLevel || 'medium'}
            </p>
          </div>
        </div>
      </div>

      {/* Why Suitable */}
      {crop.whySuitable && (
        <div className="mx-5 mb-3 rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">Why Suitable / क्यों उपयुक्त</p>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{crop.whySuitable}</p>
          {crop.whySuitableHindi && <p className="text-xs text-orange-700 leading-relaxed mt-1 italic line-clamp-3">{crop.whySuitableHindi}</p>}
        </div>
      )}

      {/* Risks */}
      {crop.risks && (
        <div className="mx-5 mb-3 rounded-xl bg-red-50 px-4 py-2">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Risks / जोखिम</p>
          <p className="text-xs text-slate-600 line-clamp-2">{crop.risks}</p>
          {crop.risksHindi && <p className="text-xs text-red-600 italic mt-0.5 line-clamp-2">{crop.risksHindi}</p>}
        </div>
      )}

      {/* Cultivation Guide */}
      {crop.cultivationGuide && (
        <details className="mx-5 mb-3">
          <summary className="cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-900 focus:outline-none">
            View Cultivation Guide / खेती गाइड ▾
          </summary>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-line">{crop.cultivationGuide}</p>
          {crop.cultivationGuideHindi && <p className="mt-1 text-xs text-orange-700 leading-relaxed whitespace-pre-line italic">{crop.cultivationGuideHindi}</p>}
        </details>
      )}

      {/* Resource Info */}
      <div className="px-5 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Water" value={crop.waterRequirement || 'N/A'} capitalize />
          {crop.fertilizerRequirement && <Stat label="Fertilizer" value={crop.fertilizerRequirement} />}
          {crop.fertilizerCost !== undefined && <Stat label="Fert. Cost" value={`₹${crop.fertilizerCost.toLocaleString('en-IN')}`} />}
          {crop.seedRequirement && <Stat label="Seed" value={crop.seedRequirement} />}
          {crop.recommendedSeedVariety && <Stat label="Variety" value={crop.recommendedSeedVariety} />}
          {crop.growingDuration ? <Stat label="Duration" value={`${crop.growingDuration} days`} /> : null}
        </div>
      </div>

      {/* Source Badge */}
      <div className="border-t border-gray-50 px-5 py-2">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${source === 'openai' ? 'text-purple-600' : 'text-emerald-600'}`}>
          {source === 'openai' ? '🤖 AI Recommendation' : '📊 Database Recommendation'}
        </span>
      </div>

      <NearbySeedShops cropName={crop.cropName} farmerVillage={farmerVillage} farmerTehsil={farmerTehsil} farmerDistrict={farmerDistrict} farmerState={farmerState} farmerLat={farmerLat} farmerLng={farmerLng} />
      <RecommendedProducts cropName={crop.cropName} farmerVillage={farmerVillage} farmerTehsil={farmerTehsil} farmerDistrict={farmerDistrict} farmerState={farmerState} farmerLat={farmerLat} farmerLng={farmerLng} />

      {/* Add To My Crops Button */}
      <div className="px-5 pb-5 mt-auto">
        <button
          onClick={handleAddToMyCrops}
          disabled={saving || saved}
          aria-label={saved ? 'Crop already added' : 'Add to My Crops'}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
            saved
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-95'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : saved ? '✓ Added to My Crops' : '+ Add To My Crops'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, capitalize, sub }: { label: string; value: string; highlight?: boolean; capitalize?: boolean; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-emerald-700' : 'text-slate-800'} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-orange-600 italic">{sub}</p>}
    </div>
  );
}
