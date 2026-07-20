'use client';

import { FaMapMarkerAlt } from 'react-icons/fa';

interface Props {
  distanceKm?: number;
  className?: string;
}

export default function DistanceBadge({ distanceKm, className = '' }: Props) {
  if (distanceKm == null) return null;

  const color =
    distanceKm <= 10
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : distanceKm <= 30
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className={`inline-flex flex-col items-center rounded-xl border px-3 py-1.5 ${color} ${className}`}>
      <div className="flex items-center gap-1">
        <FaMapMarkerAlt size={9} />
        <span className="text-xs font-bold leading-none">{distanceKm} KM</span>
      </div>
      <span className="text-[10px] mt-0.5 opacity-70">away</span>
    </div>
  );
}
