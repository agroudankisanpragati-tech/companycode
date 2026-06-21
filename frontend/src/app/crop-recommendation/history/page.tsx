'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getRecommendationHistory } from '@/services/cropRecommendation';
import { useAuth } from '@/context/AuthContext';

interface HistoryEntry {
  request: {
    _id: string;
    farmArea: number;
    areaUnit: string;
    soilType: string;
    season: string;
    district: string;
    state: string;
    budget: number;
    createdAt: string;
  };
  recommendations: Array<{ cropName: string; suitabilityScore: number; cropCategory: string }>;
  source: 'database' | 'openai' | null;
  recommendationId: string | null;
}

export default function RecommendationHistoryPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth'); return; }
    fetchHistory();
  }, [isAuthenticated, page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getRecommendationHistory(page, limit);
      setHistory(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">My Recommendation History</h1>
            <p className="mt-1 text-sm text-slate-500">{total} requests made</p>
          </div>
          <Link
            href="/crop-recommendation"
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            + New Request
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
            <p className="text-4xl mb-3">🌾</p>
            <p className="text-slate-600 font-medium">No recommendations yet.</p>
            <Link href="/crop-recommendation" className="mt-4 inline-block rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Get Your First Recommendation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.request._id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {entry.request.farmArea} {entry.request.areaUnit} — {entry.request.soilType} Soil
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.source === 'openai' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {entry.source === 'openai' ? '🤖 AI' : '📊 Database'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.request.district}, {entry.request.state} · {entry.request.season} season · Budget: ₹{entry.request.budget.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(entry.request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {entry.recommendationId && (
                    <Link
                      href={`/crop-recommendation/${entry.recommendationId}`}
                      className="rounded-xl border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      View Details →
                    </Link>
                  )}
                </div>

                {entry.recommendations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.recommendations.slice(0, 5).map((rec) => (
                      <span key={rec.cropName} className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {rec.cropName}
                        <span className="font-bold text-emerald-600">{rec.suitabilityScore}%</span>
                      </span>
                    ))}
                    {entry.recommendations.length > 5 && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-slate-500">
                        +{entry.recommendations.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total / limit)}</span>
                <button
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
