'use client';

import { Suspense } from 'react';
import { FaMapMarkerAlt, FaSpinner } from 'react-icons/fa';
import NearestKVKWidget from '@/components/kvk/NearestKVKWidget';
import FarmerHeader from '@/components/FarmerHeader';
import FarmerFooter from '@/components/FarmerFooter';
import { usePageContext } from '@/hooks/usePageContext';

export default function KVKPage() {
  usePageContext({ pageContext: 'kvk' });
  return (
    <>
      <FarmerHeader />
      <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50/40">
        {/* Hero */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 px-4 py-8 sm:py-10 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="mx-auto max-w-3xl relative">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur border border-white/30 shadow-lg">
                <FaMapMarkerAlt className="text-white" size={24} />
              </div>
              <div>
                <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
                  Nearest Center
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mt-1">
                  Krishi Vigyan Kendra
                </h1>
                <p className="mt-1 text-sm text-emerald-100 max-w-md">
                  Find the nearest KVK center for soil testing, seed distribution, training &amp; crop advisory.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <FaSpinner className="animate-spin" size={20} />
              <span className="text-sm">Loading KVK centers...</span>
            </div>
          }>
            <NearestKVKWidget showMap />
          </Suspense>
        </div>
      </main>
      <FarmerFooter />
    </>
  );
}
