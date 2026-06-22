'use client';

import { Suspense } from 'react';
import SuccessStoriesSection from '@/components/SuccessStoriesSection';
import FarmerHeader from '@/components/FarmerHeader';
import FarmerFooter from '@/components/FarmerFooter';

export default function FarmerStoriesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <FarmerHeader />
      <main className="mx-auto max-w-7xl">
        <div className="px-6 pt-8 pb-2">
          <h1 className="text-3xl font-extrabold text-slate-900">Farmer Success Stories</h1>
          <p className="mt-1 text-slate-500">Watch real farming journeys, learn from experiences, and share your own story.</p>
        </div>
        <Suspense>
          <SuccessStoriesSection />
        </Suspense>
      </main>
      <FarmerFooter />
    </div>
  );
}
