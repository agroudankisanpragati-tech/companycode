/**
 * Knowledge Base Search
 *
 * Unified KB search with strict priority order:
 *   1. Admin KB (DiseasePestSolution — admin-curated, highest trust)
 *   2. Crop KB (CropKnowledgeBase)
 *   3. Disease KB (DiseaseKnowledgeBase)
 *   4. General KB (PestKnowledgeBase)
 *   5. Static KB (hardcoded fallback for common queries)
 *
 * Rules:
 * - Never bypasses local knowledge
 * - Returns first match found in priority order
 * - All searches are case-insensitive regex
 * - Structured result with confidence score
 */

import { DiseasePestSolution } from '../models/DiseasePestSolution';
import { DiseaseKnowledgeBase } from '../models/DiseaseKnowledgeBase';
import { CropKnowledgeBase } from '../models/CropKnowledgeBase';
import { PestKnowledgeBase } from '../models/PestKnowledgeBase';
import { GovtScheme } from '../models/GovtScheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KBSource = 'admin_kb' | 'crop_kb' | 'disease_kb' | 'pest_kb' | 'static_kb' | 'none';

export interface KBSearchResult {
  found:      boolean;
  source:     KBSource;
  confidence: number;   // 0–1
  data:       Record<string, any>;
  summary:    string;
}

const NOT_FOUND: KBSearchResult = {
  found: false, source: 'none', confidence: 0, data: {}, summary: '',
};

// ─── Static KB — hardcoded common knowledge ───────────────────────────────────

const STATIC_DISEASE_KB: Record<string, Partial<KBSearchResult['data']>> = {
  'yellow mosaic virus': {
    diseaseName: 'Yellow Mosaic Virus',
    cropName: 'Moong/Soybean',
    symptoms: 'Yellow patches on leaves, stunted growth, reduced yield',
    organicSolution: 'Remove infected plants. Use neem oil spray (5ml/L). Plant resistant varieties.',
    chemicalSolution: 'Imidacloprid 17.8% SL @ 0.5ml/L to control whitefly vector.',
    prevention: 'Use virus-free certified seeds. Control whitefly with yellow sticky traps.',
    severity: 'High',
    cause: 'Whitefly-transmitted Begomovirus',
  },
  'late blight': {
    diseaseName: 'Late Blight',
    cropName: 'Potato/Tomato',
    symptoms: 'Dark water-soaked lesions on leaves, white fungal growth on underside',
    organicSolution: 'Copper-based fungicide (Bordeaux mixture 1%). Remove infected leaves.',
    chemicalSolution: 'Mancozeb 75% WP @ 2.5g/L or Metalaxyl + Mancozeb @ 2g/L',
    prevention: 'Avoid overhead irrigation. Use certified disease-free seed tubers.',
    severity: 'Very High',
    cause: 'Phytophthora infestans (oomycete)',
  },
  'powdery mildew': {
    diseaseName: 'Powdery Mildew',
    cropName: 'Multiple crops',
    symptoms: 'White powdery coating on leaves and stems',
    organicSolution: 'Spray diluted milk (1:9 ratio) or baking soda solution (5g/L).',
    chemicalSolution: 'Sulfur 80% WP @ 3g/L or Hexaconazole 5% EC @ 1ml/L',
    prevention: 'Ensure good air circulation. Avoid excess nitrogen fertilizer.',
    severity: 'Medium',
    cause: 'Erysiphe/Podosphaera fungal species',
  },
  'bacterial blight': {
    diseaseName: 'Bacterial Blight',
    cropName: 'Rice/Cotton',
    symptoms: 'Water-soaked lesions turning yellow-brown, wilting',
    organicSolution: 'Seed treatment with Pseudomonas fluorescens @ 10g/kg seed.',
    chemicalSolution: 'Copper oxychloride 50% WP @ 3g/L. Streptomycin + Tetracycline.',
    prevention: 'Use resistant varieties. Avoid flood irrigation during humid weather.',
    severity: 'High',
    cause: 'Xanthomonas oryzae / Xanthomonas campestris',
  },
};

// ─── Disease search ───────────────────────────────────────────────────────────

export async function searchDiseaseKB(
  cropName:    string,
  diseaseName: string,
): Promise<KBSearchResult> {
  const crop    = cropName?.trim();
  const disease = diseaseName?.trim();

  if (!crop && !disease) return NOT_FOUND;

  // Priority 1: Admin KB (DiseasePestSolution)
  try {
    const filter: any = { status: 'published' };
    if (crop)    filter.cropName        = new RegExp(crop, 'i');
    if (disease) filter.diseasePestName = new RegExp(disease, 'i');

    const dps = await DiseasePestSolution.findOne(filter).lean() as any;
    if (dps) {
      return {
        found:      true,
        source:     'admin_kb',
        confidence: 0.95,
        data: {
          cropName:         dps.cropName,
          diseaseName:      dps.diseasePestName,
          cause:            dps.cause || dps.causes,
          symptoms:         dps.symptoms,
          severity:         dps.severity || dps.severityLevel,
          organicSolution:  dps.organicSolution,
          chemicalSolution: dps.chemicalSolution,
          prevention:       dps.preventiveMeasures,
          urgentPrevention: dps.urgentPrevention,
          recoveryTips:     dps.recoveryTips,
          dos:              dps.dos,
          donts:            dps.donts,
          fertilizerAdvice: dps.fertilizerAdvice,
          irrigationAdvice: dps.irrigationAdvice,
          warnings:         dps.warnings,
          nextSteps:        dps.nextSteps,
          source:           'admin_kb',
        },
        summary: `${dps.diseasePestName} on ${dps.cropName} — Admin curated solution available.`,
      };
    }
  } catch { /* non-fatal */ }

  // Priority 2: Disease KB
  try {
    const kbFilter: any = {};
    if (crop)    kbFilter.cropName    = new RegExp(crop, 'i');
    if (disease) kbFilter.diseaseName = new RegExp(disease, 'i');

    const kb = await DiseaseKnowledgeBase.findOne(kbFilter).lean() as any;
    if (kb) {
      return {
        found:      true,
        source:     'disease_kb',
        confidence: 0.80,
        data: {
          cropName:         kb.cropName,
          diseaseName:      kb.diseaseName,
          cause:            kb.cause || kb.causes,
          symptoms:         kb.symptoms || kb.symptomsDescription,
          severity:         kb.severity || kb.severityLevel,
          organicSolution:  kb.organicSolution || kb.organicTreatment,
          chemicalSolution: kb.chemicalSolution || kb.chemicalTreatment,
          prevention:       kb.prevention || kb.preventionMethods,
          source:           'disease_kb',
        },
        summary: `${kb.diseaseName} on ${kb.cropName} — Disease KB match.`,
      };
    }
  } catch { /* non-fatal */ }

  // Priority 3: Pest KB
  try {
    const pestFilter: any = {};
    if (crop)    pestFilter.cropName  = new RegExp(crop, 'i');
    if (disease) pestFilter.pestName  = new RegExp(disease, 'i');

    const pest = await PestKnowledgeBase.findOne(pestFilter).lean() as any;
    if (pest) {
      return {
        found:      true,
        source:     'pest_kb',
        confidence: 0.75,
        data: {
          cropName:         pest.cropName,
          diseaseName:      pest.pestName,
          cause:            pest.cause || 'Pest infestation',
          symptoms:         pest.symptoms || pest.damageSymptoms,
          organicSolution:  pest.organicControl || pest.biologicalControl,
          chemicalSolution: pest.chemicalControl,
          prevention:       pest.prevention || pest.preventiveMeasures,
          source:           'pest_kb',
        },
        summary: `${pest.pestName} on ${pest.cropName} — Pest KB match.`,
      };
    }
  } catch { /* non-fatal */ }

  // Priority 4: Static KB
  const staticKey = disease?.toLowerCase() || '';
  for (const [key, data] of Object.entries(STATIC_DISEASE_KB)) {
    if (staticKey.includes(key) || key.includes(staticKey)) {
      return {
        found:      true,
        source:     'static_kb',
        confidence: 0.60,
        data:       { ...data },
        summary:    `${data.diseaseName} — Static KB match.`,
      };
    }
  }

  return NOT_FOUND;
}

// ─── Crop search ──────────────────────────────────────────────────────────────

export async function searchCropKB(
  cropName:  string,
  soilType?: string,
  season?:   string,
): Promise<KBSearchResult> {
  if (!cropName?.trim()) return NOT_FOUND;

  try {
    const filter: any = { cropName: new RegExp(cropName, 'i'), status: 'active' };
    if (soilType) filter.soilType = new RegExp(soilType, 'i');
    if (season)   filter.season   = new RegExp(season, 'i');

    const entry = await CropKnowledgeBase.findOne(filter)
      .sort({ suitabilityScore: -1 })
      .lean() as any;

    if (entry) {
      return {
        found:      true,
        source:     'crop_kb',
        confidence: 0.85,
        data: {
          cropName:         entry.cropName,
          soilType:         entry.soilType,
          season:           entry.season,
          suitabilityScore: entry.suitabilityScore,
          waterRequirement: entry.waterRequirement,
          growingDuration:  entry.growingDuration,
          estimatedYield:   entry.expectedYield,
          marketDemand:     entry.marketDemand,
          cultivationGuide: entry.cultivationProcess,
          fertilizerPlan:   entry.fertilizerPlan,
          riskLevel:        entry.riskLevel,
          whySuitable:      entry.aiRecommendation || entry.description,
        },
        summary: `${entry.cropName}: ${entry.season} season, ${entry.soilType} soil, ${entry.suitabilityScore}% suitability.`,
      };
    }
  } catch { /* non-fatal */ }

  return NOT_FOUND;
}

// ─── Government scheme search ─────────────────────────────────────────────────

export async function searchSchemeKB(
  keyword: string,
  state?:  string,
): Promise<KBSearchResult> {
  if (!keyword?.trim() && !state?.trim()) return NOT_FOUND;

  try {
    const filter: any = { status: 'published' };
    if (keyword) {
      filter.$or = [
        { title:    new RegExp(keyword, 'i') },
        { summary:  new RegExp(keyword, 'i') },
        { tags:     new RegExp(keyword, 'i') },
        { keywords: new RegExp(keyword, 'i') },
      ];
    } else if (state) {
      filter.$or = [
        { schemeType: 'central' },
        { state: new RegExp(state, 'i') },
      ];
    }

    const schemes = await GovtScheme.find(filter)
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean() as any[];

    if (schemes.length > 0) {
      return {
        found:      true,
        source:     'admin_kb',
        confidence: 0.90,
        data: {
          schemes: schemes.map(s => ({
            title:              s.title,
            department:         s.department,
            summary:            s.summary,
            benefits:           s.benefits,
            eligibility:        s.eligibility,
            applicationProcess: s.applicationProcess,
            applicationLink:    s.applicationLink,
            schemeType:         s.schemeType,
            state:              s.state,
          })),
        },
        summary: `Found ${schemes.length} scheme(s): ${schemes.map(s => s.title).join(', ')}`,
      };
    }
  } catch { /* non-fatal */ }

  return NOT_FOUND;
}
