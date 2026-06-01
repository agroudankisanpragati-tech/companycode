 'use client';

import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

export default function CTA() {
  return (
    <section className="py-8 md:py-14 lg:py-20 bg-gradient-to-r from-green-700 via-emerald-600 to-green-600">
      <div className="section-container px-4">
        <div className="text-center text-white">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6">
            Start your farming assistant
          </h2>
          <p className="text-base md:text-lg mb-6 md:mb-8 text-green-100 max-w-2xl mx-auto">
            Crop advice, weather alerts, and scheme help in one place.
          </p>

          <div className="flex justify-center">
            <Link href="/auth/role-select" className="bg-white text-green-600 px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 text-sm md:text-base min-h-12">
              Get Started <FaArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
