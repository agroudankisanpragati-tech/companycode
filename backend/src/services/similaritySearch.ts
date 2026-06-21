import { AIRecommendation, IFarmerConditions, IRecommendationItem } from '../models/AIRecommendation';

const SIMILARITY_THRESHOLD = 0.85;

function calcSimilarity(a: IFarmerConditions, b: IFarmerConditions): number {
  let score = 0;
  let total = 0;

  // Soil type match — weight 30
  total += 30;
  if (a.soilType.toLowerCase() === b.soilType.toLowerCase()) score += 30;

  // Season match — weight 20
  total += 20;
  if (a.season === b.season) score += 20;

  // District match — weight 15
  total += 15;
  if (a.district.toLowerCase() === b.district.toLowerCase()) score += 15;

  // Water availability match — weight 15
  total += 15;
  if (a.waterAvailability === b.waterAvailability) score += 15;

  // pH proximity — weight 10
  total += 10;
  const phDiff = Math.abs(a.soilPH - b.soilPH);
  if (phDiff <= 0.3) score += 10;
  else if (phDiff <= 0.7) score += 5;

  // Budget proximity — weight 10
  total += 10;
  const budgetRatio = Math.min(a.budget, b.budget) / Math.max(a.budget, b.budget);
  if (budgetRatio >= 0.8) score += 10;
  else if (budgetRatio >= 0.5) score += 5;

  return score / total;
}

export async function findSimilarRecommendation(
  conditions: IFarmerConditions
): Promise<{ found: boolean; recommendations: IRecommendationItem[]; similarityScore: number }> {
  // Pre-filter by soil type + season to reduce comparison set
  const candidates = await AIRecommendation.find({
    'farmerConditions.soilType': { $regex: new RegExp(conditions.soilType, 'i') },
    'farmerConditions.season': conditions.season,
  })
    .sort({ createdAt: -1 })
    .limit(50);

  let bestScore = 0;
  let bestMatch: typeof candidates[0] | null = null;

  for (const candidate of candidates) {
    const similarity = calcSimilarity(conditions, candidate.farmerConditions);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = candidate;
    }
  }

  if (bestScore >= SIMILARITY_THRESHOLD && bestMatch) {
    return {
      found: true,
      recommendations: bestMatch.recommendations,
      similarityScore: Math.round(bestScore * 100),
    };
  }

  return { found: false, recommendations: [], similarityScore: Math.round(bestScore * 100) };
}
