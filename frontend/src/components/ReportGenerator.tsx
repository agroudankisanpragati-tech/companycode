'use client';

/**
 * ReportGenerator — Reusable printable/PDF report component.
 * Supports: Disease Detection, Soil Health, Crop Advisory.
 * Includes: farmer, crop, disease, confidence, symptoms, organic solution,
 *           chemical solution, dosage, prevention, KVK details.
 */

import { useEffect, useState } from 'react';
import {
  FaPrint, FaTimes, FaMicroscope, FaCalendarAlt, FaUser,
  FaMapMarkerAlt, FaPhone, FaEnvelope, FaClock, FaLeaf,
  FaFlask, FaShieldAlt, FaExclamationTriangle, FaBuilding,
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { fetchNearestKVK, KVKCenter } from '@/services/kvk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportField {
  label: string;
  value?: string | number | null;
  emoji?: string;
  color?: string;
}

export interface ReportSection {
  title: string;
  emoji: string;
  color?: string;
  content: string;
  details?: ReportField[];
}

export interface ReportData {
  /** Report type label shown in header */
  reportType: string;
  /** Module: 'disease' | 'soil' | 'crop' */
  module: 'disease' | 'soil' | 'crop';
  /** Summary fields shown in the top grid */
  summaryFields: ReportField[];
  /** Secondary metadata fields */
  metaFields?: ReportField[];
  /** Main content sections */
  sections: ReportSection[];
  /** Uploaded image preview (base64 or URL) */
  imagePreview?: string | null;
  /** Reference images */
  referenceImages?: string[];
  /** Date string */
  date?: string;
  /** Confidence score (0-100) */
  confidence?: number;
  /** Severity level */
  severity?: string;
}

interface Props {
  data: ReportData;
  onClose: () => void;
}

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a', healthy: '#059669',
};

const MODULE_ICON: Record<string, React.ReactNode> = {
  disease: <FaMicroscope size={18} aria-hidden="true" />,
  soil:    <FaFlask size={18} aria-hidden="true" />,
  crop:    <FaLeaf size={18} aria-hidden="true" />,
};

const MODULE_GRADIENT: Record<string, string> = {
  disease: 'from-rose-700 to-orange-600',
  soil:    'from-emerald-700 to-teal-600',
  crop:    'from-green-700 to-lime-600',
};

export default function ReportGenerator({ data, onClose }: Props) {
  const { user } = useAuth();
  const [kvk, setKvk] = useState<KVKCenter | null>(null);

  const date = data.date || new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const imgSrc = (url: string) => url.startsWith('http') || url.startsWith('data:') ? url : `${BACKEND_BASE}${url}`;

  useEffect(() => {
    fetchNearestKVK({}).then(res => {
      if (res.nearest) setKvk(res.nearest);
    }).catch(() => {});
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${data.reportType} Report`}
    >
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-lg mb-4 max-w-3xl mx-auto">
        <p className="text-sm font-bold text-slate-700">🖨️ {data.reportType}</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            aria-label="Print or save as PDF"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[2.5rem]"
          >
            <FaPrint size={12} aria-hidden="true" /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            aria-label="Close report"
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[2.5rem]"
          >
            <FaTimes size={12} aria-hidden="true" /> Close
          </button>
        </div>
      </div>

      {/* Report body */}
      <div
        id="kp-report"
        className="mx-auto max-w-3xl rounded-3xl bg-white shadow-2xl print:shadow-none print:rounded-none print:max-w-full"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Header */}
        <div className={`rounded-t-3xl print:rounded-none bg-gradient-to-r ${MODULE_GRADIENT[data.module]} px-8 py-6 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {MODULE_ICON[data.module]}
                <span className="text-xs font-bold uppercase tracking-widest opacity-80">AgroDhan Kisan Pragati LLP</span>
              </div>
              <h1 className="text-2xl font-bold leading-tight">{data.reportType}</h1>
              <p className="text-sm opacity-80 mt-1">Powered by AI Vision Analysis</p>
            </div>
            <div className="text-right text-xs opacity-70 space-y-1">
              <p className="flex items-center gap-1 justify-end">
                <FaCalendarAlt size={10} aria-hidden="true" /> {date}
              </p>
              {user?.name && (
                <p className="flex items-center gap-1 justify-end">
                  <FaUser size={10} aria-hidden="true" /> {user.name}
                </p>
              )}
              {data.confidence != null && (
                <p className="text-base font-bold opacity-100">Confidence: {data.confidence}%</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary row */}
          {data.summaryFields.length > 0 && (
            <div className={`grid gap-3 ${data.summaryFields.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {data.summaryFields.map((item, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{item.emoji} {item.label}</p>
                  <p className="text-sm font-bold" style={item.color ? { color: item.color } : {}}>
                    {item.value ?? '—'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Secondary meta */}
          {data.metaFields && data.metaFields.filter(i => i.value).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.metaFields.filter(i => i.value).map((item, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-700">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Images */}
          {(data.imagePreview || data.referenceImages?.length) && (
            <div className="flex gap-4 flex-wrap">
              {data.imagePreview && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted Photo</p>
                  <img src={data.imagePreview} alt="Submitted by farmer"
                    className="h-32 w-32 rounded-xl object-cover border border-gray-200" />
                </div>
              )}
              {data.referenceImages?.slice(0, 2).map((url, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-500 mb-1">Reference {i + 1}</p>
                  <img src={imgSrc(url)} alt={`Reference ${i + 1}`}
                    className="h-32 w-32 rounded-xl object-cover border border-gray-200"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ))}
            </div>
          )}

          {/* Content sections */}
          {data.sections.map((section, i) => (
            <ReportSection key={i} section={section} />
          ))}

          {/* KVK Details */}
          {kvk && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <FaBuilding size={12} aria-hidden="true" className="text-cyan-600" />
                <h3 className="text-sm font-bold text-cyan-700">Nearest KVK (Krishi Vigyan Kendra)</h3>
              </div>
              <div className="px-4 py-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{kvk.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                      <FaMapMarkerAlt size={10} className="mt-0.5 flex-shrink-0 text-cyan-600" aria-hidden="true" />
                      {kvk.address}, {kvk.district}, {kvk.state}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {kvk.phone && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <FaPhone size={9} aria-hidden="true" className="text-cyan-600" /> {kvk.phone}
                      </p>
                    )}
                    {kvk.email && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <FaEnvelope size={9} aria-hidden="true" className="text-cyan-600" /> {kvk.email}
                      </p>
                    )}
                    {kvk.officeTimings && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <FaClock size={9} aria-hidden="true" className="text-cyan-600" /> {kvk.officeTimings}
                      </p>
                    )}
                    {kvk.distanceKm != null && (
                      <p className="text-xs font-semibold text-cyan-700">📍 {kvk.distanceKm.toFixed(1)} km away</p>
                    )}
                  </div>
                </div>
                {kvk.servicesOffered?.length ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Services Offered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {kvk.servicesOffered.map((s, i) => (
                        <span key={i} className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-xs text-cyan-700">{s}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-xs text-gray-400">
              Generated by AgroDhan Kisan Pragati LLP AI System · {date}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              This report is AI-generated. Consult your local KVK or agronomist for confirmation.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #kp-report, #kp-report * { visibility: visible; }
          #kp-report { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReportSection({ section }: { section: ReportSection }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span aria-hidden="true">{section.emoji}</span>
        <h3 className="text-sm font-bold" style={{ color: section.color || '#374151' }}>{section.title}</h3>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{section.content}</p>
        {section.details?.filter(d => d.value).map((detail, i) => (
          <div key={i} className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-bold text-gray-500">{detail.label}: </span>
            <span className="text-xs text-gray-700">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helper: Build ReportData from ScanResult ─────────────────────────────────

export function buildDiseaseReportData(
  result: any,
  userName?: string,
): ReportData {
  const SEV_COLOR_MAP: Record<string, string> = {
    critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a', healthy: '#059669',
  };
  const sevColor = SEV_COLOR_MAP[result.severityLevel?.toLowerCase()] || '#64748b';
  const date = result.createdAt
    ? new Date(result.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const symptoms = [result.symptoms, result.symptomsDescription, result.leafSymptoms, result.stemSymptoms, result.rootSymptoms, result.fruitSymptoms].filter(Boolean).join('\n');
  const organic  = result.organicSolution || result.organicTreatment || '';
  const chemical = result.chemicalSolution || result.chemicalTreatment || result.treatmentDescription || result.treatment || '';
  const prevention = result.prevention || result.preventionMethods || result.preventionDescription || '';

  const sections: ReportSection[] = [];

  if (result.description) {
    sections.push({
      title: 'Disease Description', emoji: '📋',
      content: result.description,
      details: result.descriptionHindi ? [{ label: 'हिंदी विवरण', value: result.descriptionHindi }] : [],
    });
  }
  if (symptoms) sections.push({ title: 'Symptoms', emoji: '⚠️', content: symptoms });
  if (organic) {
    sections.push({
      title: 'Organic Treatment', emoji: '🌿', color: '#16a34a', content: organic,
      details: [
        { label: 'Preparation', value: result.preparationMethod },
        { label: 'Frequency', value: result.frequency },
        { label: 'Safety Notes', value: result.safetyNotes },
      ],
    });
  }
  if (chemical) {
    sections.push({
      title: 'Chemical Treatment', emoji: '💊', color: '#2563eb', content: chemical,
      details: [
        { label: 'Chemical Name', value: result.chemicalName },
        { label: 'Active Ingredient', value: result.activeIngredient },
        { label: 'Dosage', value: result.dosage },
        { label: 'Mixing Method', value: result.mixingMethod },
        { label: 'Spray Timing', value: result.sprayTiming },
        { label: 'Waiting Period', value: result.waitingPeriod },
        { label: 'Safety', value: result.safetyInstructions || result.precautions },
      ],
    });
  }
  if (prevention) {
    sections.push({
      title: 'Preventive Measures', emoji: '🛡️', color: '#0d9488', content: prevention,
      details: [
        { label: 'Before Disease', value: result.beforeDisease },
        { label: 'During Disease', value: result.duringDisease },
        { label: 'After Recovery', value: result.afterRecovery },
      ],
    });
  }
  if (result.recommendedActions) {
    sections.push({ title: 'Recommended Actions', emoji: '⚡', color: '#d97706', content: result.recommendedActions });
  }
  if (result.governmentAdvisory) {
    sections.push({ title: 'Government Advisory', emoji: '🏛️', color: '#4f46e5', content: result.governmentAdvisory });
  }

  return {
    reportType: 'AI Crop Disease Report',
    module: 'disease',
    date,
    confidence: result.confidenceScore,
    severity: result.severityLevel,
    summaryFields: [
      { label: 'Farmer',   value: userName,             emoji: '👤' },
      { label: 'Crop',     value: result.cropName,      emoji: '🌾' },
      { label: 'Disease',  value: result.diseaseName,   emoji: '🦠' },
      { label: 'Severity', value: result.severityLevel, emoji: '📊', color: sevColor },
    ],
    metaFields: [
      { label: 'Disease Type',    value: result.diseaseType },
      { label: 'Scientific Name', value: result.scientificName },
      { label: 'Confidence',      value: result.confidenceScore != null ? `${result.confidenceScore}%` : undefined },
      { label: 'Affected Part',   value: result.affectedPlantPart },
      { label: 'Report Date',     value: date },
    ],
    referenceImages: result.diseaseImages,
    sections,
  };
}
