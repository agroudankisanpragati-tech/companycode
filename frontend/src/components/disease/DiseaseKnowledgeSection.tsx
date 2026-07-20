'use client';

import { useState } from 'react';
import {
  FaLeaf, FaFlask, FaShieldAlt, FaBolt, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle, FaHeartbeat, FaLightbulb,
  FaChevronDown, FaChevronUp, FaDatabase, FaRobot,
} from 'react-icons/fa';
import { ScanResult, resolveSymptoms, resolveOrganic, resolveChemical, resolvePrevention } from './types';

// ─── Expandable Knowledge Card ────────────────────────────────────────────────

interface KnowledgeCardProps {
  icon: React.ReactNode;
  title: string;
  titleHindi: string;
  children: React.ReactNode;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  defaultOpen?: boolean;
}

function KnowledgeCard({
  icon, title, titleHindi, children,
  accentColor, borderColor, bgColor, defaultOpen = false,
}: KnowledgeCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border ${borderColor} bg-white dark:bg-slate-800 shadow-sm overflow-hidden transition-all duration-300`}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${bgColor} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${accentColor} shadow-sm`}>
            {icon}
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{titleHindi}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-400 dark:text-slate-500">
          {open ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Bullet list renderer ─────────────────────────────────────────────────────

function BulletList({ text, bulletClass }: { text: string; bulletClass: string }) {
  const lines = text
    .split(/\n|(?<=\d\.)\s+|(?<=•)\s+/)
    .map(l => l.replace(/^[\d\.\-•*]+\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{text}</p>;
  }

  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className={`flex-shrink-0 mt-1 ${bulletClass}`} />
          <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{line}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Do's and Don'ts ──────────────────────────────────────────────────────────

function DosDonts({ dos, donts }: { dos?: string; donts?: string }) {
  if (!dos && !donts) return null;

  const parseList = (text: string) =>
    text.split(/\n|(?<=\d\.)\s+|(?<=•)\s+/)
      .map(l => l.replace(/^[\d\.\-•*]+\s*/, '').trim())
      .filter(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {dos && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3 uppercase tracking-wide">
            <FaCheckCircle size={12} /> Do's / करें
          </p>
          <ul className="space-y-2">
            {parseList(dos).map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <FaCheckCircle className="flex-shrink-0 mt-0.5 text-emerald-500" size={11} />
                <span className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {donts && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 mb-3 uppercase tracking-wide">
            <FaTimesCircle size={12} /> Don'ts / न करें
          </p>
          <ul className="space-y-2">
            {parseList(donts).map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <FaTimesCircle className="flex-shrink-0 mt-0.5 text-red-500" size={11} />
                <span className="text-sm text-red-900 dark:text-red-200 leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const isDB = source === 'knowledge_base' || source === 'cache';
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      isDB
        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
    }`}>
      {isDB ? <FaDatabase size={9} /> : <FaRobot size={9} />}
      {isDB ? 'From Knowledge Base' : 'AI Generated'}
    </div>
  );
}

// ─── Main Disease Knowledge Section ──────────────────────────────────────────

interface Props {
  result: ScanResult;
}

export default function DiseaseKnowledgeSection({ result }: Props) {
  const symptoms   = resolveSymptoms(result);
  const organic    = resolveOrganic(result);
  const chemical   = resolveChemical(result);
  const prevention = resolvePrevention(result);

  // Derive Do's / Don'ts — now typed on ScanResult
  const dos   = result.dos   || '';
  const donts = result.donts || '';

  // Recovery tips — typed field first, then legacy fallbacks
  const recoveryTips = result.recoveryTips
    || result.recoveryTime
    || result.cropCareTips
    || result.farmingPractices
    || '';

  // Urgent prevention — typed field first, then legacy fallbacks
  const urgentPrevention = result.urgentPrevention
    || result.recommendedActions
    || result.beforeDisease
    || '';

  // Farmer advice — typed field
  const farmerAdvice = result.farmerAdvice || result.importantNotes || '';

  // Precautions — from safetyInstructions or safetyNotes or precautions
  const precautions = result.safetyInstructions
    || result.safetyNotes
    || result.precautions
    || '';

  // Check if there's any knowledge to show
  const hasKnowledge = !!(
    result.description || symptoms || organic || chemical ||
    prevention || urgentPrevention || recoveryTips || precautions || dos || donts || farmerAdvice
  );

  if (!hasKnowledge) return null;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="text-lg">📖</span> Disease Knowledge Base
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete guide — tap any card to expand
          </p>
        </div>
        <SourceBadge source={result.source} />
      </div>

      {/* 1. Disease Description */}
      {result.description && (
        <KnowledgeCard
          icon={<FaLightbulb className="text-yellow-600" size={15} />}
          title="Disease Description"
          titleHindi="रोग का विवरण"
          accentColor="bg-yellow-100 dark:bg-yellow-900/40"
          borderColor="border-yellow-200 dark:border-yellow-800"
          bgColor="bg-yellow-50/60 dark:bg-yellow-900/20"
          defaultOpen={true}
        >
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {result.description}
          </p>
          {result.descriptionHindi && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed border-t border-yellow-100 dark:border-yellow-800 pt-3">
              {result.descriptionHindi}
            </p>
          )}
        </KnowledgeCard>
      )}

      {/* 2. Symptoms */}
      {symptoms && (
        <KnowledgeCard
          icon={<FaExclamationTriangle className="text-amber-600" size={14} />}
          title="Symptoms"
          titleHindi="लक्षण"
          accentColor="bg-amber-100 dark:bg-amber-900/40"
          borderColor="border-amber-200 dark:border-amber-800"
          bgColor="bg-amber-50/60 dark:bg-amber-900/20"
          defaultOpen={true}
        >
          <BulletList
            text={symptoms}
            bulletClass="h-2 w-2 rounded-full bg-amber-500 mt-1"
          />
          {result.symptomsHindi && (
            <p className="mt-3 text-sm text-amber-800 dark:text-amber-300 italic whitespace-pre-line border-t border-amber-100 dark:border-amber-800 pt-3">
              {result.symptomsHindi}
            </p>
          )}
        </KnowledgeCard>
      )}

      {/* 3. Organic Solution */}
      {organic && (
        <KnowledgeCard
          icon={<FaLeaf className="text-green-600" size={14} />}
          title="Organic Solution"
          titleHindi="जैविक उपचार"
          accentColor="bg-green-100 dark:bg-green-900/40"
          borderColor="border-green-200 dark:border-green-800"
          bgColor="bg-green-50/60 dark:bg-green-900/20"
        >
          <BulletList
            text={organic}
            bulletClass="h-2 w-2 rounded-full bg-green-500 mt-1"
          />
          {result.organicTreatmentHindi && (
            <p className="mt-3 text-sm text-green-800 dark:text-green-300 italic whitespace-pre-line border-t border-green-100 dark:border-green-800 pt-3">
              {result.organicTreatmentHindi}
            </p>
          )}
        </KnowledgeCard>
      )}

      {/* 4. Chemical Solution */}
      {chemical && (
        <KnowledgeCard
          icon={<FaFlask className="text-blue-600" size={14} />}
          title="Chemical Solution"
          titleHindi="रासायनिक उपचार"
          accentColor="bg-blue-100 dark:bg-blue-900/40"
          borderColor="border-blue-200 dark:border-blue-800"
          bgColor="bg-blue-50/60 dark:bg-blue-900/20"
        >
          <BulletList
            text={chemical}
            bulletClass="h-2 w-2 rounded-full bg-blue-500 mt-1"
          />
          {result.chemicalTreatmentHindi && (
            <p className="mt-3 text-sm text-blue-800 dark:text-blue-300 italic whitespace-pre-line border-t border-blue-100 dark:border-blue-800 pt-3">
              {result.chemicalTreatmentHindi}
            </p>
          )}
          {(result.dosage || result.sprayTiming || result.waitingPeriod) && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-blue-100 dark:border-blue-800 pt-3">
              {result.dosage && (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">⚗️ Dosage</p>
                  <p className="text-xs text-blue-900 dark:text-blue-200">{result.dosage}</p>
                </div>
              )}
              {result.sprayTiming && (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">⏰ Spray Timing</p>
                  <p className="text-xs text-blue-900 dark:text-blue-200">{result.sprayTiming}</p>
                </div>
              )}
              {result.waitingPeriod && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 p-3">
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-1">⏳ Waiting Period</p>
                  <p className="text-xs text-rose-900 dark:text-rose-200">{result.waitingPeriod}</p>
                </div>
              )}
            </div>
          )}
        </KnowledgeCard>
      )}

      {/* 5. Urgent Prevention */}
      {urgentPrevention && (
        <KnowledgeCard
          icon={<FaBolt className="text-orange-600" size={14} />}
          title="Urgent Prevention"
          titleHindi="तत्काल रोकथाम"
          accentColor="bg-orange-100 dark:bg-orange-900/40"
          borderColor="border-orange-200 dark:border-orange-800"
          bgColor="bg-orange-50/60 dark:bg-orange-900/20"
        >
          <BulletList
            text={urgentPrevention}
            bulletClass="h-2 w-2 rounded-full bg-orange-500 mt-1"
          />
          {result.recommendedActionsHindi && (
            <p className="mt-3 text-sm text-orange-800 dark:text-orange-300 italic whitespace-pre-line border-t border-orange-100 dark:border-orange-800 pt-3">
              {result.recommendedActionsHindi}
            </p>
          )}
        </KnowledgeCard>
      )}

      {/* 6. Recovery Tips */}
      {recoveryTips && (
        <KnowledgeCard
          icon={<FaHeartbeat className="text-pink-600" size={14} />}
          title="Recovery Tips"
          titleHindi="ठीक होने के उपाय"
          accentColor="bg-pink-100 dark:bg-pink-900/40"
          borderColor="border-pink-200 dark:border-pink-800"
          bgColor="bg-pink-50/60 dark:bg-pink-900/20"
        >
          <BulletList
            text={recoveryTips}
            bulletClass="h-2 w-2 rounded-full bg-pink-500 mt-1"
          />
        </KnowledgeCard>
      )}

      {/* 7. Precautions */}
      {precautions && (
        <KnowledgeCard
          icon={<FaShieldAlt className="text-teal-600" size={14} />}
          title="Precautions"
          titleHindi="सावधानियाँ"
          accentColor="bg-teal-100 dark:bg-teal-900/40"
          borderColor="border-teal-200 dark:border-teal-800"
          bgColor="bg-teal-50/60 dark:bg-teal-900/20"
        >
          <BulletList
            text={precautions}
            bulletClass="h-2 w-2 rounded-full bg-teal-500 mt-1"
          />
        </KnowledgeCard>
      )}

      {/* 8. Prevention (General) */}
      {prevention && (
        <KnowledgeCard
          icon={<FaShieldAlt className="text-indigo-600" size={14} />}
          title="Prevention Measures"
          titleHindi="रोकथाम के उपाय"
          accentColor="bg-indigo-100 dark:bg-indigo-900/40"
          borderColor="border-indigo-200 dark:border-indigo-800"
          bgColor="bg-indigo-50/60 dark:bg-indigo-900/20"
        >
          <BulletList
            text={prevention}
            bulletClass="h-2 w-2 rounded-full bg-indigo-500 mt-1"
          />
          {result.preventionHindi && (
            <p className="mt-3 text-sm text-indigo-800 dark:text-indigo-300 italic whitespace-pre-line border-t border-indigo-100 dark:border-indigo-800 pt-3">
              {result.preventionHindi}
            </p>
          )}
        </KnowledgeCard>
      )}

      {/* 9. Do's and Don'ts */}
      {(dos || donts) && (
        <KnowledgeCard
          icon={<FaCheckCircle className="text-emerald-600" size={14} />}
          title="Do's & Don'ts"
          titleHindi="करें और न करें"
          accentColor="bg-emerald-100 dark:bg-emerald-900/40"
          borderColor="border-emerald-200 dark:border-emerald-800"
          bgColor="bg-emerald-50/60 dark:bg-emerald-900/20"
        >
          <DosDonts dos={dos} donts={donts} />
        </KnowledgeCard>
      )}

      {/* 10. Farmer Advice */}
      {farmerAdvice && (
        <KnowledgeCard
          icon={<FaLightbulb className="text-yellow-500" size={14} />}
          title="Farmer Advice"
          titleHindi="किसान सलाह"
          accentColor="bg-yellow-100 dark:bg-yellow-900/40"
          borderColor="border-yellow-300 dark:border-yellow-700"
          bgColor="bg-yellow-50/60 dark:bg-yellow-900/20"
        >
          <BulletList
            text={farmerAdvice}
            bulletClass="h-2 w-2 rounded-full bg-yellow-500 mt-1"
          />
        </KnowledgeCard>
      )}
    </div>
  );
}
