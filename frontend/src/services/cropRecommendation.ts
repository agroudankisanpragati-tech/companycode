const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface CropRecommendationRequest {
  farmArea: number;
  areaUnit: string;
  state: string;
  district: string;
  village?: string;
  soilType: string;
  soilPH: number;
  organicCarbon?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ecValue?: number;
  waterAvailability: string;
  irrigationType: string;
  rainfall?: number;
  averageTemperature?: number;
  season: string;
  farmingType: string;
  budget: number;
  previousCrop?: string;
  preferredCrop?: string;
}

export interface RecommendationItem {
  cropName: string;
  cropCategory: string;
  suitabilityScore: number;
  whySuitable: string;
  description?: string;
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
  // Extended fields
  currentMarketPrice?: number;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  image?: string;
}

export interface RecommendationResponse {
  success: boolean;
  source: 'database' | 'openai';
  requestId: string;
  recommendationId?: string;
  similarityScore?: number;
  recommendations: RecommendationItem[];
  message: string;
}

export async function getCropRecommendations(data: CropRecommendationRequest): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/crop-recommendation`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to get recommendations');
  return json;
}

export async function getRecommendationHistory(page = 1, limit = 10) {
  const res = await fetch(`${API_BASE}/crop-recommendation/history?page=${page}&limit=${limit}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch history');
  return json;
}

export async function getRecommendationById(id: string) {
  const res = await fetch(`${API_BASE}/crop-recommendation/${id}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch recommendation');
  return json;
}

export async function submitFeedback(recommendationId: string, feedback: 'helpful' | 'not_helpful', feedbackNote?: string) {
  const res = await fetch(`${API_BASE}/crop-recommendation/feedback`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ recommendationId, feedback, feedbackNote }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to submit feedback');
  return json;
}
