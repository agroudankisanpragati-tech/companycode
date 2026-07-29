'use client';

import { lazy, Suspense } from 'react';
import { FaLeaf, FaClock, FaRobot } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { ScanResult, pickField } from './types';

const VoicePlayer = lazy(() => import('@/components/VoicePlayer'));

const SOURCE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  cache:          { label: 'Cached Result',  color: 'bg-blue-500/15 text-blue-300 border-blue-500/20',      icon: '📊' },
  knowledge_base: { label: 'Knowledge Base', color: 'bg-purple-500/15 text-purple-300 border-purple-500/20', icon: '📚' },
  ai:             { label: 'AI Analysis',    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', icon: '🤖' },
};

const SEV_GRADIENT: Record<string, string> = {
  critical: 'from-red-900 via-red-800 to-slate-900',
  high:     'from-orange-900 via-orange-800 to-slate-900',
  medium:   'from-amber-900 via-amber-800 to-slate-900',
  low:      'from-slate-900 via-slate-800 to-slate-900',
  healthy:  'from-emerald-900 via-emerald-800 to-slate-900',
};

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

interface Props {
  result: ScanResult;
  voiceLang: string;
  uploadedPreview: string | null;
}

export default function DiseaseCard({ result, voiceLang, uploadedPreview }: Props) {
  const { langCode } = useLanguage();
  const sev = result.severityLevel?.toLowerCase() || 'low';
  const gradient = SEV_GRADIENT[sev] || SEV_GRADIENT.low;
  const src = SOURCE_CONFIG[result.source || 'ai'] || SOURCE_CONFIG.ai;

  // Resolve description in the active language
  const resolvedDescription = pickField(result.description, langCode);

  // Speech reads exactly what is displayed — same language, no mixing
  const speakText = langCode !== 'en'
    ? `${result.diseaseNameHindi || result.diseaseName}। ${resolvedDescription}`
    : `${result.diseaseName}. ${resolvedDescription}`;

  const predTime = result.createdAt
    ? new Date(result.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-3xl bg-gradient-to-br ${gradient} p-5 sm:p-6 text-white shadow-2xl overflow-hidden relative`}>
      {/* Decorative blobs */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-white/5 blur-xl pointer-events-none" />

      <div className="relative">
        {/* Top meta row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${src.color}`}>
            {src.icon} {src.label}
          </span>
          {result.similarityScore != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300">
              🎯 {result.similarityScore}% Match
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
            <FaClock size={9} /> {predTime}
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Crop name */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 flex-shrink-0">
                <FaLeaf className="text-emerald-400" size={11} />
              </div>
              <p className="text-sm font-bold text-emerald-300">
                {result.cropName}{result.cropNameHindi ? ` / ${result.cropNameHindi}` : ''}
                {result.cropCategory ? <span className="ml-2 text-xs font-normal text-slate-400">({result.cropCategory})</span> : null}
              </p>
            </div>

            {/* Disease name */}
            <h1 className="text-2xl font-extrabold leading-tight text-white md:text-3xl">
              {result.diseaseName}
            </h1>
            {result.diseaseNameHindi && (
              <p className="mt-1 text-lg font-bold text-orange-300">{result.diseaseNameHindi}</p>
            )}
            {result.scientificName && (
              <p className="mt-0.5 text-xs italic text-slate-400">{result.scientificName}</p>
            )}

            {/* Description — shows active language only */}
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{resolvedDescription}</p>

            {/* Voice */}
            <Suspense fallback={null}>
              <VoicePlayer text={speakText} lang={voiceLang} autoDetect={false} label="सुनें / Listen" className="mt-4" />
            </Suspense>
          </div>

          {/* Images column */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {uploadedPreview && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1 text-center">Your Photo</p>
                <img
                  src={uploadedPreview}
                  alt="Uploaded crop"
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                />
              </div>
            )}
            {result.imageUrl && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1 text-center">Reference</p>
                <img
                  src={result.imageUrl?.startsWith('http') ? result.imageUrl : `${BACKEND_BASE}${result.imageUrl}`}
                  alt={result.diseaseName}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom meta */}
        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/10">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
            🦠 {result.diseaseType}
          </span>
          {result.affectedPlantPart && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
              🌱 Affects: {result.affectedPlantPart}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <FaRobot size={9} /> AI Powered
          </span>
        </div>
      </div>
    </div>
  );
}
