/**
 * Knowledge Base Search
 *
 * Disease lookup: Disease & Pest Management (diseasepestsolutions) ONLY.
 */

import { CropKnowledgeBase } from '../models/CropKnowledgeBase';
import { GovtScheme } from '../models/GovtScheme';
import { createSafeRegex } from '../utils/regex';
import { findDiseaseKnowledge } from './diseaseService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KBSource = 'admin_kb' | 'crop_kb' | 'none';

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

// ─── Disease search ───────────────────────────────────────────────────────────

export async function searchDiseaseKB(
  cropName:    string,
  diseaseName: string,
): Promise<KBSearchResult> {
  const crop    = cropName?.trim();
  const disease = diseaseName?.trim();
  if (!crop && !disease) return NOT_FOUND;

  const advisory = await findDiseaseKnowledge(crop, disease);
  if (!advisory) return NOT_FOUND;

  return {
    found:      true,
    source:     'admin_kb',
    confidence: 0.95,
    data: {
      cropName:         crop,
      diseaseName:      disease,
      symptoms:         advisory.symptoms,
      organicSolution:  advisory.organicTreatment,
      chemicalSolution: advisory.chemicalTreatment,
      prevention:       advisory.prevention,
      urgentPrevention: advisory.urgentPrevention,
      recoveryTips:     advisory.recoveryTips,
      dos:              advisory.dos,
      donts:            advisory.donts,
      source:           advisory.source,
    },
    summary: `${disease} on ${crop} — ${advisory.source} match.`,
  };
}

// ─── Crop search ──────────────────────────────────────────────────────────────

export async function searchCropKB(
  cropName:  string,
  soilType?: string,
  season?:   string,
): Promise<KBSearchResult> {
  if (!cropName?.trim()) return NOT_FOUND;

  try {
    const filter: any = { cropName: createSafeRegex(cropName), status: 'active' };
    if (soilType) filter.soilType = createSafeRegex(soilType);
    if (season)   filter.season   = createSafeRegex(season);

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
        { title:    createSafeRegex(keyword) },
        { summary:  createSafeRegex(keyword) },
        { tags:     createSafeRegex(keyword) },
        { keywords: createSafeRegex(keyword) },
      ];
    } else if (state) {
      filter.$or = [
        { schemeType: 'central' },
        { state: createSafeRegex(state) },
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
