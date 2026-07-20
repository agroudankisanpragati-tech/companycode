'use client';

import { FaTractor } from 'react-icons/fa';
import type { FullProfile } from './types';

export default function ProfileSummaryCard({ profile }: { profile: FullProfile }) {
  const stats = [
    { label: 'Total Area', value: profile.ext.totalArea ? `${profile.ext.totalArea} acres` : '—' },
    { label: 'Farming Type', value: profile.ext.farmingType || '—' },
    { label: 'Soil Type', value: profile.user.soilType || profile.ext.soilType || '—' },
    { label: 'Water Source', value: profile.user.waterSource || '—' },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-lime-100 text-lime-700 flex items-center justify-center flex-shrink-0">
          <FaTractor size={14} />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">Farm Summary</div>
          <div className="text-xs text-gray-400">Quick overview of your farm data</div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
            <div className="text-sm font-bold text-gray-800 mt-1 truncate">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
