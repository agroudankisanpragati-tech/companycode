import { CropKnowledgeBase } from '../models/CropKnowledgeBase';
import { IFarmerConditions } from './openaiService';
import { IRecommendationItem } from './recommendationEngine';

const SIMILARITY_THRESHOLD = 0.85;

function calcSimilarity(a: IFarmerConditions, b: { soilType?: string; season?: string; district?: string; waterAvailability?: string; soilPH?: number; budget?: number }): number {
  let score = 0;
  let total = 0;

  total += 30;
  if (b.soilType && a.soilType.toLowerCase() === b.soilType.toLowerCase()) score += 30;

  total += 20;
  if (b.season && a.season === b.season) score += 20;

  total += 15;
  if (b.district && a.district.toLowerCase() === b.district.toLowerCase()) score += 15;

  total += 15;
  if (b.waterAvailability && a.waterAvailability === b.waterAvailability) score += 15;

  total += 10;
  if (b.soilPH !== undefined) {
    const phDiff = Math.abs(a.soilPH - b.soilPH);
    if (phDiff <= 0.3) score += 10;
    else if (phDiff <= 0.7) score += 5;
  }

  total += 10;
  if (b.budget !== undefined && b.budget > 0) {
    const budgetRatio = Math.min(a.budget, b.budget) / Math.max(a.budget, b.budget);
    if (budgetRatio >= 0.8) score += 10;
    else if (budgetRatio >= 0.5) score += 5;
  }

  return score / total;
}

export async function findSimilarRecommendation(
  conditions: IFarmerConditions
): Promise<{ found: boolean; recommendations: IRecommendationItem[]; similarityScore: number }> {
  // Find AI-sourced entries matching soil + season in CropKnowledgeBase
  const candidates = await CropKnowledgeBase.find({
    sourceType: 'AI',
    status: 'active',
    soilType: { $regex: new RegExp(conditions.soilType, 'i') },
    season: conditions.season,
  })
    .sort({ lastUpdated: -1 })
    .limit(50);

  if (candidates.length === 0) {
    return { found: false, recommendations: [], similarityScore: 0 };
  }

  // Group by context (district+soilType+season) to find best matching group
  const contextMap = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = `${c.district}|${c.soilType}|${c.season}`;
    if (!contextMap.has(key)) contextMap.set(key, []);
    contextMap.get(key)!.push(c);
  }

  let bestScore = 0;
  let bestGroup: typeof candidates = [];

  for (const [, group] of contextMap) {
    const first = group[0];
    const similarity = calcSimilarity(conditions, {
      soilType: first.soilType,
      season: first.season,
      district: first.district,
      waterAvailability: first.waterAvailability,
      soilPH: first.soilPH,
    });
    if (similarity > bestScore) {
      bestScore = similarity;
      bestGroup = group;
    }
  }

  if (bestScore >= SIMILARITY_THRESHOLD && bestGroup.length > 0) {
    const recommendations: IRecommendationItem[] = bestGroup.map((c) => ({
      cropName: c.cropName,
      cropCategory: c.cropCategory,
      suitabilityScore: c.suitabilityScore || 75,
      whySuitable: c.aiRecommendation || c.description,
      waterRequirement: c.waterRequirement,
      estimatedCultivationCost: c.cultivationCost,
      estimatedYield: c.expectedYield || `${c.averageYield} quintal/acre`,
      expectedRevenue: c.averageYield * c.averageMarketPrice,
      expectedProfit: c.estimatedProfit,
      marketDemand: c.marketDemand,
      risks: c.diseaseRisks || `Risk Level: ${c.riskLevel}`,
      cultivationGuide: c.cultivationProcess,
      growingDuration: c.growingDuration,
      riskLevel: c.riskLevel,
      currentMarketPrice: c.marketPrice || c.averageMarketPrice,
      fertilizerRequirement: c.fertilizerRequirement,
      fertilizerCost: c.fertilizerCost,
      seedRequirement: c.seedRequirement,
      recommendedSeedVariety: c.recommendedSeedVariety,
    }));

    return {
      found: true,
      recommendations,
      similarityScore: Math.round(bestScore * 100),
    };
  }

  return { found: false, recommendations: [], similarityScore: Math.round(bestScore * 100) };
}
