const API_BASE = '/api/fertilizer-calculator';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type AreaUnit = 'bigha' | 'acre' | 'hectare' | 'guntha' | 'katha';

export interface CropMeta { key: string; label: string; labelHi: string }
export interface AreaUnitMeta { value: AreaUnit; label: string; labelHi: string }

export interface OrganicOption {
  name: string; nameHi: string; quantity: string;
  benefit: string; benefitHi: string; priority: number;
}
export interface ChemicalFertilizer {
  name: string; nameHi: string; npkRatio: string;
  quantityKg: number; quantityPerUnit: string;
  nutrientProvided: string; applicationTime: string;
  applicationTimeHi: string; costEstimate: string;
}
export interface FertilizerResult {
  crop: string; cropHi: string;
  areaHectares: number; areaDisplay: string;
  requiredN: number; requiredP: number; requiredK: number;
  deficitN: number; deficitP: number; deficitK: number;
  organicFirst: OrganicOption[];
  chemicalFertilizers: ChemicalFertilizer[];
  applicationSchedule: { stage: string; stageHi: string; products: string }[];
  totalCostMin: number; totalCostMax: number;
  soilUsed: boolean; tips: string[]; tipsHi: string[];
}

export interface SoilReportSummary {
  _id: string; soilType?: string; soilHealthScore?: number;
  soilHealthStatus?: string; createdAt: string;
  nitrogen?: number; phosphorus?: number; potassium?: number;
}

export async function fetchMeta(): Promise<{ crops: CropMeta[]; areaUnits: AreaUnitMeta[] }> {
  const res = await fetch(`${API_BASE}/meta`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load meta');
  return json;
}

export async function fetchSoilReports(): Promise<SoilReportSummary[]> {
  const res = await fetch(`${API_BASE}/soil-reports`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load soil reports');
  return json.data;
}

export async function calculateFertilizer(payload: {
  crop: string; areaValue: number; areaUnit: AreaUnit; soilReportId?: string;
}): Promise<FertilizerResult> {
  const res = await fetch(`${API_BASE}/calculate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Calculation failed');
  return json.data;
}
