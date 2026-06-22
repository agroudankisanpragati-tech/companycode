'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getMyCrops, deleteMyCrop, MyCropEntry } from '@/services/myCrops';
import { aiFosService } from '@/services/aiFos';
import FarmerSidebar from '@/components/FarmerSidebar';
import FarmerFooter from '@/components/FarmerFooter';
import { FaSeedling, FaTrash, FaArrowLeft, FaTimes, FaPlay } from 'react-icons/fa';

const riskColors: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

const demandColors: Record<string, string> = {
  high: 'text-emerald-700 bg-emerald-50',
  medium: 'text-amber-700 bg-amber-50',
  low: 'text-red-700 bg-red-50',
};

export default function MyCropsPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [crops, setCrops] = useState<MyCropEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MyCropEntry | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateForm, setActivateForm] = useState<{ cropId: string; cropName: string } | null>(null);
  const [sowingDate, setSowingDate] = useState(new Date().toISOString().split('T')[0]);
  const [fieldLabel, setFieldLabel] = useState('Field 1');

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    fetchCrops();
  }, [isAuthenticated]);

  const fetchCrops = async () => {
    setLoading(true);
    try {
      const data = await getMyCrops();
      setCrops(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load crops');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!activateForm) return;
    setActivating(activateForm.cropId);
    try {
      await aiFosService.activate(activateForm.cropId, sowingDate, fieldLabel);
      alert(`${activateForm.cropName} activated! Go to AI Farm Manager to see your daily tasks.`);
      setActivateForm(null);
    } catch (err: any) {
      alert(err.message || 'Failed to activate crop');
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this crop from My Crops?')) return;
    setDeleting(id);
    try {
      await deleteMyCrop(id);
      setCrops((prev) => prev.filter((c) => c._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FarmerSidebar open={true} onClose={() => undefined} />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center gap-4">
            <Link href="/dashboard/farmer" className="text-emerald-600 hover:text-emerald-700">
              <FaArrowLeft />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <FaSeedling className="text-emerald-600" /> My Crops
              </h1>
              <p className="text-sm text-slate-500">{crops.length} crops saved</p>
            </div>
            <div className="ml-auto">
              <Link
                href="/crop-recommendation"
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                + Get Recommendations
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            </div>
          ) : crops.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
              <p className="text-5xl mb-4">🌱</p>
              <p className="text-slate-600 font-medium text-lg">No crops added yet.</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Get AI crop recommendations and add them here.</p>
              <Link
                href="/crop-recommendation"
                className="inline-block rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                Get Crop Recommendations
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {crops.map((crop) => (
                <div
                  key={crop._id}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Card image or placeholder */}
                  <div
                    onClick={() => setSelected(crop)}
                    className="h-32 bg-gradient-to-br from-emerald-50 to-lime-100 flex items-center justify-center"
                  >
                    {crop.image ? (
                      <img src={crop.image} alt={crop.cropName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-5xl">🌿</span>
                    )}
                  </div>

                  <div className="flex-1 p-4" onClick={() => setSelected(crop)}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{crop.cropName}</h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 shrink-0">
                        {crop.suitabilityScore}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{crop.category}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {crop.expectedProfit !== undefined && (
                        <div>
                          <p className="text-[10px] text-slate-400">Profit/Bigha</p>
                          <p className="text-sm font-bold text-emerald-700">₹{crop.expectedProfit.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                      {crop.currentMarketPrice !== undefined && (
                        <div>
                          <p className="text-[10px] text-slate-400">Market Price</p>
                          <p className="text-sm font-semibold text-slate-800">₹{crop.currentMarketPrice.toLocaleString('en-IN')}/q</p>
                        </div>
                      )}
                      {crop.estimatedYield && (
                        <div>
                          <p className="text-[10px] text-slate-400">Yield/Bigha</p>
                          <p className="text-sm font-semibold text-slate-800">{crop.estimatedYield}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400">Status</p>
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 capitalize">
                          {crop.status || 'active'}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] text-slate-400">
                      Added {new Date(crop.createdAt || crop.dateAdded).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="border-t border-gray-50 px-4 py-2 flex justify-between items-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActivateForm({ cropId: crop._id, cropName: crop.cropName }); }}
                      className="text-emerald-600 hover:text-emerald-700 text-xs flex items-center gap-1 transition font-semibold"
                    >
                      <FaPlay className="text-[10px]" /> Activate
                    </button>
                    <button
                      onClick={() => handleDelete(crop._id)}
                      disabled={deleting === crop._id}
                      className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 transition"
                    >
                      {deleting === crop._id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-red-300 border-t-red-500" />
                      ) : (
                        <FaTrash />
                      )}
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <FarmerFooter />
      </div>

      {/* Activate modal */}
      {activateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setActivateForm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Activate {activateForm.cropName}</h2>
            <p className="text-xs text-slate-500 mb-4">The AI will generate a full farming timeline and daily tasks.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sowing Date</label>
                <input type="date" value={sowingDate} onChange={(e) => setSowingDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Field Label</label>
                <input type="text" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="e.g. Field 1"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <button onClick={handleActivate} disabled={!!activating}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Activating…</> : <><FaPlay /> Start AI Farm Plan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{selected.cropName}</h2>
                <p className="text-sm text-slate-500">{selected.category}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Suitability */}
              <div className="flex items-center gap-3">
                <div className="text-3xl font-extrabold text-emerald-600">{selected.suitabilityScore}%</div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Suitability Score</p>
                  <div className="h-2 w-32 rounded-full bg-gray-100 mt-1">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${selected.suitabilityScore}%` }}
                    />
                  </div>
                </div>
                {selected.riskLevel && (
                  <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold capitalize ${riskColors[selected.riskLevel] || 'text-slate-600 bg-gray-50'}`}>
                    {selected.riskLevel} risk
                  </span>
                )}
              </div>

              {/* Economic */}
              <Section title="Economic Information">
                <Grid>
                  <InfoItem label="Yield / Bigha" value={selected.estimatedYield} />
                  <InfoItem label="Cost / Bigha" value={selected.estimatedCultivationCost !== undefined ? `₹${selected.estimatedCultivationCost.toLocaleString('en-IN')}` : undefined} />
                  <InfoItem label="Revenue / Bigha" value={selected.expectedRevenue !== undefined ? `₹${selected.expectedRevenue.toLocaleString('en-IN')}` : undefined} highlight />
                  <InfoItem label="Profit / Bigha" value={selected.expectedProfit !== undefined ? `₹${selected.expectedProfit.toLocaleString('en-IN')}` : undefined} highlight />
                </Grid>
              </Section>

              {/* Market */}
              <Section title="Market Information">
                <Grid>
                  <InfoItem label="Market Price" value={selected.currentMarketPrice !== undefined ? `₹${selected.currentMarketPrice.toLocaleString('en-IN')}/quintal` : undefined} highlight />
                  {selected.marketDemand && (
                    <div>
                      <p className="text-xs text-slate-500">Demand</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize mt-1 ${demandColors[selected.marketDemand.toLowerCase()] || 'text-slate-700 bg-gray-50'}`}>
                        {selected.marketDemand}
                      </span>
                    </div>
                  )}
                </Grid>
              </Section>

              {/* Resource */}
              <Section title="Resource Information">
                <Grid>
                  <InfoItem label="Water Requirement" value={selected.waterRequirement} capitalize />
                  <InfoItem label="Fertilizer Requirement" value={selected.fertilizerRequirement} />
                  <InfoItem label="Fertilizer Cost" value={selected.fertilizerCost !== undefined ? `₹${selected.fertilizerCost.toLocaleString('en-IN')}` : undefined} />
                  <InfoItem label="Seed Requirement" value={selected.seedRequirement} />
                  <InfoItem label="Recommended Seed Variety" value={selected.recommendedSeedVariety} />
                </Grid>
              </Section>

              {/* Description */}
              {selected.description && (
                <Section title="Why Suitable">
                  <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>
                </Section>
              )}

              {/* Cultivation Guide */}
              {selected.cultivationGuide && (
                <Section title="Cultivation Guide">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{selected.cultivationGuide}</p>
                </Section>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                {selected.recommendationSource && (
                  <span className={`text-xs font-medium ${selected.recommendationSource === 'openai' ? 'text-purple-600' : 'text-emerald-600'}`}>
                    {selected.recommendationSource === 'openai' ? '🤖 AI Generated' : '📊 Database'}
                  </span>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  Added {new Date(selected.createdAt || selected.dateAdded).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function InfoItem({ label, value, highlight, capitalize }: { label: string; value?: string; highlight?: boolean; capitalize?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-emerald-700' : 'text-slate-800'} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
    </div>
  );
}
