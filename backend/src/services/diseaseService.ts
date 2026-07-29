import { DiseaseRecommendation, IDiseaseRecommendation } from '../models/DiseaseRecommendation';
import { DiseasePestSolution, pickLang } from '../models/DiseasePestSolution';
import type { Document } from 'mongoose';
import { isCropSupportedByYolo, callYoloPredict, YoloPrediction } from './yoloService';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

// DiseaseKnowledgeBase is NOT imported. Disease & Pest Management is the only source.

const log = createLogger('diseaseService');

const SIMILARITY_THRESHOLD = 0.55;

export const YOLO_CONFIDENCE_THRESHOLD = parseInt(
  process.env.YOLO_CONFIDENCE_THRESHOLD || '30',
  10
);

// =============================================================================
// NORMALIZATION UTILITIES
// =============================================================================

export function normalizeLabel(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

export function stripCropPrefix(className: string, cropName: string): string {
  const escapedCrop = cropName
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '[\\s_\\-]+');
  const prefixRe = new RegExp(`^${escapedCrop}[\\s_\\-]*`, 'i');
  const stripped = className.replace(prefixRe, '');
  return normalizeLabel(stripped || className);
}

export function normalizeAILabel(rawLabel: string, cropName: string): string {
  const withSpaces = normalizeLabel(rawLabel);
  const cropNorm   = normalizeLabel(cropName);
  if (withSpaces.startsWith(cropNorm + ' ')) {
    return withSpaces.slice(cropNorm.length).trim();
  }
  return stripCropPrefix(rawLabel, cropName);
}

// =============================================================================
// STRING SIMILARITY
// =============================================================================

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(/[\s,]+/).filter(Boolean));
  const tb = new Set(nb.split(/[\s,]+/).filter(Boolean));
  const intersection = [...ta].filter(x => tb.has(x)).length;
  if (intersection > 0) return 0.5 + (intersection / Math.max(ta.size, tb.size)) * 0.4;
  return 0;
}

// =============================================================================
// ADVISORY INTERFACE
// =============================================================================

export interface KBAdvisory {
  knowledgeBaseId: string;
  // Both languages stored — frontend picks based on user language
  displayName: string;
  displayNameHi: string;
  symptoms: string;
  symptomsHi: string;
  organicTreatment: string;
  organicTreatmentHi: string;
  chemicalTreatment: string;
  chemicalTreatmentHi: string;
  treatment: string;
  prevention: string;
  preventionHi: string;
  description: string;
  descriptionHi: string;
  recommendedActions: string;
  recommendedActionsHi: string;
  urgentPrevention: string;
  urgentPreventionHi: string;
  recoveryTips: string;
  recoveryTipsHi: string;
  dos: string;
  dosHi: string;
  donts: string;
  dontsHi: string;
  recommendedProducts: string;
  recommendedProductsHi: string;
  recommendedFertilizer: string;
  recommendedBioProduct: string;
  recommendedOrganicProduct: string;
  extraFarmerAdvice: string;
  extraFarmerAdviceHi: string;
  suitableWeather: string;
  diseaseImages: string[];
  tags: string[];
  source: 'dps';
  resolvedLang: string;
}

// =============================================================================
// SINGLE LOOKUP — Disease & Pest Mgmt (diseasepestsolutions) ONLY
// =============================================================================

/**
 * THE single lookup function used by every module.
 * Source of truth: diseasepestsolutions collection ONLY.
 *
 * Lookup order:
 *   1. Exact match on diseasePestName (case-insensitive, normalized)
 *   2. aiLabel exact match (raw YOLO class_name stored by Admin)
 *   3. aliases array match
 *   4. Fuzzy score >= SIMILARITY_THRESHOLD on diseasePestName
 *   5. keyword / tag match
 *
 * NO fallback to DiseaseKnowledgeBase.
 * NO fallback to PestKnowledgeBase.
 * NO static JSON.
 * NO hardcoded data.
 *
 * @param lang  Language code from request context ('en' | 'hi' | dialect).
 *              Non-English codes all resolve to 'hi' content with English fallback.
 */
export async function findDiseaseKnowledge(
  cropName: string,
  diseaseName: string,
  rawAiLabel?: string,
  lang = 'en',
): Promise<KBAdvisory | null> {
  const crop        = cropName.trim();
  const disease     = diseaseName.trim();
  const normDisease = normalizeLabel(disease);
  const normCrop    = normalizeLabel(crop);

  log.info('[DPS] lookup start', {
    collection:       'diseasepestsolutions',
    incomingAiLabel:  rawAiLabel || '(none)',
    normalizedCrop:   normCrop,
    normalizedDisease: normDisease,
  });

  try {
    // Fetch all records for this crop — both published and draft so we can
    // report status-mismatch accurately, then filter to published only.
    const allForCrop = await DiseasePestSolution.find({
      cropName: createSafeRegex(crop),
    }).lean();

    const candidates = allForCrop.filter(d => d.status === 'published');

    log.info('[DPS] candidates', {
      collection:    'diseasepestsolutions',
      mongoQuery:    { cropName: `/${crop}/i`, status: 'published' },
      totalForCrop:  allForCrop.length,
      published:     candidates.length,
    });

    // Diagnostic: exact failure reason when no published records
    if (allForCrop.length === 0) {
      log.warn('[DPS] FAIL: document not found — no records exist for crop', { crop });
    } else if (candidates.length === 0) {
      log.warn('[DPS] FAIL: status mismatch — records exist but none are published', {
        crop,
        statuses: allForCrop.map(d => ({ name: d.diseasePestName, status: d.status })),
      });
    }

    // ── 1. Exact match on diseasePestName ────────────────────────────────────
    // Also try stripping the crop prefix from the stored diseasePestName
    // so "Black_Gram_Cercospora_Leaf_Spot" matches "Cercospora Leaf Spot".
    let hit = candidates.find(d => {
      const normStored = normalizeLabel(d.diseasePestName);
      if (normStored === normDisease) return true;
      // Strip crop prefix from stored name and compare
      const strippedStored = normalizeAILabel(d.diseasePestName, d.cropName);
      return strippedStored === normDisease;
    }) ?? null;
    if (hit) {
      log.info('[DPS] HIT: exact diseasePestName', {
        matchedDocument: hit.diseasePestName,
        documentId:      (hit as any)._id?.toString(),
      });
      return _buildAdvisory(hit, lang);
    }
    log.info('[DPS] 1: no exact diseasePestName match', {
      normDisease,
      stored: candidates.map(d => normalizeLabel(d.diseasePestName)),
    });

    // ── 2. aiLabel exact match ───────────────────────────────────────────────
    if (rawAiLabel) {
      const normRaw = normalizeLabel(rawAiLabel);
      hit = candidates.find(d => d.aiLabel && normalizeLabel(d.aiLabel) === normRaw) ?? null;
      if (hit) {
        log.info('[DPS] HIT: aiLabel match', {
          matchedDocument: hit.diseasePestName,
          documentId:      (hit as any)._id?.toString(),
          aiLabel:         hit.aiLabel,
        });
        return _buildAdvisory(hit, lang);
      }
      log.info('[DPS] 2: no aiLabel match', {
        normRaw,
        storedLabels: candidates.map(d => d.aiLabel || '(none)'),
      });
    }

    // ── 3. Aliases match ─────────────────────────────────────────────────────
    hit = candidates.find(d =>
      (d.aliases || []).some(a =>
        normalizeLabel(a) === normDisease ||
        (rawAiLabel && normalizeLabel(a) === normalizeLabel(rawAiLabel))
      )
    ) ?? null;
    if (hit) {
      log.info('[DPS] HIT: alias match', {
        matchedDocument: hit.diseasePestName,
        documentId:      (hit as any)._id?.toString(),
      });
      return _buildAdvisory(hit, lang);
    }

    // ── 4. Fuzzy score ───────────────────────────────────────────────────────
    let bestHit: any = null;
    let bestScore    = 0;
    for (const d of candidates) {
      const score = stringSimilarity(d.diseasePestName, disease);
      log.info('[DPS] fuzzy', { diseasePestName: d.diseasePestName, score });
      if (score > bestScore) { bestScore = score; bestHit = d; }
    }
    if (bestHit && bestScore >= SIMILARITY_THRESHOLD) {
      log.info('[DPS] HIT: fuzzy', {
        matchedDocument: bestHit.diseasePestName,
        documentId:      bestHit._id?.toString(),
        score:           bestScore,
      });
      return _buildAdvisory(bestHit, lang);
    }
    if (candidates.length > 0) {
      log.warn('[DPS] FAIL: disease mismatch — fuzzy score too low', {
        normDisease,
        bestScore,
        threshold:     SIMILARITY_THRESHOLD,
        bestCandidate: bestHit?.diseasePestName || '(none)',
      });
    }

    // ── 5. Keyword / tag match ───────────────────────────────────────────────
    const kwHit = candidates.find(d => {
      const allKw = [...(d.keywords || []), ...(d.tags || [])].map(k => normalizeLabel(k));
      return allKw.some(k => normDisease.includes(k) || k.includes(normDisease));
    }) ?? null;
    if (kwHit) {
      log.info('[DPS] HIT: keyword/tag match', {
        matchedDocument: kwHit.diseasePestName,
        documentId:      (kwHit as any)._id?.toString(),
      });
      return _buildAdvisory(kwHit, lang);
    }

    log.warn('[DPS] FAIL: no match found in diseasepestsolutions', {
      crop,
      normDisease,
      rawAiLabel: rawAiLabel || '(none)',
    });
  } catch (err: any) {
    log.error('[DPS] lookup error', { error: err?.message });
  }

  return null;
}

// Alias — keeps existing callers in disease.ts route working without changes
export const getAdvisoryFromKnowledgeBase = findDiseaseKnowledge;

// =============================================================================
// BUILDER — maps DiseasePestSolution fields to KBAdvisory using pickLang
// =============================================================================

function _buildAdvisory(dps: any, lang = 'en'): KBAdvisory {
  // Always resolve both languages — frontend decides which to display
  const en = (field: any) => pickLang(field, 'en');
  const hi = (field: any) => pickLang(field, 'hi');

  const organicEn  = en(dps.organicSolution);
  const organicHi  = hi(dps.organicSolution);
  const chemicalEn = en(dps.chemicalSolution);
  const chemicalHi = hi(dps.chemicalSolution);

  // Effective lang for resolvedLang field only (informational)
  const effectiveLang = lang === 'en' ? 'en' : 'hi';

  return {
    knowledgeBaseId:           (dps as any)._id?.toString() || '',
    displayName:               dps.displayName ? en(dps.displayName) : dps.diseasePestName,
    displayNameHi:             dps.displayName ? hi(dps.displayName) : dps.diseasePestName,
    symptoms:                  en(dps.symptoms),
    symptomsHi:                hi(dps.symptoms),
    organicTreatment:          organicEn,
    organicTreatmentHi:        organicHi,
    chemicalTreatment:         chemicalEn,
    chemicalTreatmentHi:       chemicalHi,
    treatment:                 [organicEn, chemicalEn].filter(Boolean).join('\n'),
    prevention:                en(dps.preventiveMeasures),
    preventionHi:              hi(dps.preventiveMeasures),
    description:               en(dps.description),
    descriptionHi:             hi(dps.description),
    recommendedActions:        en(dps.urgentPrevention),
    recommendedActionsHi:      hi(dps.urgentPrevention),
    urgentPrevention:          en(dps.urgentPrevention),
    urgentPreventionHi:        hi(dps.urgentPrevention),
    recoveryTips:              en(dps.recoveryTips),
    recoveryTipsHi:            hi(dps.recoveryTips),
    dos:                       en(dps.dos),
    dosHi:                     hi(dps.dos),
    donts:                     en(dps.donts),
    dontsHi:                   hi(dps.donts),
    recommendedProducts:       en(dps.recommendedProducts),
    recommendedProductsHi:     hi(dps.recommendedProducts),
    recommendedFertilizer:     '',
    recommendedBioProduct:     '',
    recommendedOrganicProduct: '',
    extraFarmerAdvice:         en(dps.farmerAdvice),
    extraFarmerAdviceHi:       hi(dps.farmerAdvice),
    suitableWeather:           '',
    diseaseImages:             dps.referenceImages || [],
    tags:                      dps.tags            || [],
    source:                    'dps',
    resolvedLang:              effectiveLang,
  };
}

// =============================================================================
// CACHE SEARCH (scan history — DiseaseRecommendation only, no KB query)
// =============================================================================

type CacheResult = (Omit<IDiseaseRecommendation, keyof Document> & { _id: any; source: 'cache'; similarityScore: number }) | null;

export async function searchCache(cropName: string, diseaseName: string): Promise<CacheResult> {
  if (!cropName && !diseaseName) return null;
  const filter: any = {};
  if (cropName)    filter.cropName    = createSafeRegex(cropName);
  if (diseaseName) filter.diseaseName = createSafeRegex(diseaseName);
  const hit = await DiseaseRecommendation.findOne(filter).sort({ createdAt: -1 }).lean();
  if (!hit) return null;
  const score = (stringSimilarity(hit.cropName, cropName || '') + stringSimilarity(hit.diseaseName, diseaseName || '')) / 2;
  if (score < SIMILARITY_THRESHOLD) return null;
  return { ...hit, source: 'cache' as const, similarityScore: Math.round(score * 100) };
}

// =============================================================================
// searchKnowledgeBase — redirected to DPS (used by AI assistant)
// =============================================================================

export async function searchKnowledgeBase(cropName: string, diseaseName: string) {
  return findDiseaseKnowledge(cropName, diseaseName);
}

// =============================================================================
// YOLO-ONLY DETECTION
// =============================================================================

export type AIDetectionResult = {
  cropName: string; cropNameHindi: string;
  diseaseName: string; diseaseNameHindi: string;
  diseaseType: string;
  severityLevel: string;
  symptoms: string; symptomsHindi: string;
  organicTreatment: string; organicTreatmentHindi: string;
  chemicalTreatment: string; chemicalTreatmentHindi: string;
  treatment: string;
  prevention: string; preventionHindi: string;
  description: string; descriptionHindi: string;
  recommendedActions: string; recommendedActionsHindi: string;
  confidenceScore: number;
  rawAiLabel: string;
};

export async function runHybridDiseaseDetection(
  imagePath: string,
  _imageBase64: string,
  cropHint?: string,
): Promise<{
  engine: 'yolo';
  result: AIDetectionResult | null;
  yoloRaw?: YoloPrediction;
  error?: string;
}> {
  log.debug('runHybridDiseaseDetection', { cropHint: cropHint || '(none)' });

  let effectiveCropHint: string | undefined;
  if (cropHint) {
    const supported = await isCropSupportedByYolo(cropHint);
    effectiveCropHint = supported ? cropHint : undefined;
    log.debug('Crop hint resolution', { cropHint, supported });
  }

  const yoloResult = await callYoloPredict(imagePath, effectiveCropHint);

  if (!yoloResult) return { engine: 'yolo', result: null };
  if (!yoloResult.success) {
    return { engine: 'yolo', result: null, error: (yoloResult as any).error };
  }

  log.info('[YOLO] raw prediction', { class_name: yoloResult.class_name, confidence: yoloResult.confidence });

  const isHealthy =
    yoloResult.category === 'healthy' ||
    yoloResult.class_name.toLowerCase().includes('healthy');

  const rawLabel          = yoloResult.class_name;
  const diseaseNormalized = isHealthy
    ? 'Healthy'
    : normalizeAILabel(rawLabel, cropHint || yoloResult.crop || '');

  const diseaseName = isHealthy
    ? 'Healthy'
    : diseaseNormalized
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

  log.info('[YOLO] normalized', { rawLabel, diseaseName });

  const conf     = yoloResult.confidence;
  const severity = conf >= 90 ? 'high' : conf >= 70 ? 'medium' : 'low';

  const mapped: AIDetectionResult = {
    cropName:               cropHint || yoloResult.crop || 'Unknown Crop',
    cropNameHindi:          '',
    diseaseName,
    diseaseNameHindi:       '',
    diseaseType:            isHealthy ? 'Healthy' : yoloResult.category === 'pests' ? 'Pest' : 'Disease',
    severityLevel:          isHealthy ? 'low' : severity,
    confidenceScore:        Math.round(conf),
    rawAiLabel:             rawLabel,
    symptoms:               '', symptomsHindi: '',
    organicTreatment:       '', organicTreatmentHindi: '',
    chemicalTreatment:      '', chemicalTreatmentHindi: '',
    treatment:              '',
    prevention:             '', preventionHindi: '',
    recommendedActions:     '', recommendedActionsHindi: '',
    description:            `Detected by AgroDhan AI: ${rawLabel} (${conf.toFixed(1)}% confidence)`,
    descriptionHindi:       '',
  };

  return { engine: 'yolo', result: mapped, yoloRaw: yoloResult };
}

// AUTO-SAVE — no-op. Disease & Pest Management (diseasepestsolutions) is admin-managed only.

export async function autoSaveToKnowledgeBase(_aiResult: AIDetectionResult, _imageUrl?: string) {
  // Disease & Pest Management (diseasepestsolutions) is admin-managed only.
}

// FEEDBACK — targets DiseasePestSolution _id via knowledgeBaseId

export async function handleFeedbackForKB(
  knowledgeBaseId: string | undefined,
  _cropName: string,
  _diseaseName: string,
  _isHelpful: boolean,
) {
  // knowledgeBaseId points to a DiseasePestSolution _id (set in _buildAdvisory).
  if (knowledgeBaseId) {
    log.info('[DPS] feedback received (no-op)', { knowledgeBaseId });
  }
}
