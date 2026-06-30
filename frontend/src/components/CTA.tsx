'use client';

import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-500 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-lime-400/20 blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
          Start your farming assistant today
        </h2>
        <p className="text-base md:text-lg text-emerald-100 mb-8 max-w-xl mx-auto">
          Crop advice, weather alerts, mandi prices, and scheme guidance — all in one place.
        </p>
        <Link
          href="/auth/role-select"
          className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-emerald-700 shadow-xl shadow-emerald-900/20 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
        >
          Get Started Free
          <FaArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
