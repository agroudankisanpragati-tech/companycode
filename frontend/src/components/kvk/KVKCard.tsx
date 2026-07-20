'use client';

import { useState } from 'react';
import {
  FaMapMarkerAlt, FaPhone, FaEnvelope, FaClock, FaCopy, FaCheck,
  FaGlobe, FaChevronDown, FaChevronUp, FaMap,
} from 'react-icons/fa';
import { KVKCenter } from '@/services/kvk';
import DistanceBadge from './DistanceBadge';
import NavigationButton from './NavigationButton';
import { lazy, Suspense } from 'react';

const MapCard = lazy(() => import('./MapCard'));

interface Props {
  kvk: KVKCenter;
  rank?: number;
  compact?: boolean;
}

export default function KVKCard({ kvk, rank, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const copyAddress = () => {
    const text = [kvk.name, kvk.address, kvk.village, kvk.district, kvk.state, kvk.pincode]
      .filter(Boolean).join(', ');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md ${compact ? 'p-4' : 'p-5'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200">
            <FaMapMarkerAlt className="text-white" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {rank === 1 && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                  Nearest
                </span>
              )}
              <h3 className="font-bold text-slate-900 text-base leading-tight">{kvk.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {kvk.district}, {kvk.state}
            </p>
          </div>
        </div>

        <DistanceBadge distanceKm={kvk.distanceKm} />
      </div>

      {/* Address */}
      <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
        <FaMapMarkerAlt className="flex-shrink-0 mt-0.5 text-slate-400" size={12} />
        <span className="leading-relaxed">
          {[kvk.address, kvk.village, kvk.district, kvk.state, kvk.pincode].filter(Boolean).join(', ')}
        </span>
      </div>

      {/* Contact info */}
      {!compact && (
        <div className="mt-3 space-y-1.5">
          {kvk.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FaPhone className="flex-shrink-0 text-emerald-500" size={11} />
              <a href={`tel:${kvk.phone}`} className="hover:text-emerald-600 transition">{kvk.phone}</a>
              {kvk.altPhone && <span className="text-slate-400">/ {kvk.altPhone}</span>}
            </div>
          )}
          {kvk.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FaEnvelope className="flex-shrink-0 text-blue-500" size={11} />
              <a href={`mailto:${kvk.email}`} className="hover:text-blue-600 transition truncate">{kvk.email}</a>
            </div>
          )}
          {kvk.officeTimings && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FaClock className="flex-shrink-0 text-amber-500" size={11} />
              <span>{kvk.officeTimings}</span>
            </div>
          )}
          {kvk.website && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FaGlobe className="flex-shrink-0 text-purple-500" size={11} />
              <a href={kvk.website} target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition truncate">
                {kvk.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {kvk.servicesOffered && kvk.servicesOffered.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {kvk.servicesOffered.slice(0, 4).map((s, i) => (
                <span key={i} className="rounded-full bg-teal-50 border border-teal-100 px-2.5 py-0.5 text-xs text-teal-700 font-medium">
                  {s}
                </span>
              ))}
              {kvk.servicesOffered.length > 4 && (
                <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
                  +{kvk.servicesOffered.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <NavigationButton latitude={kvk.latitude} longitude={kvk.longitude} />

        {kvk.phone && (
          <a
            href={`tel:${kvk.phone}`}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition"
          >
            <FaPhone size={11} /> Call
          </a>
        )}

        <button
          onClick={copyAddress}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-100 transition"
        >
          {copied ? <FaCheck size={11} className="text-emerald-500" /> : <FaCopy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {!compact && kvk.latitude && kvk.longitude && (
          <button
            onClick={() => setShowMap(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-100 transition ml-auto"
          >
            <FaMap size={11} />
            {showMap ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            Map
          </button>
        )}
      </div>

      {/* Expandable map */}
      {showMap && kvk.latitude && kvk.longitude && (
        <div className="mt-3">
          <Suspense fallback={
            <div className="h-48 rounded-2xl bg-slate-100 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
            </div>
          }>
            <MapCard
              latitude={kvk.latitude}
              longitude={kvk.longitude}
              label={kvk.name}
              height={200}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
