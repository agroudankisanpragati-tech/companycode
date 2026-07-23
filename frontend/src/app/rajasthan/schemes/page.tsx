"use client";

import { useEffect, useState } from 'react';
import { fetchRajasthanSchemes, type GovtScheme } from '@/services/rajasthanApi';

export default function RajasthanSchemesPage() {
  const [schemes, setSchemes] = useState<GovtScheme[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRajasthanSchemes();
        setSchemes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load schemes.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan Schemes</h1>
        <p className="mt-3 text-slate-600 leading-7">
          Here are the current Rajasthan-specific government schemes available to local farmers.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">Loading schemes…</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {schemes.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              No schemes found. Please check again later.
            </div>
          ) : (
            schemes.map((scheme) => (
              <article key={scheme._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-xl font-semibold text-slate-900">{scheme.title}</h2>
                <p className="mt-2 text-slate-600">{scheme.summary}</p>
                {scheme.state && <p className="mt-3 text-sm text-slate-500">State: {scheme.state}</p>}
              </article>
            ))
          )}
        </section>
      )}
    </main>
  );
}
