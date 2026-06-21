import { ISoilReport } from '../models/SoilReport';
import { ISoilStandard } from '../models/SoilStandard';

const getApiUrl = () => `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  'HTTP-Referer': 'http://localhost:3000',
  'X-Title': 'Kisan Pragati',
});

export interface SoilAnalysisInput {
  soilType?: string;
  pH?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  organicCarbon?: number;
  ec?: number;
  micronutrients?: {
    zinc?: number;
    iron?: number;
    manganese?: number;
    copper?: number;
    boron?: number;
  };
}

export interface SoilAIResult {
  soilType: string;
  pH: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organicCarbon: number;
  ec: number;
  micronutrients: {
    zinc?: number;
    iron?: number;
    manganese?: number;
    copper?: number;
    boron?: number;
  };
  soilHealthScore: number;
  soilHealthStatus: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
  deficiencies: Array<{
    nutrient: string;
    type: 'Low' | 'Excess' | 'Imbalance';
    severity: 'Low' | 'Medium' | 'High';
    description: string;
  }>;
  benchmarkComparison: Array<{
    parameter: string;
    farmerValue: number | string;
    idealValue: string;
    status: 'Optimal' | 'Low' | 'High' | 'Deficient';
  }>;
  recommendations: {
    organic: string[];
    fertilizer: string[];
    reasoning: string;
  };
  cropRecommendations: Array<{
    cropName: string;
    suitabilityScore: number;
    expectedBenefits: string;
    reason: string;
  }>;
  aiAnalysis: string;
}

// Calculate soil health score from extracted data and benchmark
export function calculateSoilHealthScore(
  data: SoilAnalysisInput,
  standard: ISoilStandard
): { score: number; status: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical' } {
  const weights = { pH: 20, nitrogen: 20, phosphorus: 15, potassium: 15, organicCarbon: 20, ec: 10 };
  let totalScore = 0;

  const scoreParam = (value: number | undefined, min: number, max: number): number => {
    if (value === undefined || value === null) return 50; // neutral if missing
    if (value >= min && value <= max) return 100;
    const range = max - min;
    if (value < min) return Math.max(0, 100 - ((min - value) / range) * 100);
    return Math.max(0, 100 - ((value - max) / range) * 100);
  };

  totalScore += scoreParam(data.pH, standard.pH.min, standard.pH.max) * (weights.pH / 100);
  totalScore += scoreParam(data.nitrogen, standard.nitrogen.min, standard.nitrogen.max) * (weights.nitrogen / 100);
  totalScore += scoreParam(data.phosphorus, standard.phosphorus.min, standard.phosphorus.max) * (weights.phosphorus / 100);
  totalScore += scoreParam(data.potassium, standard.potassium.min, standard.potassium.max) * (weights.potassium / 100);
  totalScore += scoreParam(data.organicCarbon, standard.organicCarbon.min, standard.organicCarbon.max) * (weights.organicCarbon / 100);
  totalScore += scoreParam(data.ec, standard.ec.min, standard.ec.max) * (weights.ec / 100);

  const score = Math.round(totalScore);
  let status: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
  if (score >= 80) status = 'Excellent';
  else if (score >= 65) status = 'Good';
  else if (score >= 50) status = 'Moderate';
  else if (score >= 30) status = 'Poor';
  else status = 'Critical';

  return { score, status };
}

// Build benchmark comparison table
export function buildBenchmarkComparison(
  data: SoilAnalysisInput,
  standard: ISoilStandard
): Array<{ parameter: string; farmerValue: number | string; idealValue: string; status: 'Optimal' | 'Low' | 'High' | 'Deficient' }> {
  const comparisons: Array<{ parameter: string; farmerValue: number | string; idealValue: string; status: 'Optimal' | 'Low' | 'High' | 'Deficient' }> = [];

  const getStatus = (value: number | undefined, min: number, max: number): 'Optimal' | 'Low' | 'High' | 'Deficient' => {
    if (value === undefined) return 'Deficient';
    if (value >= min && value <= max) return 'Optimal';
    if (value < min * 0.5) return 'Deficient';
    if (value < min) return 'Low';
    return 'High';
  };

  comparisons.push({ parameter: 'pH', farmerValue: data.pH ?? 'N/A', idealValue: standard.pH.ideal, status: getStatus(data.pH, standard.pH.min, standard.pH.max) });
  comparisons.push({ parameter: 'Nitrogen (N)', farmerValue: data.nitrogen ? `${data.nitrogen} kg/ha` : 'N/A', idealValue: standard.nitrogen.ideal, status: getStatus(data.nitrogen, standard.nitrogen.min, standard.nitrogen.max) });
  comparisons.push({ parameter: 'Phosphorus (P)', farmerValue: data.phosphorus ? `${data.phosphorus} kg/ha` : 'N/A', idealValue: standard.phosphorus.ideal, status: getStatus(data.phosphorus, standard.phosphorus.min, standard.phosphorus.max) });
  comparisons.push({ parameter: 'Potassium (K)', farmerValue: data.potassium ? `${data.potassium} kg/ha` : 'N/A', idealValue: standard.potassium.ideal, status: getStatus(data.potassium, standard.potassium.min, standard.potassium.max) });
  comparisons.push({ parameter: 'Organic Carbon', farmerValue: data.organicCarbon ? `${data.organicCarbon}%` : 'N/A', idealValue: standard.organicCarbon.ideal, status: getStatus(data.organicCarbon, standard.organicCarbon.min, standard.organicCarbon.max) });
  comparisons.push({ parameter: 'EC', farmerValue: data.ec ? `${data.ec} dS/m` : 'N/A', idealValue: standard.ec.ideal, status: getStatus(data.ec, standard.ec.min, standard.ec.max) });

  if (data.micronutrients) {
    if (data.micronutrients.zinc !== undefined) comparisons.push({ parameter: 'Zinc', farmerValue: `${data.micronutrients.zinc} mg/kg`, idealValue: standard.micronutrients.zinc.ideal, status: getStatus(data.micronutrients.zinc, standard.micronutrients.zinc.min, standard.micronutrients.zinc.max) });
    if (data.micronutrients.iron !== undefined) comparisons.push({ parameter: 'Iron', farmerValue: `${data.micronutrients.iron} mg/kg`, idealValue: standard.micronutrients.iron.ideal, status: getStatus(data.micronutrients.iron, standard.micronutrients.iron.min, standard.micronutrients.iron.max) });
  }

  return comparisons;
}

// Build deficiency list
export function detectDeficiencies(
  data: SoilAnalysisInput,
  standard: ISoilStandard
): Array<{ nutrient: string; type: 'Low' | 'Excess' | 'Imbalance'; severity: 'Low' | 'Medium' | 'High'; description: string }> {
  const deficiencies: Array<{ nutrient: string; type: 'Low' | 'Excess' | 'Imbalance'; severity: 'Low' | 'Medium' | 'High'; description: string }> = [];

  const check = (name: string, value: number | undefined, min: number, max: number, unit: string) => {
    if (value === undefined) return;
    if (value < min) {
      const gap = ((min - value) / min) * 100;
      const severity: 'Low' | 'Medium' | 'High' = gap > 50 ? 'High' : gap > 25 ? 'Medium' : 'Low';
      deficiencies.push({ nutrient: name, type: 'Low', severity, description: `${name} is ${value}${unit}, below ideal range of ${min}–${max}${unit}. This may reduce crop yield.` });
    } else if (value > max) {
      const gap = ((value - max) / max) * 100;
      const severity: 'Low' | 'Medium' | 'High' = gap > 50 ? 'High' : gap > 25 ? 'Medium' : 'Low';
      deficiencies.push({ nutrient: name, type: 'Excess', severity, description: `${name} is ${value}${unit}, above ideal range of ${min}–${max}${unit}. Excess may harm crop roots.` });
    }
  };

  check('pH', data.pH, standard.pH.min, standard.pH.max, '');
  check('Nitrogen', data.nitrogen, standard.nitrogen.min, standard.nitrogen.max, ' kg/ha');
  check('Phosphorus', data.phosphorus, standard.phosphorus.min, standard.phosphorus.max, ' kg/ha');
  check('Potassium', data.potassium, standard.potassium.min, standard.potassium.max, ' kg/ha');
  check('Organic Carbon', data.organicCarbon, standard.organicCarbon.min, standard.organicCarbon.max, '%');
  check('EC', data.ec, standard.ec.min, standard.ec.max, ' dS/m');

  if (data.micronutrients) {
    if (data.micronutrients.zinc !== undefined) check('Zinc', data.micronutrients.zinc, standard.micronutrients.zinc.min, standard.micronutrients.zinc.max, ' mg/kg');
    if (data.micronutrients.iron !== undefined) check('Iron', data.micronutrients.iron, standard.micronutrients.iron.min, standard.micronutrients.iron.max, ' mg/kg');
    if (data.micronutrients.boron !== undefined) check('Boron', data.micronutrients.boron, standard.micronutrients.boron.min, standard.micronutrients.boron.max, ' mg/kg');
  }

  return deficiencies;
}

// Call OpenAI to parse OCR text and extract structured soil data + generate AI insights
export async function extractAndAnalyzeSoilWithAI(
  ocrText: string,
  standard: ISoilStandard
): Promise<SoilAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const prompt = `You are an expert soil scientist and agricultural advisor for India.

You are given raw OCR text extracted from a farmer's soil test report. Your task:
1. Extract all soil parameters from the text
2. If a soil type is not mentioned, infer it from the values
3. Generate detailed AI analysis, recommendations, and crop suggestions

OCR Text from Soil Report:
"""
${ocrText}
"""

Standard Benchmark for Reference:
- Soil Type: ${standard.soilType}
- pH: ${standard.pH.ideal}
- Nitrogen: ${standard.nitrogen.ideal}
- Phosphorus: ${standard.phosphorus.ideal}
- Potassium: ${standard.potassium.ideal}
- Organic Carbon: ${standard.organicCarbon.ideal}
- EC: ${standard.ec.ideal}

Return ONLY valid JSON in this exact format:
{
  "soilType": "string (e.g. Alluvial, Black, Red, Loamy, Sandy, Clay, Laterite)",
  "pH": number,
  "nitrogen": number,
  "phosphorus": number,
  "potassium": number,
  "organicCarbon": number,
  "ec": number,
  "micronutrients": {
    "zinc": number or null,
    "iron": number or null,
    "manganese": number or null,
    "copper": number or null,
    "boron": number or null
  },
  "recommendations": {
    "organic": ["list of 3-5 organic recommendations like Compost, Vermicompost, Green Manure"],
    "fertilizer": ["list of 3-5 fertilizer recommendations like Urea 50kg/acre, DAP 25kg/acre"],
    "reasoning": "Detailed explanation of why these are recommended based on soil data"
  },
  "cropRecommendations": [
    {
      "cropName": "crop name",
      "suitabilityScore": 0-100,
      "expectedBenefits": "expected yield and benefit",
      "reason": "why this crop suits the soil"
    }
  ],
  "aiAnalysis": "A farmer-friendly, detailed paragraph (200-300 words) explaining the soil health, what is good, what needs attention, and what actions will improve productivity. Use simple language a farmer can understand."
}

Provide 6-8 crop recommendations. If OCR text has no useful data, use reasonable defaults for Indian agricultural soil.`;

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
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

  // Use extracted data to compute score, comparison, deficiencies
  const extractedData: SoilAnalysisInput = {
    soilType: parsed.soilType,
    pH: parsed.pH,
    nitrogen: parsed.nitrogen,
    phosphorus: parsed.phosphorus,
    potassium: parsed.potassium,
    organicCarbon: parsed.organicCarbon,
    ec: parsed.ec,
    micronutrients: {
      zinc: parsed.micronutrients?.zinc ?? undefined,
      iron: parsed.micronutrients?.iron ?? undefined,
      manganese: parsed.micronutrients?.manganese ?? undefined,
      copper: parsed.micronutrients?.copper ?? undefined,
      boron: parsed.micronutrients?.boron ?? undefined,
    },
  };

  // Find best matching standard for the detected soil type
  const { score, status } = calculateSoilHealthScore(extractedData, standard);
  const benchmarkComparison = buildBenchmarkComparison(extractedData, standard);
  const deficiencies = detectDeficiencies(extractedData, standard);

  return {
    soilType: parsed.soilType || standard.soilType,
    pH: parsed.pH || 7.0,
    nitrogen: parsed.nitrogen || 200,
    phosphorus: parsed.phosphorus || 10,
    potassium: parsed.potassium || 150,
    organicCarbon: parsed.organicCarbon || 0.5,
    ec: parsed.ec || 0.4,
    micronutrients: extractedData.micronutrients || {},
    soilHealthScore: score,
    soilHealthStatus: status,
    deficiencies,
    benchmarkComparison,
    recommendations: {
      organic: parsed.recommendations?.organic || ['Apply compost 5 tons/acre', 'Use vermicompost 2 tons/acre'],
      fertilizer: parsed.recommendations?.fertilizer || ['Apply Urea 50 kg/acre', 'Apply DAP 25 kg/acre'],
      reasoning: parsed.recommendations?.reasoning || 'Based on soil analysis, these amendments will improve soil fertility.',
    },
    cropRecommendations: (parsed.cropRecommendations || []).map((c: any) => ({
      cropName: c.cropName || '',
      suitabilityScore: Number(c.suitabilityScore) || 70,
      expectedBenefits: c.expectedBenefits || '',
      reason: c.reason || '',
    })),
    aiAnalysis: parsed.aiAnalysis || 'Soil analysis complete. Please refer to the recommendations section.',
  };
}

// Generate AI analysis when soil data is provided manually (no OCR)
export async function generateAIAnalysisFromData(
  data: SoilAnalysisInput,
  standard: ISoilStandard
): Promise<{ recommendations: { organic: string[]; fertilizer: string[]; reasoning: string }; cropRecommendations: Array<{ cropName: string; suitabilityScore: number; expectedBenefits: string; reason: string }>; aiAnalysis: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const prompt = `You are an expert soil scientist for India. Based on soil test data, generate recommendations.

Soil Data:
- Soil Type: ${data.soilType || 'Unknown'}
- pH: ${data.pH}
- Nitrogen: ${data.nitrogen} kg/ha
- Phosphorus: ${data.phosphorus} kg/ha
- Potassium: ${data.potassium} kg/ha
- Organic Carbon: ${data.organicCarbon}%
- EC: ${data.ec} dS/m

Benchmark for ${standard.soilType} soil:
- pH: ${standard.pH.ideal}, N: ${standard.nitrogen.ideal}, P: ${standard.phosphorus.ideal}, K: ${standard.potassium.ideal}, OC: ${standard.organicCarbon.ideal}, EC: ${standard.ec.ideal}

Return ONLY valid JSON:
{
  "recommendations": {
    "organic": ["3-5 organic amendment recommendations"],
    "fertilizer": ["3-5 fertilizer recommendations with quantities"],
    "reasoning": "detailed explanation"
  },
  "cropRecommendations": [
    {"cropName": "...", "suitabilityScore": 0-100, "expectedBenefits": "...", "reason": "..."}
  ],
  "aiAnalysis": "200-300 word farmer-friendly analysis"
}

Provide 6-8 crop recommendations.`;

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    let errMsg = errText;
    try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch {}
    throw new Error(`AI API error: ${errMsg}`);
  }

  const respData = await response.json() as any;
  const content = respData.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');
  return JSON.parse(content);
}
