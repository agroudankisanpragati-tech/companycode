import { IRecommendationItem } from './recommendationEngine';

export interface IFarmerConditions {
  soilType: string;
  soilPH: number;
  waterAvailability: string;
  season: string;
  district: string;
  state: string;
  farmArea: number;
  budget: number;
  farmingType: string;
  rainfall?: number;
  averageTemperature?: number;
}

const getApiUrl = () => `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  'HTTP-Referer': 'http://localhost:3000',
  'X-Title': 'Kisan Pragati',
});

function buildPrompt(conditions: IFarmerConditions): string {
  return `You are an expert agricultural scientist and agribusiness consultant for India.

Based on the farmer's conditions below, recommend:
1. Two Medicinal Crops
2. Two Fruit Crops
3. Three Traditional Crops

Farmer Conditions:
- Soil Type: ${conditions.soilType}
- Soil pH: ${conditions.soilPH}
- Water Availability: ${conditions.waterAvailability}
- Season: ${conditions.season}
- District: ${conditions.district}, ${conditions.state}
- Farm Area: ${conditions.farmArea} acres
- Budget: ₹${conditions.budget}
- Farming Type: ${conditions.farmingType}
${conditions.rainfall ? `- Rainfall: ${conditions.rainfall} mm` : ''}
${conditions.averageTemperature ? `- Average Temperature: ${conditions.averageTemperature}°C` : ''}

For each crop provide ALL of these fields:
- cropName
- cropNameHindi (हिंदी में फसल का नाम)
- cropCategory (Medicinal / Fruit / Traditional)
- suitabilityScore (0-100 integer)
- whySuitable (2-3 sentences explaining fit)
- whySuitableHindi (हिंدी में)
- waterRequirement (low/medium/high)
- estimatedCultivationCost (INR per acre, integer)
- estimatedYield (e.g. "8 quintal/acre")
- estimatedYieldHindi (हिंدी में)
- expectedRevenue (INR per acre, integer)
- expectedProfit (INR per acre, integer)
- marketDemand (low/medium/high)
- marketDemandHindi (कम / मध्यम / अधिक)
- currentMarketPrice (INR per quintal, integer)
- risks (1-2 sentences about key risks)
- risksHindi (हिंدी में)
- riskLevel (low/medium/high)
- cultivationGuide (numbered step-by-step, concise, 6-8 steps)
- cultivationGuideHindi (हिंدी में)
- growingDuration (days, integer)
- bestSowingTime (e.g. "June-July")
- bestSowingTimeHindi (हिंدी में)
- fertilizerRequirement (e.g. "DAP 50kg + Urea 30kg per acre")
- fertilizerCost (INR per acre, integer)
- seedRequirement (e.g. "8 kg per acre")
- recommendedSeedVariety (e.g. "HD-2967" or "Local variety")

Return JSON only. Format:
{
  "recommendations": [
    { "cropName": "...", "cropCategory": "...", "suitabilityScore": 85, "whySuitable": "...", "waterRequirement": "medium", "estimatedCultivationCost": 20000, "estimatedYield": "18 quintal/acre", "expectedRevenue": 39600, "expectedProfit": 18000, "marketDemand": "high", "currentMarketPrice": 2200, "risks": "...", "riskLevel": "low", "cultivationGuide": "1. ...", "growingDuration": 120, "fertilizerRequirement": "...", "fertilizerCost": 4500, "seedRequirement": "...", "recommendedSeedVariety": "..." }
  ]
}`;
}

export async function callOpenAIForCrops(conditions: IFarmerConditions): Promise<IRecommendationItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(conditions) }],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    let errMsg = errText;
    try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch {}
    throw new Error(`AI API error: ${errMsg}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');

  const parsed = JSON.parse(content);
  const recommendations: IRecommendationItem[] = (parsed.recommendations || []).map((item: any) => ({
    cropName: item.cropName || '',
    cropNameHindi: item.cropNameHindi || '',
    cropCategory: item.cropCategory || 'Traditional',
    suitabilityScore: Number(item.suitabilityScore) || 75,
    whySuitable: item.whySuitable || '',
    whySuitableHindi: item.whySuitableHindi || '',
    waterRequirement: item.waterRequirement || 'medium',
    estimatedCultivationCost: Number(item.estimatedCultivationCost) || 0,
    estimatedYield: item.estimatedYield || '',
    estimatedYieldHindi: item.estimatedYieldHindi || '',
    expectedRevenue: Number(item.expectedRevenue) || 0,
    expectedProfit: Number(item.expectedProfit) || 0,
    marketDemand: item.marketDemand || 'medium',
    marketDemandHindi: item.marketDemandHindi || '',
    risks: item.risks || '',
    risksHindi: item.risksHindi || '',
    cultivationGuide: item.cultivationGuide || '',
    cultivationGuideHindi: item.cultivationGuideHindi || '',
    growingDuration: Number(item.growingDuration) || 0,
    bestSowingTime: item.bestSowingTime || '',
    bestSowingTimeHindi: item.bestSowingTimeHindi || '',
    riskLevel: item.riskLevel || 'medium',
    currentMarketPrice: item.currentMarketPrice ? Number(item.currentMarketPrice) : undefined,
    fertilizerRequirement: item.fertilizerRequirement || undefined,
    fertilizerCost: item.fertilizerCost ? Number(item.fertilizerCost) : undefined,
    seedRequirement: item.seedRequirement || undefined,
    recommendedSeedVariety: item.recommendedSeedVariety || undefined,
  }));

  return recommendations;
}
