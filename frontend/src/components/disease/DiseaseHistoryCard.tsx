'use client';

import { useState } from 'react';
import { HistoryItem } from './types';
import { SymptomsCard, OrganicCard, ChemicalCard, PreventionCard } from './InfoCards';
import AILanguageSelector from '@/components/AILanguageSelector';
import { FaChevronDown, FaEye, FaTrash, FaCalendarAlt, FaSeedling, FaPercentage } from 'react-icons/fa';

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-amber-100 text-amber-700 border-amber-200',
  low:      'bg-green-100 text-green-700 border-green-200',
  healthy:  'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface Props {
  item: HistoryItem;
  onViewAgain?: (item: HistoryItem) => void;
  onDelete?: (id: string) => void;
}

export default function DiseaseHistoryCard({ item, onViewAgain, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [display, setDisplay] = useState<HistoryItem>(item);
  const [deleting, setDeleting] = useState(false);

  const handleTranslated = (lang: string, data: Record<string, any>) => {
    setDisplay(lang === 'en' ? item : { ...item, ...data });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item._id) return;
    setDeleting(true);
    onDelete?.(item._id);
  };

  const handleViewAgain = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewAgain?.(item);
  };

  const sevCls = SEV_COLORS[item.severityLevel?.toLowerCase()] || SEV_COLORS.low;
  const imgSrc = item.imageUrl
    ? (item.imageUrl.startsWith('http') ? item.imageUrl : `${BACKEND_BASE}${item.imageUrl}`)
    : null;
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <article
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-opacity ${deleting ? 'opacity-40 pointer-events-none' : ''}`}
      aria-label={`Disease scan: ${item.diseaseName}`}
    >
      {/* Header row — always visible */}
      <div className="flex items-start gap-3 p-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`${item.cropName} disease`}
              className="h-14 w-14 rounded-xl object-cover border border-gray-200 shadow-sm"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-rose-100 text-2xl border border-rose-200">
              🔬
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate text-base leading-tight">{display.diseaseName}</h3>
              {display.diseaseNameHindi && (
                <p className="text-xs text-orange-600 font-semibold mt-0.5">{display.diseaseNameHindi}</p>
              )}
            </div>
            <span className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${sevCls}`}>
              {item.severityLevel}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <FaSeedling size={9} aria-hidden="true" className="text-emerald-500" />
              {display.cropName}
            </span>
            {item.confidenceScore != null && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <FaPercentage size={9} aria-hidden="true" className="text-blue-500" />
                {item.confidenceScore}% confidence
              </span>
            )}
            {date && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <FaCalendarAlt size={9} aria-hidden="true" />
                {date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 pb-3 border-t border-gray-100 pt-2.5">
        {onViewAgain && (
          <button
            onClick={handleViewAgain}
            aria-label={`View again: ${item.diseaseName}`}
            className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 min-h-[2rem]"
          >
            <FaEye size={10} aria-hidden="true" /> View Again
          </button>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
          className="flex items-center gap-1.5 rounded-xl bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[2rem]"
        >
          <FaChevronDown size={9} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          {expanded ? 'Less' : 'Details'}
        </button>
        {onDelete && item._id && (
          <button
            onClick={handleDelete}
            aria-label={`Delete scan: ${item.diseaseName}`}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[2rem]"
          >
            <FaTrash size={9} aria-hidden="true" /> Delete
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3 animate-fadeIn">
          {display.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{display.description}</p>
          )}
          {display.symptoms && (
            <SymptomsCard symptoms={display.symptoms} symptomsHindi={display.symptomsHindi} />
          )}
          {display.organicTreatment && (
            <OrganicCard treatment={display.organicTreatment} treatmentHindi={display.organicTreatmentHindi} />
          )}
          {display.chemicalTreatment && (
            <ChemicalCard treatment={display.chemicalTreatment} treatmentHindi={display.chemicalTreatmentHindi} />
          )}
          {!display.organicTreatment && !display.chemicalTreatment && display.treatment && (
            <ChemicalCard treatment={display.treatment} />
          )}
          {display.prevention && (
            <PreventionCard prevention={display.prevention} preventionHindi={display.preventionHindi} />
          )}
          {item.feedback && (
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
              item.feedback === 'helpful' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {item.feedback === 'helpful' ? '👍 Helpful' : '👎 Not Helpful'}
            </span>
          )}
          {item._id && (
            <AILanguageSelector
              recordId={item._id}
              module="disease"
              englishData={item as any}
              onTranslated={handleTranslated}
            />
          )}
        </div>
      )}
    </article>
  );
}
