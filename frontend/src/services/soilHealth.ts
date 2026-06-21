const API_BASE = '/api/soil';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SoilReport {
  _id: string;
  farmerId: string;
  reportUrl?: string;
  uploadDate: string;
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
  soilHealthScore?: number;
  soilHealthStatus?: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
  deficiencies?: Array<{
    nutrient: string;
    type: 'Low' | 'Excess' | 'Imbalance';
    severity: 'Low' | 'Medium' | 'High';
    description: string;
  }>;
  benchmarkComparison?: Array<{
    parameter: string;
    farmerValue: number | string;
    idealValue: string;
    status: 'Optimal' | 'Low' | 'High' | 'Deficient';
  }>;
  recommendations?: {
    organic: string[];
    fertilizer: string[];
    reasoning: string;
  };
  cropRecommendations?: Array<{
    cropName: string;
    suitabilityScore: number;
    expectedBenefits: string;
    reason: string;
  }>;
  aiAnalysis?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoilHistoryItem {
  _id: string;
  uploadDate: string;
  soilType?: string;
  soilHealthScore?: number;
  soilHealthStatus?: string;
  reportUrl?: string;
  createdAt: string;
}

export async function uploadSoilReport(file: File, onProgress?: (stage: string) => void): Promise<{ success: boolean; data: SoilReport }> {
  onProgress?.('Uploading Report');
  const formData = new FormData();
  formData.append('report', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function analyzeSoilData(soilData: {
  soilType?: string;
  pH: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organicCarbon?: number;
  ec?: number;
}): Promise<{ success: boolean; data: SoilReport }> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(soilData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}

export async function getSoilReport(id: string): Promise<{ success: boolean; data: SoilReport }> {
  const res = await fetch(`${API_BASE}/${id}`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
  return data;
}

export async function getSoilHistory(): Promise<{ success: boolean; data: SoilHistoryItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/history`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
  return data;
}

export async function deleteSoilReport(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete report');
  return data;
}

export async function getCropRecommendations(reportId: string): Promise<{ success: boolean; data: SoilReport['cropRecommendations'] }> {
  const res = await fetch(`${API_BASE}/crops/${reportId}`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch crop recommendations');
  return data;
}
