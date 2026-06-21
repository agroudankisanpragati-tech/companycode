"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRecommendationEngine = runRecommendationEngine;
const CropKnowledgeBase_1 = require("../models/CropKnowledgeBase");
const WEIGHTS = {
    soilMatch: 0.30,
    phMatch: 0.20,
    waterMatch: 0.15,
    seasonMatch: 0.15,
    climateMatch: 0.10,
    budgetMatch: 0.10,
};
const MIN_SUITABILITY = 70;
function scoreSoil(crop, soilType) {
    const farmerSoil = soilType.toLowerCase();
    const match = crop.suitableSoilTypes.some((s) => s.toLowerCase().includes(farmerSoil) || farmerSoil.includes(s.toLowerCase()));
    return match ? 100 : 30;
}
function scorePH(crop, ph) {
    if (ph >= crop.minPH && ph <= crop.maxPH)
        return 100;
    const distMin = Math.max(0, crop.minPH - ph);
    const distMax = Math.max(0, ph - crop.maxPH);
    const dist = Math.max(distMin, distMax);
    return Math.max(0, 100 - dist * 20);
}
function scoreWater(crop, waterAvailability) {
    const map = {
        low: ['low'],
        medium: ['low', 'medium'],
        high: ['low', 'medium', 'high'],
    };
    const acceptable = map[waterAvailability] || ['medium'];
    return acceptable.includes(crop.waterRequirement) ? 100 : 20;
}
function scoreSeason(crop, season) {
    if (crop.suitableSeasons.includes('Year-round'))
        return 100;
    return crop.suitableSeasons.includes(season) ? 100 : 10;
}
function scoreClimate(crop, rainfall, temperature) {
    let score = 100;
    if (rainfall !== undefined) {
        if (rainfall < crop.minRainfall || rainfall > crop.maxRainfall) {
            score -= 40;
        }
    }
    if (temperature !== undefined) {
        if (temperature < crop.minTemperature || temperature > crop.maxTemperature) {
            score -= 40;
        }
    }
    return Math.max(0, score);
}
function scoreBudget(crop, budget) {
    if (crop.cultivationCost <= budget)
        return 100;
    const excess = (crop.cultivationCost - budget) / crop.cultivationCost;
    return Math.max(0, 100 - excess * 100);
}
function computeSuitability(crop, req) {
    const soil = scoreSoil(crop, req.soilType);
    const ph = scorePH(crop, req.soilPH);
    const water = scoreWater(crop, req.waterAvailability);
    const season = scoreSeason(crop, req.season);
    const climate = scoreClimate(crop, req.rainfall, req.averageTemperature);
    const budget = scoreBudget(crop, req.budget);
    return (soil * WEIGHTS.soilMatch +
        ph * WEIGHTS.phMatch +
        water * WEIGHTS.waterMatch +
        season * WEIGHTS.seasonMatch +
        climate * WEIGHTS.climateMatch +
        budget * WEIGHTS.budgetMatch);
}
function cropToRecommendationItem(crop, score) {
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
async function runRecommendationEngine(req) {
    const crops = await CropKnowledgeBase_1.CropKnowledgeBase.find({});
    const scored = crops
        .map((crop) => ({ crop, score: computeSuitability(crop, req) }))
        .filter(({ score }) => score >= MIN_SUITABILITY)
        .sort((a, b) => b.score - a.score);
    const recommendations = scored.map(({ crop, score }) => cropToRecommendationItem(crop, score));
    const hasHighScore = recommendations.length > 0;
    return { recommendations, hasHighScore };
}
//# sourceMappingURL=recommendationEngine.js.map