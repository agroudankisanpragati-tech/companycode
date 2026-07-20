'use client';

import { ScanResult } from './types';

const SEVERITY_CONFIG: Record<string, {
  color: string; bg: string; border: string; bar: string;
  label: string; emoji: string; desc: string;
}> = {
  critical: { color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/40',     border: 'border-red-200 dark:border-red-800',     bar: 'bg-red-500',     label: 'Critical',  emoji: '🔴', desc: 'Immediate action required' },
  high:     { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', bar: 'bg-orange-500',  label: 'High',      emoji: '🟠', desc: 'Act within 24–48 hours' },
  medium:   { color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40',  border: 'border-amber-200 dark:border-amber-800',  bar: 'bg-amber-500',   label: 'Medium',    emoji: '🟡', desc: 'Monitor and treat soon' },
  low:      { color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-950/40',  border: 'border-green-200 dark:border-green-800',  bar: 'bg-green-500',   label: 'Low',       emoji: '🟢', desc: 'Preventive care advised' },
  healthy:  { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500', label: 'Healthy', emoji: '✅', desc: 'No disease detected' },
};

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  fungal:                { emoji: '🍄', label: 'Fungal',    color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40' },
  bacterial:             { emoji: '🦠', label: 'Bacterial', color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950/40' },
  viral:                 { emoji: '⚡', label: 'Viral',     color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  pest:                  { emoji: '🐛', label: 'Pest',      color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  'nutrient deficiency': { emoji: '🌱', label: 'Nutrient',  color: 'text-teal-700 dark:text-teal-400',    bg: 'bg-teal-50 dark:bg-teal-950/40' },
  healthy:               { emoji: '🌿', label: 'Healthy',   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
};

function ConfidenceRing({ value }: { value: number }) {
  const size = 88;
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#dc2626';

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} className="dark:stroke-slate-700" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{value}%</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">AI Confidence</p>
      <span className={`mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        value >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
          : value >= 60 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
          : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
      }`}>
        {value >= 80 ? 'High' : value >= 60 ? 'Medium' : 'Low'}
      </span>
    </div>
  );
}

export default function ConfidenceCard({ result }: { result: ScanResult }) {
  const sev = SEVERITY_CONFIG[result.severityLevel?.toLowerCase()] || SEVERITY_CONFIG.low;
  const typeKey = result.diseaseType?.toLowerCase() || '';
  const type = Object.entries(TYPE_CONFIG).find(([k]) => typeKey.includes(k))?.[1]
    || { emoji: '🌱', label: result.diseaseType || 'Unknown', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' };

  const cols = [
    result.confidenceScore != null,
    result.similarityScore != null,
    true, // severity always shown
    true, // type always shown
  ].filter(Boolean).length;

  return (
    <div className={`grid gap-3 ${cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {result.confidenceScore != null && (
        <ConfidenceRing value={result.confidenceScore} />
      )}

      {result.similarityScore != null && (
        <div className="flex flex-col justify-center rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Match Score</p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{result.similarityScore}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700"
              style={{ width: `${result.similarityScore}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">Knowledge Base</p>
        </div>
      )}

      {/* Severity */}
      <div className={`flex flex-col justify-center rounded-2xl border p-4 shadow-sm ${sev.bg} ${sev.border}`}>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Severity</p>
        <p className="text-2xl">{sev.emoji}</p>
        <p className={`text-base font-extrabold mt-1 ${sev.color}`}>{sev.label}</p>
        <p className={`text-[10px] mt-0.5 ${sev.color} opacity-70`}>{sev.desc}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 dark:bg-black/20 overflow-hidden">
          <div className={`h-full rounded-full ${sev.bar} transition-all duration-700`}
            style={{ width: sev.label === 'Critical' ? '100%' : sev.label === 'High' ? '75%' : sev.label === 'Medium' ? '50%' : '25%' }} />
        </div>
      </div>

      {/* Disease type */}
      <div className={`flex flex-col justify-center rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm ${type.bg}`}>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Category</p>
        <p className="text-2xl">{type.emoji}</p>
        <p className={`text-base font-extrabold mt-1 ${type.color}`}>{type.label}</p>
        {result.affectedPlantPart && (
          <p className="text-[10px] mt-0.5 text-slate-500 dark:text-slate-400">Affects: {result.affectedPlantPart}</p>
        )}
      </div>
    </div>
  );
}
