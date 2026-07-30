'use client';

import { ScanResult, pickField, resolveCauses } from './types';
import DiseaseCard from './DiseaseCard';
import ConfidenceCard from './ConfidenceCard';
import DiseaseKnowledgeSection from './DiseaseKnowledgeSection';
import {
  CauseCard, SeverityCard, NearbyShopCard, ImagesCard,
  FarmerGuidanceCard, RelatedDiseasesCard, FeedbackCard,
  AdvisoryCard, ReferencesCard, FaqsCard,
} from './InfoCards';
import AILanguageSelector from '@/components/AILanguageSelector';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  result: ScanResult;
  baseResult: ScanResult;
  uploadedPreview: string | null;
  voiceLang: string;
  onTranslated: (lang: string, data: Record<string, any>) => void;
  onReset: () => void;
  onFeedback: (type: 'helpful' | 'not_helpful', comment?: string, correctDisease?: string) => void;
  feedback: 'helpful' | 'not_helpful' | null;
  feedbackComment?: string;
  feedbackCorrectDisease?: string;
  onFeedbackCommentChange?: (v: string) => void;
  onFeedbackCorrectDiseaseChange?: (v: string) => void;
}

export default function ResultLayout({ result, baseResult, uploadedPreview, voiceLang, onTranslated, onReset, onFeedback, feedback, feedbackComment = '', feedbackCorrectDisease = '', onFeedbackCommentChange, onFeedbackCorrectDiseaseChange }: Props) {
  const { langCode } = useLanguage();

  const causes = resolveCauses(result);

  return (
    <div className="space-y-4">

      {/* Disease Summary Hero */}
      <DiseaseCard result={result} voiceLang={voiceLang} uploadedPreview={uploadedPreview} />

      {/* Confidence / Severity / Category metrics */}
      <ConfidenceCard result={result} />

      {/* Severity visual indicator */}
      <SeverityCard level={result.severityLevel} />

      {/* Disease Cause & Spread */}
      {(causes || result.spreadPattern || result.weatherConditions || result.highRiskConditions || result.suitableClimate) && (
        <CauseCard
          causes={causes}
          spreadPattern={result.spreadPattern}
          earlyWarningSigns={result.earlyWarningSigns}
          suitableWeather={result.weatherConditions || result.suitableClimate}
        />
      )}

      {/*
        ── Ordered Knowledge Section ──────────────────────────────────────────
        Renders ALL 11 sections as Accordion in exact order:
        1 Description  2 Symptoms  3 Organic  4 Chemical  5 Urgent Prevention
        6 Recovery Tips  7 Preventive Measures  8 Do's & Don'ts
        9 Recommended Products  10 Farmer Advice  11 Nearby KVK
      */}
      <DiseaseKnowledgeSection result={result} />

      {/* Knowledge Base Images */}
      {(result.diseaseImages?.length || result.healthyImages?.length || result.imageGallery?.length) ? (
        <ImagesCard
          diseaseImages={result.diseaseImages}
          healthyImages={result.healthyImages}
          imageGallery={result.imageGallery}
        />
      ) : null}

      {/* FAQs */}
      {result.faqs && <FaqsCard faqs={result.faqs} />}

      {/* Farmer Guidance */}
      {(result.bestTimeToSpray || result.weatherWarning || result.waterRequirement || result.cropCareTips ||
        result.recoveryTime || result.suitableWeather || result.farmingPractices || result.importantNotes) && (
        <FarmerGuidanceCard
          recoveryTime={result.recoveryTime}
          suitableWeather={result.bestTimeToSpray || result.suitableWeather}
          farmingPractices={result.cropCareTips || result.farmingPractices}
          importantNotes={result.weatherWarning || result.waterRequirement || result.importantNotes}
        />
      )}

      {/* Related Diseases */}
      {result.relatedDiseases && <RelatedDiseasesCard relatedDiseases={result.relatedDiseases} />}

      {/* Government Advisory */}
      {result.governmentAdvisory && <AdvisoryCard advisory={result.governmentAdvisory} />}

      {/* Reference Links */}
      {result.referenceLinks?.length ? <ReferencesCard links={result.referenceLinks} /> : null}

      {/* Language selector */}
      {result._id && (
        <AILanguageSelector
          recordId={result._id}
          module="disease"
          englishData={baseResult as any}
          onTranslated={onTranslated}
        />
      )}

      {/* Farmer Feedback */}
      <FeedbackCard
        feedback={feedback}
        onFeedback={onFeedback}
        comment={feedbackComment}
        correctDisease={feedbackCorrectDisease}
        onCommentChange={onFeedbackCommentChange}
        onCorrectDiseaseChange={onFeedbackCorrectDiseaseChange}
      />

      {/* Scan again */}
      <button
        onClick={onReset}
        className="w-full rounded-2xl border-2 border-rose-200 dark:border-rose-800 py-3.5 text-sm font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
      >
        ← Scan Another Crop
      </button>
    </div>
  );
}
