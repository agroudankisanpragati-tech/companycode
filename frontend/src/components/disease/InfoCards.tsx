'use client';

import { lazy, Suspense } from 'react';
import {
  FaLeaf, FaFlask, FaShieldAlt, FaBolt, FaExclamationTriangle,
  FaCheckCircle, FaImage, FaBoxOpen, FaThumbsUp, FaThumbsDown,
  FaSeedling, FaCloudRain, FaClock, FaInfoCircle, FaLink,
  FaPhone, FaMapMarkerAlt, FaExternalLinkAlt,
} from 'react-icons/fa';

const VoicePlayer = lazy(() => import('@/components/VoicePlayer'));

// ─── Shared base card ─────────────────────────────────────────────────────────

function SectionCard({
  emoji, title, titleHindi, children, className = '',
}: {
  emoji: string; title: string; titleHindi?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-800 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-slate-700 px-5 py-3.5 bg-gray-50/60 dark:bg-slate-700/40">
        <span className="text-xl">{emoji}</span>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
          {titleHindi && <p className="text-[11px] text-slate-500 dark:text-slate-400">{titleHindi}</p>}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Symptom checklist ────────────────────────────────────────────────────────

function parseLines(text: string): string[] {
  return text.split(/\n|(?<=\d\.)\s+|(?<=•)\s+/)
    .map(l => l.replace(/^[\d\.\-•*]+\s*/, '').trim())
    .filter(Boolean);
}

export function SymptomsCard({ symptoms, voiceLang }: {
  symptoms: string; symptomsHindi?: string; voiceLang?: string;
}) {
  const lines = parseLines(symptoms);
  return (
    <SectionCard emoji="⚠️" title="Symptoms" titleHindi="लक्षण" className="border-amber-200 dark:border-amber-800">
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaExclamationTriangle className="flex-shrink-0 mt-0.5 text-amber-500" size={12} />
            <span className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-line">{symptoms}</li>}
      </ul>
      {voiceLang && (
        <Suspense fallback={null}>
          <VoicePlayer text={symptoms} lang={voiceLang} autoDetect={false} className="mt-3" />
        </Suspense>
      )}
    </SectionCard>
  );
}

// ─── Disease Cause & Spread ───────────────────────────────────────────────────

export function CauseCard({ causes, spreadPattern, earlyWarningSigns, suitableWeather }: {
  causes?: string; spreadPattern?: string; earlyWarningSigns?: string; suitableWeather?: string;
}) {
  const items = [
    { icon: '🦠', label: 'Disease Cause', labelHindi: 'रोग का कारण', value: causes },
    { icon: '📡', label: 'Spread Pattern', labelHindi: 'फैलाव का तरीका', value: spreadPattern },
    { icon: '👁️', label: 'Early Warning Signs', labelHindi: 'प्रारंभिक चेतावनी', value: earlyWarningSigns },
    { icon: '🌤️', label: 'Suitable Weather', labelHindi: 'अनुकूल मौसम', value: suitableWeather },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <SectionCard emoji="🔬" title="Disease Cause & Spread" titleHindi="रोग का कारण और फैलाव" className="border-red-100">
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 mb-1">
              <span>{item.icon}</span> {item.label} / {item.labelHindi}
            </p>
            <p className="text-sm text-red-900 dark:text-red-200 leading-relaxed whitespace-pre-line">{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Organic Solution ─────────────────────────────────────────────────────────

export function OrganicCard({ treatment, voiceLang }: {
  treatment: string; treatmentHindi?: string; voiceLang?: string;
}) {
  const lines = parseLines(treatment);
  return (
    <SectionCard emoji="🌿" title="Organic Solution" titleHindi="जैविक उपचार" className="border-green-200 dark:border-green-800">
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaLeaf className="flex-shrink-0 mt-0.5 text-green-500" size={12} />
            <span className="text-sm text-green-900 dark:text-green-200 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-green-900 dark:text-green-200 whitespace-pre-line">{treatment}</li>}
      </ul>
      {voiceLang && (
        <Suspense fallback={null}>
          <VoicePlayer text={treatment} lang={voiceLang} autoDetect={false} className="mt-3" />
        </Suspense>
      )}
    </SectionCard>
  );
}

// ─── Chemical Solution ────────────────────────────────────────────────────────

export function ChemicalCard({ treatment, dosage, applicationMethod, precautions }: {
  treatment: string; treatmentHindi?: string;
  dosage?: string; applicationMethod?: string; precautions?: string;
}) {
  const lines = parseLines(treatment);
  return (
    <SectionCard emoji="💊" title="Chemical Solution" titleHindi="रासायनिक उपचार" className="border-blue-200 dark:border-blue-800">
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaFlask className="flex-shrink-0 mt-0.5 text-blue-500" size={11} />
            <span className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-line">{treatment}</li>}
      </ul>
      {(dosage || applicationMethod || precautions) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-blue-100 dark:border-blue-800 pt-3">
          {dosage && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">⚗️ Dosage</p>
              <p className="text-xs text-blue-900 dark:text-blue-200">{dosage}</p>
            </div>
          )}
          {applicationMethod && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">🔧 Method</p>
              <p className="text-xs text-blue-900 dark:text-blue-200">{applicationMethod}</p>
            </div>
          )}
          {precautions && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 p-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">⚠️ Safety</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">{precautions}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Prevention ───────────────────────────────────────────────────────────────

export function PreventionCard({ prevention, voiceLang }: {
  prevention: string; preventionHindi?: string; voiceLang?: string;
}) {
  const lines = parseLines(prevention);
  return (
    <SectionCard emoji="🛡️" title="Preventive Measures" titleHindi="रोकथाम के उपाय" className="border-teal-200 dark:border-teal-800">
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaShieldAlt className="flex-shrink-0 mt-0.5 text-teal-500" size={11} />
            <span className="text-sm text-teal-900 dark:text-teal-200 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-teal-900 dark:text-teal-200 whitespace-pre-line">{prevention}</li>}
      </ul>
      {voiceLang && (
        <Suspense fallback={null}>
          <VoicePlayer text={prevention} lang={voiceLang} autoDetect={false} className="mt-3" />
        </Suspense>
      )}
    </SectionCard>
  );
}

// ─── Recommended Actions ──────────────────────────────────────────────────────

export function ActionsCard({ actions }: { actions: string; actionsHindi?: string }) {
  const lines = parseLines(actions);
  return (
    <SectionCard emoji="⚡" title="Recommended Actions" titleHindi="तत्काल कार्रवाई" className="border-orange-200 dark:border-orange-800">
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaBolt className="flex-shrink-0 mt-0.5 text-orange-500" size={11} />
            <span className="text-sm text-orange-900 dark:text-orange-200 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-orange-900 dark:text-orange-200 whitespace-pre-line">{actions}</li>}
      </ul>
    </SectionCard>
  );
}

// ─── Recommended Products ─────────────────────────────────────────────────────

export function ProductsCard({ products }: { products: string }) {
  if (!products?.trim()) return null;
  const lines = parseLines(products);
  return (
    <SectionCard emoji="📦" title="Recommended Products" titleHindi="अनुशंसित उत्पाद" className="border-violet-200 dark:border-violet-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <FaBoxOpen className="text-violet-500 dark:text-violet-400" size={14} />
            </div>
            <p className="text-sm text-violet-900 dark:text-violet-200 leading-relaxed">{line}</p>
          </div>
        ))}
        {lines.length === 0 && (
          <p className="text-sm text-violet-900 dark:text-violet-200 whitespace-pre-line col-span-2">{products}</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Government Advisory ─────────────────────────────────────────────────────

export function AdvisoryCard({ advisory }: { advisory: string }) {
  if (!advisory?.trim()) return null;
  return (
    <SectionCard emoji="🏛️" title="Government Advisory" titleHindi="सरकारी सलाह" className="border-indigo-200 dark:border-indigo-800">
      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 p-4">
        <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed whitespace-pre-line">{advisory}</p>
      </div>
    </SectionCard>
  );
}

// ─── Knowledge Base Images ────────────────────────────────────────────────────

export function ImagesCard({ diseaseImages, healthyImages, imageGallery, backendBase }: {
  diseaseImages?: string[]; healthyImages?: string[]; imageGallery?: string[]; backendBase?: string;
}) {
  const base = backendBase || 'http://localhost:4000';
  const allDisease = diseaseImages?.filter(Boolean) || [];
  const allHealthy = healthyImages?.filter(Boolean) || [];
  const allGallery = imageGallery?.filter(Boolean) || [];

  if (!allDisease.length && !allHealthy.length && !allGallery.length) return null;

  const imgSrc = (url: string) => url.startsWith('http') ? url : `${base}${url}`;

  return (
    <SectionCard emoji="🖼️" title="Knowledge Base Images" titleHindi="रोग की तस्वीरें" className="border-slate-200">
      {allDisease.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5">
            <FaImage size={10} /> Disease Images
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allDisease.map((url, i) => (
              <img key={i} src={imgSrc(url)} alt={`Disease ${i + 1}`}
                className="h-28 w-28 flex-shrink-0 rounded-xl object-cover border border-red-100 shadow-sm"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        </div>
      )}
      {allHealthy.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1.5">
            <FaCheckCircle size={10} /> Healthy Comparison
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allHealthy.map((url, i) => (
              <img key={i} src={imgSrc(url)} alt={`Healthy ${i + 1}`}
                className="h-28 w-28 flex-shrink-0 rounded-xl object-cover border border-emerald-100 shadow-sm"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        </div>
      )}
      {allGallery.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
            <FaImage size={10} /> Gallery
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allGallery.map((url, i) => (
              <img key={i} src={imgSrc(url)} alt={`Gallery ${i + 1}`}
                className="h-28 w-28 flex-shrink-0 rounded-xl object-cover border border-slate-100 shadow-sm"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Farmer Guidance ─────────────────────────────────────────────────────────

export function FarmerGuidanceCard({ recoveryTime, suitableWeather, farmingPractices, importantNotes }: {
  recoveryTime?: string; suitableWeather?: string; farmingPractices?: string; importantNotes?: string;
}) {
  const items = [
    { icon: <FaClock className="text-blue-500" size={13} />, label: 'Recovery Time', labelHindi: 'ठीक होने का समय', value: recoveryTime, bg: 'bg-blue-50 border-blue-100' },
    { icon: <FaCloudRain className="text-sky-500" size={13} />, label: 'Weather Conditions', labelHindi: 'मौसम की स्थिति', value: suitableWeather, bg: 'bg-sky-50 border-sky-100' },
    { icon: <FaSeedling className="text-lime-600" size={13} />, label: 'Farming Practices', labelHindi: 'कृषि पद्धतियाँ', value: farmingPractices, bg: 'bg-lime-50 border-lime-100' },
    { icon: <FaInfoCircle className="text-pink-500" size={13} />, label: 'Important Notes', labelHindi: 'महत्वपूर्ण नोट्स', value: importantNotes, bg: 'bg-pink-50 border-pink-100' },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <SectionCard emoji="👨‍🌾" title="Farmer Guidance" titleHindi="किसान मार्गदर्शन" className="border-lime-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className={`rounded-xl border p-3 ${item.bg}`}>
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
              {item.icon} {item.label} / {item.labelHindi}
            </p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Reference Links ──────────────────────────────────────────────────────────

export function ReferencesCard({ links }: { links?: string[] }) {
  const valid = links?.filter(Boolean) || [];
  if (!valid.length) return null;
  return (
    <SectionCard emoji="🔗" title="Reference Links" titleHindi="संदर्भ लिंक" className="border-slate-200">
      <ul className="space-y-1.5">
        {valid.map((link, i) => (
          <li key={i}>
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline transition">
              <FaLink size={10} className="flex-shrink-0" />
              <span className="truncate">{link}</span>
            </a>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ─── Feedback Card ────────────────────────────────────────────────────────────

export function FeedbackCard({ feedback, onFeedback, comment = '', correctDisease = '', onCommentChange, onCorrectDiseaseChange }: {
  feedback: 'helpful' | 'not_helpful' | null;
  onFeedback: (type: 'helpful' | 'not_helpful', comment?: string, correctDisease?: string) => void;
  comment?: string;
  correctDisease?: string;
  onCommentChange?: (v: string) => void;
  onCorrectDiseaseChange?: (v: string) => void;
}) {
  return (
    <SectionCard emoji="💬" title="Was this helpful?" titleHindi="क्या यह उपयोगी था?" className="border-gray-200 dark:border-slate-700">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">Help us improve AI accuracy by sharing your feedback.</p>

        {!feedback && (
          <>
            {onCommentChange && (
              <textarea
                value={comment}
                onChange={e => onCommentChange(e.target.value)}
                placeholder="Add a comment (optional)..."
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-rose-300 dark:focus:border-rose-600 resize-none"
              />
            )}
            {onCorrectDiseaseChange && (
              <input
                type="text"
                value={correctDisease}
                onChange={e => onCorrectDiseaseChange(e.target.value)}
                placeholder="Correct disease name (if AI was wrong)..."
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-rose-300 dark:focus:border-rose-600"
              />
            )}
          </>
        )}

        <div className="flex gap-2">
          <button onClick={() => onFeedback('helpful', comment || undefined, correctDisease || undefined)} disabled={!!feedback}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all ${
              feedback === 'helpful'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}>
            <FaThumbsUp size={13} /> Helpful
          </button>
          <button onClick={() => onFeedback('not_helpful', comment || undefined, correctDisease || undefined)} disabled={!!feedback}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all ${
              feedback === 'not_helpful'
                ? 'bg-red-500 text-white shadow-md'
                : 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
            }`}>
            <FaThumbsDown size={13} /> Not Helpful
          </button>
        </div>

        {feedback && (
          <p className={`text-sm font-semibold ${feedback === 'helpful' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {feedback === 'helpful' ? '✅ Thank you! Your feedback helps improve AI accuracy.' : '📝 Thank you! We will improve our diagnosis.'}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Severity visual indicator ──────────────────────────────────────────────

const SEV_MAP: Record<string, { label: string; emoji: string; color: string; bg: string; border: string; bar: string; width: string; desc: string }> = {
  critical: { label: 'Critical', emoji: '🔴', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     bar: 'bg-red-500',     width: '100%', desc: 'Immediate action required — treat within hours' },
  high:     { label: 'High',     emoji: '🟠', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  bar: 'bg-orange-500',  width: '75%',  desc: 'Act within 24–48 hours to prevent spread' },
  medium:   { label: 'Medium',   emoji: '🟡', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   bar: 'bg-amber-500',   width: '50%',  desc: 'Monitor closely and treat soon' },
  low:      { label: 'Low',      emoji: '🟢', color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200',   bar: 'bg-green-500',   width: '25%',  desc: 'Preventive care advised' },
  healthy:  { label: 'Healthy',  emoji: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', width: '10%',  desc: 'No disease detected' },
};

export function SeverityCard({ level }: { level?: string }) {
  if (!level) return null;
  const s = SEV_MAP[level?.toLowerCase()] || { label: level, emoji: '⚪', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-400', width: '30%', desc: '' };
  return (
    <SectionCard emoji="📊" title="Severity Level" titleHindi="गंभीरता स्तर" className={`${s.border}`}>
      <div className={`rounded-xl ${s.bg} ${s.border} border p-4 flex items-center gap-4`}>
        <span className="text-4xl">{s.emoji}</span>
        <div className="flex-1">
          <p className={`text-xl font-extrabold ${s.color}`}>{s.label}</p>
          {s.desc && <p className={`text-xs mt-0.5 ${s.color} opacity-80`}>{s.desc}</p>}
          <div className="mt-2 h-2 w-full rounded-full bg-white/60 overflow-hidden">
            <div className={`h-full rounded-full ${s.bar} transition-all duration-700`} style={{ width: s.width }} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {(['low','medium','high','critical'] as const).map(k => (
            <div key={k} className={`h-2 w-6 rounded-full transition-all ${
              ['low','medium','high','critical'].indexOf(k) <= ['low','medium','high','critical'].indexOf(level?.toLowerCase() as any)
                ? SEV_MAP[k]?.bar || 'bg-slate-300'
                : 'bg-gray-200'
            }`} />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Organic Detail Card ──────────────────────────────────────────────────────

export function OrganicDetailCard({ treatment, preparationMethod, usageInstructions, frequency, safetyNotes, voiceLang }: {
  treatment: string; treatmentHindi?: string;
  preparationMethod?: string; usageInstructions?: string;
  frequency?: string; safetyNotes?: string; voiceLang?: string;
}) {
  const lines = parseLines(treatment);
  const details = [
    { icon: '🧪', label: 'Preparation Method', labelHindi: 'तैयारी विधि', value: preparationMethod, bg: 'bg-green-50 border-green-100' },
    { icon: '📋', label: 'Usage Instructions', labelHindi: 'उपयोग निर्देश', value: usageInstructions, bg: 'bg-lime-50 border-lime-100' },
    { icon: '🔄', label: 'Frequency',          labelHindi: 'आवृत्ति',       value: frequency,         bg: 'bg-teal-50 border-teal-100' },
    { icon: '⚠️', label: 'Safety Notes',       labelHindi: 'सुरक्षा नोट्स', value: safetyNotes,       bg: 'bg-amber-50 border-amber-100' },
  ].filter(d => d.value);

  return (
    <SectionCard emoji="🌿" title="Organic Solution" titleHindi="जैविक उपचार" className="border-green-200">
      <ul className="space-y-2 mb-3">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaLeaf className="flex-shrink-0 mt-0.5 text-green-500" size={12} />
            <span className="text-sm text-green-900 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-green-900 whitespace-pre-line">{treatment}</li>}
      </ul>
      {details.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {details.map((d, i) => (
            <div key={i} className={`rounded-xl border p-3 ${d.bg}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{d.icon} {d.label} / {d.labelHindi}</p>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">{d.value}</p>
            </div>
          ))}
        </div>
      )}
      {voiceLang && (
        <Suspense fallback={null}>
          <VoicePlayer text={treatment} lang={voiceLang} autoDetect={false} className="mt-3" />
        </Suspense>
      )}
    </SectionCard>
  );
}

// ─── Chemical Detail Card ─────────────────────────────────────────────────────

export function ChemicalDetailCard({ treatment, chemicalName, activeIngredient, dosage, mixingMethod, sprayTiming, sprayInterval, waitingPeriod, safetyInstructions, protectiveEquipment }: {
  treatment: string; treatmentHindi?: string;
  chemicalName?: string; activeIngredient?: string; dosage?: string;
  mixingMethod?: string; sprayTiming?: string; sprayInterval?: string;
  waitingPeriod?: string; safetyInstructions?: string; protectiveEquipment?: string;
}) {
  const lines = parseLines(treatment);
  const grid = [
    { icon: '🧴', label: 'Chemical Name',      labelHindi: 'रासायनिक नाम',    value: chemicalName,       bg: 'bg-blue-50 border-blue-100' },
    { icon: '⚗️', label: 'Active Ingredient',  labelHindi: 'सक्रिय तत्व',     value: activeIngredient,   bg: 'bg-indigo-50 border-indigo-100' },
    { icon: '📏', label: 'Dosage',             labelHindi: 'खुराक',            value: dosage,             bg: 'bg-sky-50 border-sky-100' },
    { icon: '🔧', label: 'Mixing Method',      labelHindi: 'मिश्रण विधि',     value: mixingMethod,       bg: 'bg-cyan-50 border-cyan-100' },
    { icon: '⏰', label: 'Spray Timing',       labelHindi: 'छिड़काव का समय',   value: sprayTiming,        bg: 'bg-violet-50 border-violet-100' },
    { icon: '🔁', label: 'Spray Interval',     labelHindi: 'छिड़काव अंतराल',   value: sprayInterval,      bg: 'bg-purple-50 border-purple-100' },
    { icon: '⏳', label: 'Waiting Period',     labelHindi: 'प्रतीक्षा अवधि',  value: waitingPeriod,      bg: 'bg-rose-50 border-rose-100' },
    { icon: '🦺', label: 'Protective Equip.',  labelHindi: 'सुरक्षा उपकरण',   value: protectiveEquipment,bg: 'bg-orange-50 border-orange-100' },
  ].filter(d => d.value);

  return (
    <SectionCard emoji="💊" title="Chemical Solution" titleHindi="रासायनिक उपचार" className="border-blue-200">
      <ul className="space-y-2 mb-3">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <FaFlask className="flex-shrink-0 mt-0.5 text-blue-500" size={11} />
            <span className="text-sm text-blue-900 leading-relaxed">{line}</span>
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-blue-900 whitespace-pre-line">{treatment}</li>}
      </ul>
      {grid.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {grid.map((d, i) => (
            <div key={i} className={`rounded-xl border p-3 ${d.bg}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{d.icon} {d.label} / {d.labelHindi}</p>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">{d.value}</p>
            </div>
          ))}
        </div>
      )}
      {safetyInstructions && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">⚠️ Safety Instructions / सुरक्षा निर्देश</p>
          <p className="text-xs text-red-900 leading-relaxed whitespace-pre-line">{safetyInstructions}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Prevention Phases Card ───────────────────────────────────────────────────

export function PreventionPhasesCard({ prevention, beforeDisease, duringDisease, afterRecovery, voiceLang }: {
  prevention: string; preventionHindi?: string;
  beforeDisease?: string; duringDisease?: string; afterRecovery?: string; voiceLang?: string;
}) {
  const phases = [
    { icon: '🛡️', label: 'Before Disease',  labelHindi: 'रोग से पहले',  value: beforeDisease,  bg: 'bg-teal-50 border-teal-200' },
    { icon: '⚔️', label: 'During Disease',  labelHindi: 'रोग के दौरान', value: duringDisease,  bg: 'bg-amber-50 border-amber-200' },
    { icon: '🌱', label: 'After Recovery',  labelHindi: 'ठीक होने के बाद', value: afterRecovery, bg: 'bg-emerald-50 border-emerald-200' },
  ].filter(p => p.value);

  const lines = parseLines(prevention);

  return (
    <SectionCard emoji="🛡️" title="Preventive Measures" titleHindi="रोकथाम के उपाय" className="border-teal-200">
      {phases.length > 0 ? (
        <div className="space-y-3">
          {phases.map((p, i) => (
            <div key={i} className={`rounded-xl border p-3 ${p.bg}`}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                {p.icon} {p.label} / {p.labelHindi}
              </p>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{p.value}</p>
            </div>
          ))}
          {prevention && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
              <p className="text-xs font-bold text-teal-600 mb-1">📋 General Prevention / सामान्य रोकथाम</p>
              <ul className="space-y-1.5">
                {lines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FaShieldAlt className="flex-shrink-0 mt-0.5 text-teal-500" size={10} />
                    <span className="text-xs text-teal-900">{line}</span>
                  </li>
                ))}
                {lines.length === 0 && <li className="text-sm text-teal-900 whitespace-pre-line">{prevention}</li>}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <FaShieldAlt className="flex-shrink-0 mt-0.5 text-teal-500" size={11} />
              <span className="text-sm text-teal-900 leading-relaxed">{line}</span>
            </li>
          ))}
          {lines.length === 0 && <li className="text-sm text-teal-900 whitespace-pre-line">{prevention}</li>}
        </ul>
      )}
      {voiceLang && (
        <Suspense fallback={null}>
          <VoicePlayer text={prevention} lang={voiceLang} autoDetect={false} className="mt-3" />
        </Suspense>
      )}
    </SectionCard>
  );
}

// ─── Nearby Shop Card ─────────────────────────────────────────────────────────

export function NearbyShopCard({ shop }: {
  shop: { name?: string; distance?: string; phone?: string; address?: string; lat?: number; lng?: number };
}) {
  if (!shop?.name) return null;
  const mapsUrl = shop.lat && shop.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`
    : shop.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}` : null;

  return (
    <SectionCard emoji="🏪" title="Nearest Input Shop" titleHindi="निकटतम दुकान" className="border-violet-200">
      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-bold text-violet-900 text-base">{shop.name}</p>
            {shop.address && <p className="text-xs text-violet-700 mt-0.5">{shop.address}</p>}
            <div className="flex flex-wrap gap-3 mt-2">
              {shop.distance && (
                <span className="flex items-center gap-1 text-xs font-semibold text-violet-600">
                  <FaMapMarkerAlt size={10} /> {shop.distance}
                </span>
              )}
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition">
                  <FaPhone size={10} /> {shop.phone}
                </a>
              )}
            </div>
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 transition flex-shrink-0">
              <FaExternalLinkAlt size={10} /> Navigate
            </a>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Related Diseases Card ────────────────────────────────────────────────────

export function RelatedDiseasesCard({ relatedDiseases }: { relatedDiseases: string }) {
  if (!relatedDiseases?.trim()) return null;
  const lines = parseLines(relatedDiseases);
  return (
    <SectionCard emoji="🔗" title="Related Diseases" titleHindi="संबंधित रोग" className="border-pink-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border border-pink-100 bg-pink-50 p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-pink-100 text-sm">🦠</div>
            <span className="text-sm text-pink-900 font-medium">{line}</span>
          </div>
        ))}
        {lines.length === 0 && <p className="text-sm text-pink-900 whitespace-pre-line col-span-2">{relatedDiseases}</p>}
      </div>
    </SectionCard>
  );
}

// ─── FAQs Card ───────────────────────────────────────────────────────────────

export function FaqsCard({ faqs }: { faqs: string }) {
  if (!faqs?.trim()) return null;
  const lines = parseLines(faqs);
  return (
    <SectionCard emoji="❓" title="Frequently Asked Questions" titleHindi="अक्सर पूछे जाने वाले प्रश्न" className="border-sky-200 dark:border-sky-800">
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800 p-3">
            <p className="text-sm text-sky-900 dark:text-sky-200 leading-relaxed">{line}</p>
          </div>
        ))}
        {lines.length === 0 && (
          <p className="text-sm text-sky-900 dark:text-sky-200 whitespace-pre-line">{faqs}</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Generic knowledge card (for any extra backend field) ─────────────────────

export function KnowledgeCard({ label, labelHindi, emoji, content, bgClass = 'bg-slate-50', borderClass = 'border-slate-200', textClass = 'text-slate-700' }: {
  label: string; labelHindi?: string; emoji: string; content: string;
  bgClass?: string; borderClass?: string; textClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bgClass} ${borderClass}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
        <span>{emoji}</span> {label}{labelHindi ? ` / ${labelHindi}` : ''}
      </p>
      <p className={`text-sm leading-relaxed whitespace-pre-line ${textClass}`}>{content}</p>
    </div>
  );
}
