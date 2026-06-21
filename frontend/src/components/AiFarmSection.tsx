'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FaLeaf, FaSpinner, FaSeedling } from 'react-icons/fa';
import { getCropRecommendations, CropRecommendationRequest } from '@/services/cropRecommendation';
import { useAuth } from '@/context/AuthContext';
import TasksCard from '@/components/dashboard/TasksCard';

const quickCrops = ['Wheat', 'Rice', 'Maize', 'Cotton', 'Soybean', 'Sugarcane'];

export default function AiFarmSection() {
  const { isAuthenticated } = useAuth();
  const [selectedCrop, setSelectedCrop] = useState('');
  const [soilType, setSoilType] = useState('Alluvial');
  const [season, setSeason] = useState('Kharif');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleQuickAdvisory = async () => {
    if (!isAuthenticated) {
      setError('Please login to get crop advisory.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const req: CropRecommendationRequest = {
        farmArea: 1,
        areaUnit: 'acre',
        state: 'Uttar Pradesh',
        district: 'General',
        soilType,
        soilPH: 7,
        waterAvailability: 'medium',
        irrigationType: 'Canal',
        season,
        farmingType: 'conventional',
        budget: 50000,
        preferredCrop: selectedCrop || undefined,
      };
      const res = await getCropRecommendations(req);
      const top3 = res.recommendations.slice(0, 3).map((r) => `${r.cropName} (${r.suitabilityScore}%)`).join(', ');
      setResult(`Top crops for ${soilType} soil in ${season}: ${top3}`);
    } catch (err: any) {
      setError(err.message || 'Advisory failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative -mt-2 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(236,253,245,0.92)_40%,_rgba(239,246,255,0.95)_100%)] py-6 sm:py-8 lg:py-10">
      <div className="pointer-events-none absolute -left-20 top-8 h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />

      <div className="section-container relative z-10">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* AI Crop Advisor Card */}
          <div className="group relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-5 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaLeaf className="text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">AI Crop Advisor</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">AI-Powered</span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Soil Type</label>
                    <select
                      value={soilType}
                      onChange={(e) => setSoilType(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      {['Alluvial', 'Black', 'Red', 'Loamy', 'Sandy', 'Clay', 'Laterite'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Season</label>
                    <select
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      {['Kharif', 'Rabi', 'Zaid', 'Year-round'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Quick crop pick (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {quickCrops.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedCrop(selectedCrop === c ? '' : c)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          selectedCrop === c
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {result && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
                    <FaSeedling className="inline mr-1" />
                    {result}
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{error}</div>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleQuickAdvisory}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaLeaf />}
                  {loading ? 'Analyzing…' : 'Quick Advisory'}
                </button>
                <Link
                  href="/crop-recommendation"
                  className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                >
                  Full Advisor <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Today's Tasks — Live AI Farm Manager */}
          <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
            <TasksCard />
          </div>
        </div>
      </div>
    </section>
  );
}
