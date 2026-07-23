"use client";

import { useEffect, useState } from 'react';
import { fetchRajasthanProfile, type RajasthanProfile } from '@/services/rajasthanApi';

export default function RajasthanProfilePage() {
  const [profile, setProfile] = useState<RajasthanProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRajasthanProfile();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan Farmer Profile</h1>
        <p className="mt-3 text-slate-600 leading-7">
          This profile is connected to the shared backend so your Rajasthan farmer data is loaded from the main system.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">Loading profile…</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : profile ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Farmer Details</h2>
            <p className="mt-3 text-slate-600">Name: {profile.user.name}</p>
            <p className="mt-2 text-slate-600">Email: {profile.user.email}</p>
            {profile.user.phone && <p className="mt-2 text-slate-600">Phone: {profile.user.phone}</p>}
            <p className="mt-2 text-slate-500">Location: {profile.user.location?.district ?? 'N/A'}, {profile.user.location?.state ?? 'N/A'}</p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Farm Profile</h2>
            <p className="mt-3 text-slate-600">Soil type: {profile.ext.soilType ?? 'N/A'}</p>
            <p className="mt-2 text-slate-600">Water source: {profile.ext.waterSource ?? 'N/A'}</p>
            <p className="mt-2 text-slate-600">District: {profile.ext.district ?? profile.user.location?.district ?? 'N/A'}</p>
          </article>
        </section>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">No farmer profile found.</div>
      )}
    </main>
  );
}
