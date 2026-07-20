'use client';

import { useState } from 'react';
import { FaMapMarkerAlt, FaExternalLinkAlt, FaExclamationTriangle } from 'react-icons/fa';
import { mapsEmbedUrl, mapsNavUrl } from '@/services/locationService';

interface Props {
  latitude: number;
  longitude: number;
  label?: string;
  zoom?: number;
  height?: number;
  showNavButton?: boolean;
}

export default function MapCard({
  latitude,
  longitude,
  label,
  zoom = 14,
  height = 220,
  showNavButton = true,
}: Props) {
  const [embedError, setEmbedError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const embedSrc = mapsEmbedUrl(latitude, longitude, zoom);
  const navUrl = mapsNavUrl(latitude, longitude);
  const isOSM = embedSrc.includes('openstreetmap.org');

  if (!latitude || !longitude) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-center p-6"
        style={{ height }}
      >
        <FaExclamationTriangle className="text-amber-400 mb-2" size={22} />
        <p className="text-sm font-semibold text-amber-700">Location not available</p>
        <p className="text-xs text-amber-600 mt-1">Coordinates are missing for this location.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Map iframe */}
      <div className="relative bg-slate-100" style={{ height }}>
        {!loaded && !embedError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
              <p className="text-xs">Loading map...</p>
            </div>
          </div>
        )}

        {embedError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <FaMapMarkerAlt className="text-emerald-500 mb-2" size={28} />
            <p className="text-sm font-semibold text-slate-700">
              {label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
            </p>
            <p className="text-xs text-slate-400 mt-1">Map preview unavailable</p>
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
            >
              <FaExternalLinkAlt size={10} /> Open in Google Maps
            </a>
          </div>
        ) : (
          <iframe
            src={embedSrc}
            width="100%"
            height={height}
            style={{ border: 0, display: loaded ? 'block' : 'none' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={label || 'Map'}
            onLoad={() => setLoaded(true)}
            onError={() => setEmbedError(true)}
          />
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
          <FaMapMarkerAlt className="text-emerald-500 flex-shrink-0" size={11} />
          <span className="truncate">
            {label || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </span>
          {isOSM && (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 flex-shrink-0">
              OSM
            </span>
          )}
        </div>
        {showNavButton && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            <FaExternalLinkAlt size={9} /> Navigate
          </a>
        )}
      </div>
    </div>
  );
}
