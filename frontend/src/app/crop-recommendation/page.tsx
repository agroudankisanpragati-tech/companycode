'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FarmerInputForm from '@/components/crop/FarmerInputForm';
import CropCard from '@/components/crop/CropCard';
import {
  getCropRecommendations,
  CropRecommendationRequest,
  RecommendationResponse,
} from '@/services/cropRecommendation';
import { useAuth } from '@/context/AuthContext';
import AILanguageSelector from '@/components/AILanguageSelector';

type Step = 'form' | 'results';

function CropRecommendationContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [displayRecommendations, setDisplayRecommendations] = useState<RecommendationResponse['recommendations'] | null>(null);
  const [prefill, setPrefill] = useState<Partial<CropRecommendationRequest>>({});
  const [prefillBanner, setPrefillBanner] = useState('');
  // Farmer GPS/location for seed shop proximity
  const [farmerLat, setFarmerLat] = useState<number | undefined>();
  const [farmerLng, setFarmerLng] = useState<number | undefined>();
  const [farmerTehsil, setFarmerTehsil] = useState<string | undefined>();

  // Load farmer profile to get GPS coords and village/tehsil
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return;
    fetch('/api/farmer-profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const profile = d?.data;
        if (!profile) return;
        const coords = profile.user?.location?.coordinates;
        if (coords?.latitude) setFarmerLat(coords.latitude);
        if (coords?.longitude) setFarmerLng(coords.longitude);
        if (profile.ext?.tehsil) setFarmerTehsil(profile.ext.tehsil);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!searchParams) return;
    const fromSoil = searchParams.get('fromSoilHealth');
    if (!fromSoil) return;
    const soilType = searchParams.get('soilType') || '';
    const soilPH = parseFloat(searchParams.get('soilPH') || '7');
    const nitrogen = parseFloat(searchParams.get('nitrogen') || '0') || undefined;
    const phosphorus = parseFloat(searchParams.get('phosphorus') || '0') || undefined;
    const potassium = parseFloat(searchParams.get('potassium') || '0') || undefined;
    const organicCarbon = parseFloat(searchParams.get('organicCarbon') || '0') || undefined;
    const ecValue = parseFloat(searchParams.get('ec') || '0') || undefined;
    const data: Partial<CropRecommendationRequest> = {};
    if (soilType) data.soilType = soilType;
    if (!isNaN(soilPH)) data.soilPH = soilPH;
    if (nitrogen) data.nitrogen = nitrogen;
    if (phosphorus) data.phosphorus = phosphorus;
    if (potassium) data.potassium = potassium;
    if (organicCarbon) data.organicCarbon = organicCarbon;
    if (ecValue) data.ecValue = ecValue;
    setPrefill(data);
    setPrefillBanner('Soil data pre-filled from your Soil Health Analysis. Complete the remaining fields and get crop recommendations.');
  }, [searchParams]);

  const handleSubmit = async (data: CropRecommendationRequest) => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getCropRecommendations(data);
      setResult(res);
      setDisplayRecommendations(null);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (!result?.recommendationId) return;
    try {
      const { submitFeedback } = await import('@/services/cropRecommendation');
      await submitFeedback(result.recommendationId, type);
      setFeedback(type);
    } catch {
      // silent fail for feedback
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            AI-Powered
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Crop Recommendation System
          </h1>
          <p className="mt-2 text-slate-500 text-sm md:text-base max-w-xl mx-auto">
            Enter your farm details to get personalized crop recommendations based on soil, water, climate, and budget.
          </p>
        </div>

        {/* Steps Indicator */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <StepBadge num={1} label="Farm Details" active={step === 'form'} done={step === 'results'} />
          <div className="h-px w-12 bg-gray-200" />
          <StepBadge num={2} label="Recommendations" active={step === 'results'} done={false} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Login Notice */}
        {!isAuthenticated && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Please{' '}
            <button onClick={() => router.push('/auth')} className="font-bold underline">login</button>
            {' '}to get personalized recommendations.
          </div>
        )}

        {step === 'form' && (
          <FarmerInputForm onSubmit={handleSubmit} loading={loading} prefill={prefill} prefillBanner={prefillBanner} />
        )}

        {step === 'results' && result && (
          <div className="space-y-6">
            {/* Result Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {result.recommendations.length} Crops Recommended
                </h2>
                <p className="text-sm text-slate-500">{result.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  result.source === 'openai' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {result.source === 'openai' ? '🤖 AI Generated' : '📊 From Database'}
                </span>
                {result.similarityScore && (
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {result.similarityScore}% Match
                  </span>
                )}
              </div>
            </div>

            {/* Language Selector */}
            {result.requestId && (
              <AILanguageSelector
                recordId={result.requestId}
                module="crop-recommendation"
                englishData={{ recommendations: result.recommendations }}
                onTranslated={(lang, data) => {
                  if (lang === 'en') setDisplayRecommendations(null);
                  else if (data?.recommendations) setDisplayRecommendations(data.recommendations);
                }}
              />
            )}

            {/* Category Filter Tabs */}
            <CategoryTabs
              recommendations={displayRecommendations || result.recommendations}
              source={result.source}
              farmerVillage={result.farmerVillage}
              farmerTehsil={farmerTehsil}
              farmerDistrict={result.farmerDistrict}
              farmerState={result.farmerState}
              farmerLat={farmerLat}
              farmerLng={farmerLng}
            />

            {/* Feedback */}
            <div className="rounded-2xl border border-gray-100 bg-white px-6 py-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-700">Were these recommendations helpful?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback('helpful')}
                  disabled={!!feedback}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    feedback === 'helpful' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  👍 Yes
                </button>
                <button
                  onClick={() => handleFeedback('not_helpful')}
                  disabled={!!feedback}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    feedback === 'not_helpful' ? 'bg-red-500 text-white' : 'border border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  👎 No
                </button>
              </div>
              {feedback && (
                <p className="text-xs text-slate-500">Thanks for your feedback!</p>
              )}
            </div>

            {/* Try Again Button */}
            <button
              onClick={() => { setStep('form'); setResult(null); setDisplayRecommendations(null); setFeedback(null); setError(''); }}
              className="w-full rounded-2xl border border-emerald-200 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
            >
              ← Try Different Conditions
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CropRecommendationPage() {
  return (
    <Suspense>
      <CropRecommendationContent />
    </Suspense>
  );
}

function CategoryTabs({ recommendations, source, farmerVillage, farmerTehsil, farmerDistrict, farmerState, farmerLat, farmerLng }: {
  recommendations: RecommendationResponse['recommendations'];
  source: 'database' | 'openai';
  farmerVillage?: string;
  farmerTehsil?: string;
  farmerDistrict?: string;
  farmerState?: string;
  farmerLat?: number;
  farmerLng?: number;
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(recommendations.map((r) => r.cropCategory)))];
  const filtered = activeCategory === 'All' ? recommendations : recommendations.filter((r) => r.cropCategory === activeCategory);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              activeCategory === cat ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-slate-600 hover:bg-gray-50'
            }`}
          >
            {cat} ({cat === 'All' ? recommendations.length : recommendations.filter((r) => r.cropCategory === cat).length})
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((crop) => (
          <CropCard
            key={crop.cropName}
            crop={crop}
            source={source}
            rank={recommendations.indexOf(crop) + 1}
            farmerVillage={farmerVillage}
            farmerTehsil={farmerTehsil}
            farmerDistrict={farmerDistrict}
            farmerState={farmerState}
            farmerLat={farmerLat}
            farmerLng={farmerLng}
          />
        ))}
      </div>
    </div>
  );
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
        done ? 'bg-emerald-500 text-white' :
        active ? 'bg-emerald-600 text-white' :
        'bg-gray-100 text-gray-400'
      }`}>
        {done ? '✓' : num}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}
