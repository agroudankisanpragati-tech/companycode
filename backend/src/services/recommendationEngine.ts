import { CropKnowledgeBase, ICropKnowledgeBase } from '../models/CropKnowledgeBase';
import { IFarmerCropRequest } from '../models/FarmerCropRequest';

export interface IRecommendationItem {
  cropName: string;
  cropCategory: string;
  suitabilityScore: number;
  whySuitable: string;
  waterRequirement: string;
  estimatedCultivationCost: number;
  estimatedYield: string;
  expectedRevenue: number;
  expectedProfit: number;
  marketDemand: string;
  risks: string;
  cultivationGuide: string;
  growingDuration?: number;
  riskLevel?: string;
  currentMarketPrice?: number;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
}

const WEIGHTS = {
  soilMatch: 0.30,
  phMatch: 0.20,
  waterMatch: 0.15,
  seasonMatch: 0.15,
  climateMatch: 0.10,
  budgetMatch: 0.10,
};

const MIN_SUITABILITY = 70;

function scoreSoil(crop: ICropKnowledgeBase, soilType: string): number {
  const farmerSoil = soilType.toLowerCase();
  const match = crop.suitableSoilTypes.some((s) => s.toLowerCase().includes(farmerSoil) || farmerSoil.includes(s.toLowerCase()));
  return match ? 100 : 30;
}

function scorePH(crop: ICropKnowledgeBase, ph: number): number {
  if (ph >= crop.minPH && ph <= crop.maxPH) return 100;
  const distMin = Math.max(0, crop.minPH - ph);
  const distMax = Math.max(0, ph - crop.maxPH);
  const dist = Math.max(distMin, distMax);
  return Math.max(0, 100 - dist * 20);
}

function scoreWater(crop: ICropKnowledgeBase, waterAvailability: string): number {
  const map: Record<string, string[]> = {
    low: ['low'],
    medium: ['low', 'medium'],
    high: ['low', 'medium', 'high'],
  };
  const acceptable = map[waterAvailability] || ['medium'];
  return acceptable.includes(crop.waterRequirement) ? 100 : 20;
}

function scoreSeason(crop: ICropKnowledgeBase, season: string): number {
  if (crop.suitableSeasons.includes('Year-round')) return 100;
  return crop.suitableSeasons.includes(season) ? 100 : 10;
}

function scoreClimate(crop: ICropKnowledgeBase, rainfall?: number, temperature?: number): number {
  let score = 100;
  if (rainfall !== undefined) {
    if (rainfall < crop.minRainfall || rainfall > crop.maxRainfall) score -= 40;
  }
  if (temperature !== undefined) {
    if (temperature < crop.minTemperature || temperature > crop.maxTemperature) score -= 40;
  }
  return Math.max(0, score);
}

function scoreBudget(crop: ICropKnowledgeBase, budget: number): number {
  if (crop.cultivationCost <= budget) return 100;
  const excess = (crop.cultivationCost - budget) / crop.cultivationCost;
  return Math.max(0, 100 - excess * 100);
}

function computeSuitability(crop: ICropKnowledgeBase, req: IFarmerCropRequest): number {
  const soil = scoreSoil(crop, req.soilType);
  const ph = scorePH(crop, req.soilPH);
  const water = scoreWater(crop, req.waterAvailability);
  const season = scoreSeason(crop, req.season);
  const climate = scoreClimate(crop, req.rainfall, req.averageTemperature);
  const budget = scoreBudget(crop, req.budget);

  return (
    soil * WEIGHTS.soilMatch +
    ph * WEIGHTS.phMatch +
    water * WEIGHTS.waterMatch +
    season * WEIGHTS.seasonMatch +
    climate * WEIGHTS.climateMatch +
    budget * WEIGHTS.budgetMatch
  );
}

function cropToRecommendationItem(crop: ICropKnowledgeBase, score: number): IRecommendationItem {
  const revenue = crop.averageYield * crop.averageMarketPrice;
  return {
    cropName: crop.cropName,
    cropCategory: crop.cropCategory,
    suitabilityScore: Math.round(score),
    whySuitable: crop.description,
    waterRequirement: crop.waterRequirement,
    estimatedCultivationCost: crop.cultivationCost,
    estimatedYield: `${crop.averageYield} quintal/acre`,
    expectedRevenue: revenue,
    expectedProfit: crop.estimatedProfit,
    marketDemand: crop.marketDemand,
    risks: `Risk Level: ${crop.riskLevel}. Market demand is ${crop.marketDemand}.`,
    cultivationGuide: crop.cultivationProcess,
    growingDuration: crop.growingDuration,
    riskLevel: crop.riskLevel,
    currentMarketPrice: crop.averageMarketPrice,
    fertilizerRequirement: crop.fertilizerRequirement,
    fertilizerCost: crop.fertilizerCost,
    seedRequirement: crop.seedRequirement,
    recommendedSeedVariety: crop.recommendedSeedVariety,
  };
}

export async function runRecommendationEngine(
  req: IFarmerCropRequest
): Promise<{ recommendations: IRecommendationItem[]; hasHighScore: boolean }> {
  // Only query base entries (no AI context duplicates)
  const crops = await CropKnowledgeBase.find({ sourceType: { $ne: 'AI' } });

  const scored = crops
    .map((crop) => ({ crop, score: computeSuitability(crop, req) }))
    .filter(({ score }) => score >= MIN_SUITABILITY)
    .sort((a, b) => b.score - a.score);

  const recommendations = scored.map(({ crop, score }) => cropToRecommendationItem(crop, score));
  const hasHighScore = recommendations.length > 0;

  return { recommendations, hasHighScore };
}
