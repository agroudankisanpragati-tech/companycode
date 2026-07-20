import { DiseaseRecommendation, IDiseaseRecommendation } from '../models/DiseaseRecommendation';
import { DiseaseKnowledgeBase } from '../models/DiseaseKnowledgeBase';
import { DiseasePestSolution } from '../models/DiseasePestSolution';
import type { Document } from 'mongoose';
import { isCropSupportedByYolo, callYoloPredict, YoloPrediction } from './yoloService';

const SIMILARITY_THRESHOLD = 0.80;
const KB_PROMOTE_THRESHOLD = 3; // auto-promote after 3 helpful feedbacks

/** Minimum YOLO confidence (%) required to return a prediction. Below this the
 *  scan endpoint returns a low-confidence response and asks for a clearer image. */
export const YOLO_CONFIDENCE_THRESHOLD = parseInt(
  process.env.YOLO_CONFIDENCE_THRESHOLD || '30',
  10
);

function normalize(s: string) { return s.toLowerCase().trim(); }

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalize(a); const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // token overlap
  const ta = new Set(na.split(/[\s,]+/));
  const tb = new Set(nb.split(/[\s,]+/));
  const intersection = [...ta].filter(x => tb.has(x)).length;
  if (intersection > 0) return 0.5 + (intersection / Math.max(ta.size, tb.size)) * 0.3;
  return 0;
}

type CacheResult = (Omit<IDiseaseRecommendation, keyof Document> & { _id: any; source: 'cache'; similarityScore: number }) | null;

/** Step 1 — search DiseaseRecommendations (scan history cache) */
export async function searchCache(cropName: string, diseaseName: string): Promise<CacheResult> {
  if (!cropName && !diseaseName) return null;
  const filter: any = {};
  if (cropName) filter.cropName = new RegExp(cropName, 'i');
  if (diseaseName) filter.diseaseName = new RegExp(diseaseName, 'i');
  const hit = await DiseaseRecommendation.findOne(filter).sort({ createdAt: -1 }).lean();
  if (!hit) return null;
  const score = (stringSimilarity(hit.cropName, cropName || '') + stringSimilarity(hit.diseaseName, diseaseName || '')) / 2;
  if (score < SIMILARITY_THRESHOLD) return null;
  return { ...hit, source: 'cache' as const, similarityScore: Math.round(score * 100) };
}

/** Step 2 — search DiseaseKnowledgeBase (permanent knowledge store) */
export async function searchKnowledgeBase(cropName: string, diseaseName: string) {
  const candidates = await DiseaseKnowledgeBase.find({
    ...(cropName ? { cropName: new RegExp(cropName, 'i') } : {}),
  }).lean();

  let best: any = null; let bestScore = 0;
  for (const c of candidates) {
    const s = (stringSimilarity(c.cropName, cropName || '') + stringSimilarity(c.diseaseName, diseaseName || '')) / 2;
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (!best || bestScore < SIMILARITY_THRESHOLD) return null;

  // Increment usage counter
  await DiseaseKnowledgeBase.findByIdAndUpdate(best._id, {
    $inc: { scanCount: 1 },
    lastSeenAt: new Date(),
  });

  return {
    knowledgeBaseId: best._id.toString(),
    cropName: best.cropName,
    diseaseName: best.diseaseName,
    diseaseType: best.diseaseType,
    severityLevel: best.severityLevel,
    symptoms: [best.leafSymptoms, best.stemSymptoms, best.rootSymptoms, best.fruitSymptoms, best.symptomsDescription, best.symptoms]
      .filter(Boolean).join('\n'),
    organicTreatment: best.organicTreatment || best.organicSolution || '',
    chemicalTreatment: best.chemicalTreatment || best.chemicalSolution || '',
    treatment: [best.organicTreatment || best.organicSolution, best.chemicalTreatment || best.chemicalSolution, best.treatmentDescription].filter(Boolean).join('\n'),
    prevention: [best.preventionMethods, best.preventionDescription, best.prevention].filter(Boolean).join('\n'),
    recommendedActions: best.recommendedActions || '',
    description: best.description,
    confidenceScore: best.confidenceScore,
    source: 'knowledge_base' as const,
    similarityScore: Math.round(bestScore * 100),
    // Extended fields
    urgentPrevention: best.urgentPrevention || '',
    recoveryTips: best.recoveryTips || '',
    dos: best.dos || '',
    donts: best.donts || '',
    recommendedProducts: best.recommendedProducts || '',
    recommendedFertilizer: best.recommendedFertilizer || '',
    recommendedBioProduct: best.recommendedBioProduct || '',
    recommendedOrganicProduct: best.recommendedOrganicProduct || '',
    extraFarmerAdvice: best.extraFarmerAdvice || '',
    suitableWeather: best.suitableWeather || '',
    diseaseImages: best.diseaseImages || [],
    healthyImages: best.healthyImages || [],
    imageGallery: best.imageGallery || [],
    tags: best.tags || [],
  };
}

// =============================================================================
// ADVISORY LOOKUP — uses YOLO prediction labels to fetch KB advisory data.
// This is the ONLY way advisory content is retrieved in the scan pipeline.
// Pragati AI / LLM never predicts disease — it only explains KB content.
// =============================================================================

export interface KBAdvisory {
  knowledgeBaseId: string;
  symptoms: string;
  organicTreatment: string;
  chemicalTreatment: string;
  treatment: string;
  prevention: string;
  description: string;
  recommendedActions: string;
  urgentPrevention: string;
  recoveryTips: string;
  dos: string;
  donts: string;
  recommendedProducts: string;
  recommendedFertilizer: string;
  recommendedBioProduct: string;
  recommendedOrganicProduct: string;
  extraFarmerAdvice: string;
  suitableWeather: string;
  diseaseImages: string[];
  tags: string[];
  source: 'dps' | 'knowledge_base';
}

/**
 * Fetch advisory content (symptoms, treatment, prevention, etc.) from the
 * knowledge base using YOLO-provided crop name and disease/pest label.
 *
 * Priority:
 *   1. Admin-curated DiseasePestSolution (exact crop + disease match)
 *   2. DiseaseKnowledgeBase (fuzzy crop + disease match)
 *
 * Returns null when no advisory data exists — the scan result is still valid
 * because the prediction came from YOLO.
 */
export async function getAdvisoryFromKnowledgeBase(
  cropName: string,
  diseaseName: string
): Promise<KBAdvisory | null> {
  // ── Priority 1: Admin-curated DiseasePestSolution ─────────────────────────
  try {
    const dps = await DiseasePestSolution.findOne({
      cropName:        { $regex: `^${cropName.trim()}$`,    $options: 'i' },
      diseasePestName: { $regex: `^${diseaseName.trim()}$`, $options: 'i' },
      status: 'published',
    }).lean();

    if (dps) {
      return {
        knowledgeBaseId:          '',
        symptoms:                 dps.symptoms           || '',
        organicTreatment:         dps.organicSolution    || '',
        chemicalTreatment:        dps.chemicalSolution   || '',
        treatment:                [dps.organicSolution, dps.chemicalSolution].filter(Boolean).join('\n'),
        prevention:               dps.preventiveMeasures || '',
        description:              dps.description        || '',
        recommendedActions:       dps.urgentPrevention   || '',
        urgentPrevention:         dps.urgentPrevention   || '',
        recoveryTips:             dps.recoveryTips       || '',
        dos:                      dps.dos                || '',
        donts:                    dps.donts              || '',
        recommendedProducts:      dps.recommendedProducts || '',
        recommendedFertilizer:    '',
        recommendedBioProduct:    '',
        recommendedOrganicProduct: '',
        extraFarmerAdvice:        dps.farmerAdvice       || '',
        suitableWeather:          '',
        diseaseImages:            dps.referenceImages    || [],
        tags:                     dps.tags               || [],
        source:                   'dps',
      };
    }
  } catch (err: any) {
    console.warn('[Advisory] DPS lookup failed (non-fatal):', err?.message);
  }

  // ── Priority 2: DiseaseKnowledgeBase ─────────────────────────────────────
  try {
    const candidates = await DiseaseKnowledgeBase.find({
      cropName: { $regex: cropName.trim(), $options: 'i' },
    }).lean();

    let best: any = null;
    let bestScore = 0;
    for (const c of candidates) {
      const s = (stringSimilarity(c.cropName, cropName) + stringSimilarity(c.diseaseName, diseaseName)) / 2;
      if (s > bestScore) { bestScore = s; best = c; }
    }

    if (!best || bestScore < SIMILARITY_THRESHOLD) return null;

    await DiseaseKnowledgeBase.findByIdAndUpdate(best._id, {
      $inc: { scanCount: 1 },
      lastSeenAt: new Date(),
    });

    return {
      knowledgeBaseId:          best._id.toString(),
      symptoms:                 [best.leafSymptoms, best.stemSymptoms, best.rootSymptoms, best.fruitSymptoms, best.symptomsDescription, best.symptoms].filter(Boolean).join('\n'),
      organicTreatment:         best.organicTreatment  || best.organicSolution  || '',
      chemicalTreatment:        best.chemicalTreatment || best.chemicalSolution || '',
      treatment:                [best.organicTreatment || best.organicSolution, best.chemicalTreatment || best.chemicalSolution, best.treatmentDescription].filter(Boolean).join('\n'),
      prevention:               [best.preventionMethods, best.preventionDescription, best.prevention].filter(Boolean).join('\n'),
      description:              best.description       || '',
      recommendedActions:       best.recommendedActions || '',
      urgentPrevention:         best.urgentPrevention  || '',
      recoveryTips:             best.recoveryTips      || '',
      dos:                      best.dos               || '',
      donts:                    best.donts             || '',
      recommendedProducts:      best.recommendedProducts || '',
      recommendedFertilizer:    best.recommendedFertilizer || '',
      recommendedBioProduct:    best.recommendedBioProduct || '',
      recommendedOrganicProduct: best.recommendedOrganicProduct || '',
      extraFarmerAdvice:        best.extraFarmerAdvice || '',
      suitableWeather:          best.suitableWeather   || '',
      diseaseImages:            best.diseaseImages     || [],
      tags:                     best.tags              || [],
      source:                   'knowledge_base',
    };
  } catch (err: any) {
    console.warn('[Advisory] KB lookup failed (non-fatal):', err?.message);
    return null;
  }
}

// =============================================================================
// YOLO-ONLY DETECTION — OpenAI Vision removed
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
};

/**
 * YOLO-only disease detection.
 * OpenAI Vision is NOT used anywhere in this function.
 */
export async function runHybridDiseaseDetection(
  imagePath: string,
  _imageBase64: string,
  cropHint?: string,
): Promise<{
  engine: 'yolo';
  result: AIDetectionResult | null;
  yoloRaw?: YoloPrediction;
}> {
  console.log(`[Disease] Received cropName: '${cropHint || ''}'`);

  const cropSupported = cropHint ? await isCropSupportedByYolo(cropHint) : false;
  console.log(`[Disease] Crop supported by YOLO: ${cropSupported}`);

  if (!cropSupported) {
    console.log(`[Disease] Fallback reason: crop '${cropHint}' not found in YOLO index`);
    return { engine: 'yolo', result: null };
  }

  console.log(`[Disease] Sending to YOLO: imagePath=${imagePath}, cropHint=${cropHint}`);
  const yoloResult = await callYoloPredict(imagePath, cropHint);
  console.log(`[Disease] YOLO raw result: ${JSON.stringify(yoloResult)}`);

  if (!yoloResult) {
    console.log(`[Disease] Fallback reason: YOLO returned null for crop '${cropHint}'`);
    return { engine: 'yolo', result: null };
  }

  console.log(`[Disease] YOLO prediction: class=${yoloResult.class_name}, confidence=${yoloResult.confidence}%, category=${yoloResult.category}`);

  const isHealthy =
    yoloResult.category === 'healthy' ||
    yoloResult.class_name.toLowerCase().includes('healthy');

  const cropPrefix = (yoloResult.crop || cropHint || '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  const diseaseRaw = yoloResult.class_name
    .replace(new RegExp(`^${cropPrefix}_?`, 'i'), '')
    .replace(/_/g, ' ')
    .trim();

  const conf = yoloResult.confidence;
  const severity = conf >= 90 ? 'high' : conf >= 70 ? 'medium' : 'low';
  const diseaseName = isHealthy ? 'Healthy' : (diseaseRaw || yoloResult.class_name);

  console.log(`[Disease] Final disease: '${diseaseName}', severity: ${severity}, confidence: ${conf}%`);

  const mapped: AIDetectionResult = {
    cropName: yoloResult.crop || cropHint || 'Unknown Crop',
    cropNameHindi: '',
    diseaseName,
    diseaseNameHindi: '',
    diseaseType: isHealthy ? 'Healthy' : yoloResult.category === 'pests' ? 'Pest' : 'Disease',
    severityLevel: isHealthy ? 'low' : severity,
    confidenceScore: Math.round(conf),
    symptoms: '', symptomsHindi: '',
    organicTreatment: '', organicTreatmentHindi: '',
    chemicalTreatment: '', chemicalTreatmentHindi: '',
    treatment: '',
    prevention: '', preventionHindi: '',
    recommendedActions: '', recommendedActionsHindi: '',
    description: `Detected by AgroDhan AI: ${yoloResult.class_name} (${conf.toFixed(1)}% confidence)`,
    descriptionHindi: '',
  };

  return { engine: 'yolo', result: mapped, yoloRaw: yoloResult };
}

/** Auto-save AI result to DiseaseKnowledgeBase for future reuse */
export async function autoSaveToKnowledgeBase(aiResult: AIDetectionResult, imageUrl?: string) {
  try {
    await DiseaseKnowledgeBase.findOneAndUpdate(
      { cropName: new RegExp(`^${aiResult.cropName}$`, 'i'), diseaseName: new RegExp(`^${aiResult.diseaseName}$`, 'i') },
      {
        $setOnInsert: {
          cropName: aiResult.cropName,
          cropCategory: 'General',
          diseaseName: aiResult.diseaseName,
          diseaseType: aiResult.diseaseType,
          severityLevel: aiResult.severityLevel,
          description: aiResult.description,
          symptoms: aiResult.symptoms,
          symptomsDescription: aiResult.symptoms,
          organicSolution: aiResult.organicTreatment,
          organicTreatment: aiResult.organicTreatment,
          chemicalSolution: aiResult.chemicalTreatment,
          chemicalTreatment: aiResult.chemicalTreatment,
          prevention: aiResult.prevention,
          preventionMethods: aiResult.prevention,
          recommendedActions: aiResult.recommendedActions,
          diseaseImages: imageUrl ? [imageUrl] : [],
          healthyImages: [],
          source: 'ai_auto',
          confidenceScore: aiResult.confidenceScore,
        },
        $inc: { scanCount: 1 },
        $set: { lastSeenAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error('KB auto-save error:', err);
  }
}

/** Called when feedback is 'helpful' — promote ai_auto to ai_verified after threshold */
export async function handleFeedbackForKB(knowledgeBaseId: string | undefined, cropName: string, diseaseName: string, isHelpful: boolean) {
  const filter = knowledgeBaseId
    ? { _id: knowledgeBaseId }
    : { cropName: new RegExp(`^${cropName}$`, 'i'), diseaseName: new RegExp(`^${diseaseName}$`, 'i') };

  const update: any = isHelpful
    ? { $inc: { helpfulCount: 1 } }
    : { $inc: { notHelpfulCount: 1 } };

  const doc = await DiseaseKnowledgeBase.findOneAndUpdate(filter, update, { new: true });

  if (doc && isHelpful && doc.source === 'ai_auto' && doc.helpfulCount >= KB_PROMOTE_THRESHOLD) {
    await DiseaseKnowledgeBase.findByIdAndUpdate(doc._id, { source: 'ai_verified' });
  }
}
