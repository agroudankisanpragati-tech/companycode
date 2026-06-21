// All calls go to /api/* which Next.js rewrites to http://localhost:5000/api/*
// This avoids CORS issues since browser stays on localhost:3000
const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function safeFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response — is backend running on port 5000?');
  }
  if (text.trimStart().startsWith('<')) {
    throw new Error('Backend not reachable — restart backend on port 5000.');
  }
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error('Invalid response from server.');
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export interface MyCropEntry {
  _id: string;
  cropName: string;
  image?: string;
  category: string;
  description?: string;
  cultivationGuide?: string;
  suitabilityScore: number;
  estimatedYield?: string;
  estimatedCultivationCost?: number;
  expectedRevenue?: number;
  expectedProfit?: number;
  waterRequirement?: string;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  currentMarketPrice?: number;
  marketDemand?: string;
  riskLevel?: string;
  recommendationSource?: string;
  dateAdded: string;
  createdAt: string;
  status?: string;
}

export interface AddMyCropPayload {
  cropName: string;
  image?: string;
  category: string;
  description?: string;
  cultivationGuide?: string;
  suitabilityScore: number;
  estimatedYield?: string;
  estimatedCultivationCost?: number;
  expectedRevenue?: number;
  expectedProfit?: number;
  waterRequirement?: string;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  currentMarketPrice?: number;
  marketDemand?: string;
  riskLevel?: string;
  recommendationSource?: string;
}

export async function addMyCrop(payload: AddMyCropPayload): Promise<MyCropEntry> {
  const json = await safeFetch(`${API_BASE}/my-crops`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function getMyCrops(): Promise<MyCropEntry[]> {
  const json = await safeFetch(`${API_BASE}/my-crops`, { headers: authHeaders() });
  return json.data;
}

export async function getMyCropById(id: string): Promise<MyCropEntry> {
  const json = await safeFetch(`${API_BASE}/my-crops/${id}`, { headers: authHeaders() });
  return json.data;
}

export async function deleteMyCrop(id: string): Promise<void> {
  await safeFetch(`${API_BASE}/my-crops/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}
