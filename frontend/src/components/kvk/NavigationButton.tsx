'use client';

import { FaDirections } from 'react-icons/fa';
import { mapsNavUrl } from '@/services/locationService';

interface Props {
  latitude: number;
  longitude: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function NavigationButton({
  latitude,
  longitude,
  label = 'Navigate',
  size = 'md',
  className = '',
}: Props) {
  if (!latitude || !longitude) return null;

  const url = mapsNavUrl(latitude, longitude);
  const sizeCls =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs gap-1.5'
      : 'px-4 py-2.5 text-sm gap-2';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all ${sizeCls} ${className}`}
    >
      <FaDirections size={size === 'sm' ? 11 : 13} />
      {label}
    </a>
  );
}
