'use client';

import { useEffect, useState } from 'react';
import { FaLeaf, FaRobot, FaDatabase, FaDollarSign, FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { API_BASE } from '@/components/admin/admin-api';

interface AnalyticsData {
  totalFarmerRequests: number;
  totalAICalls: number;
  totalCachedRecommendations: number;
  estimatedApiCostSavings: string;
  feedback: { helpful: number; notHelpful: number };
  mostRecommendedCrops: { cropName: string; count: number; category: string }[];
  categoryAnalytics: { category: string; count: number }[];
}

const categoryColors: Record<string, string> = {
  Traditional: 'bg-amber-100 text-amber-800',
  Medicinal: 'bg-purple-100 text-purple-800',
  Fruit: 'bg-emerald-100 text-emerald-800',
  Vegetable: 'bg-sky-100 text-sky-800',
};

export default function AIAnalyticsPage() {
  const { token } = useAdmin();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchAnalytics();
  }, [token]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/ai-analytics`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>
    );
  }

  if (!data) return null;

  const totalFeedback = data.feedback.helpful + data.feedback.notHelpful;
  const helpfulPct = totalFeedback > 0 ? Math.round((data.feedback.helpful / totalFeedback) * 100) : 0;
  const cacheHitRate = data.totalFarmerRequests > 0
    ? Math.round((data.totalCachedRecommendations / data.totalFarmerRequests) * 100)
    : 0;

  const statCards = [
    { label: 'Total Farmer Requests', value: data.totalFarmerRequests, icon: FaLeaf, accent: 'from-emerald-500 to-teal-500' },
    { label: 'Total AI (OpenAI) Calls', value: data.totalAICalls, icon: FaRobot, accent: 'from-purple-500 to-violet-500' },
    { label: 'Cached Recommendations', value: data.totalCachedRecommendations, icon: FaDatabase, accent: 'from-cyan-500 to-blue-500' },
    { label: 'API Cost Savings', value: data.estimatedApiCostSavings, icon: FaDollarSign, accent: 'from-amber-400 to-orange-500', isString: true },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Crop Recommendation Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">Monitor AI usage, cost savings, and recommendation performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-panel rounded-2xl p-5">
            <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${card.accent} p-2.5 text-white`}>
              <card.icon size={18} />
            </div>
            <p className="text-2xl font-extrabold text-white">{card.isString ? card.value : (card.value as number).toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Cache Rate + Feedback */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cache Hit Rate */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Cache Hit Rate</h3>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-extrabold text-cyan-400">{cacheHitRate}%</p>
            <p className="mb-1 text-sm text-slate-400">requests served from cache</p>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all" style={{ width: `${cacheHitRate}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Each cached request saves ~$0.01 OpenAI API cost
          </p>
        </div>

        {/* Feedback */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Farmer Feedback</h3>
          {totalFeedback === 0 ? (
            <p className="text-sm text-slate-500">No feedback collected yet</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FaThumbsUp className="text-emerald-400" />
                  <span className="text-xl font-bold text-white">{data.feedback.helpful}</span>
                  <span className="text-xs text-slate-400">Helpful</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaThumbsDown className="text-red-400" />
                  <span className="text-xl font-bold text-white">{data.feedback.notHelpful}</span>
                  <span className="text-xs text-slate-400">Not Helpful</span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${helpfulPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{helpfulPct}% positive feedback</p>
            </>
          )}
        </div>
      </div>

      {/* Top Crops */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Most Recommended Crops</h3>
        {data.mostRecommendedCrops.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet</p>
        ) : (
          <div className="space-y-3">
            {data.mostRecommendedCrops.map((crop, i) => {
              const maxCount = data.mostRecommendedCrops[0].count;
              const pct = Math.round((crop.count / maxCount) * 100);
              return (
                <div key={crop.cropName} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-slate-500">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{crop.cropName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[crop.category] || 'bg-gray-700 text-gray-300'}`}>
                          {crop.category}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{crop.count}x</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Analytics */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Recommendations by Category</h3>
        {data.categoryAnalytics.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.categoryAnalytics.map((cat) => (
              <div key={cat.category} className="rounded-xl bg-white/5 p-4 text-center">
                <p className="text-2xl font-extrabold text-white">{cat.count}</p>
                <p className="mt-1 text-xs text-slate-400">{cat.category}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[cat.category] || 'bg-gray-700 text-gray-300'}`}>
                  {cat.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
