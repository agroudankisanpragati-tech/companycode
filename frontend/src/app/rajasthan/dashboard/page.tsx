"use client";

import { useEffect, useState } from 'react';
import { fetchRajasthanAIContext, type RajasthanAIContext } from '@/services/rajasthanApi';

function DashboardCards({ context }: { context: RajasthanAIContext }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Farm Profile</h2>
        <p className="mt-3 text-slate-600">{context.farmer?.name ?? 'No farmer data loaded yet.'}</p>
        <p className="mt-2 text-slate-500">{context.farmer?.location?.district}, {context.farmer?.location?.state}</p>
      </article>
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Soil Moisture</h2>
        <p className="mt-3 text-slate-600">{context.soilMoisture?.percentage ? `${context.soilMoisture.percentage}%` : 'No soil moisture data'}</p>
        <p className="mt-2 text-slate-500">{context.soilMoisture?.status ?? 'N/A'}</p>
      </article>
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Weather</h2>
        <p className="mt-3 text-slate-600">{context.weather?.condition ?? 'No weather data'}</p>
        <p className="mt-2 text-slate-500">{context.weather?.temp ? `${context.weather.temp}°C` : ''}</p>
      </article>
    </div>
  );
}

export default function RajasthanDashboardPage() {
  const [context, setContext] = useState<RajasthanAIContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRajasthanAIContext();
        setContext(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan Farmer Dashboard</h1>
        <p className="mt-3 text-slate-600 leading-7">
          This dashboard uses your farmer profile, soil moisture, and local weather from the main backend.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">Loading dashboard information…</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : context ? (
        <DashboardCards context={context} />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">No dashboard data available.</div>
      )}
    </main>
  );
}
