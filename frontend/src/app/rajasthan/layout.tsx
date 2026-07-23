import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Rajasthan AI Seva Mitra | Agroudan Kisan Pragati',
  description: 'Regional Rajasthan farming assistant and dashboard for Kisan Pragati.',
};

export default function RajasthanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
