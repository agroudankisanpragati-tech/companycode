"use client";

import { useEffect, useState } from 'react';
import { fetchRajasthanAIContext, type RajasthanAIContext } from '@/services/rajasthanApi';

export default function RajasthanAssistantPage() {
  const [context, setContext] = useState<RajasthanAIContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRajasthanAIContext();
        setContext(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load assistant context.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan AI Assistant</h1>
        <p className="mt-3 text-slate-600 leading-7">
          Connected to the backend assistant context. This page loads your farmer profile, weather, and soil data from the main system.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">Loading assistant context…</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Farmer Context</h2>
            <p className="mt-3 text-slate-600">Name: {context?.farmer?.name ?? 'N/A'}</p>
            <p className="mt-2 text-slate-600">
              Location: {context?.farmer?.location?.district ?? 'N/A'}, {context?.farmer?.location?.state ?? 'N/A'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Live Data</h2>
            <p className="mt-3 text-slate-600">Soil moisture: {context?.soilMoisture?.percentage ?? 'N/A'}%</p>
            <p className="mt-2 text-slate-600">
              Weather: {context?.weather?.condition ?? 'N/A'} {context?.weather?.temp ? `(${context.weather.temp}°C)` : ''}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
