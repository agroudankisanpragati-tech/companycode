function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface IrrigationLog {
  date: string;
  durationMinutes: number;
  method: string;
  aiDecision: string;
  soilMoistureAtTime: number;
  weatherCondition: string;
}

export interface IrrigationData {
  _id: string;
  farmerId: string;
  cropName: string;
  fieldName: string;
  irrigationMethod: 'drip' | 'sprinkler' | 'flood' | 'furrow';
  fieldAreaAcres: number;
  soilType: string;
  currentMoisture: number;
  moistureStatus: string;
  aiDecision: 'skip' | 'irrigate_now' | 'irrigate_tomorrow' | 'monitor';
  aiReason: string;
  aiReasonHindi: string;
  recommendedDurationMinutes: number;
  nextIrrigationDate: string | null;
  rainForecastMm: number;
  rainForecastDays: number;
  weatherCondition: string;
  temperature: number;
  humidity: number;
  alertSent: boolean;
  logs: IrrigationLog[];
  lastAnalyzed: string;
}

export async function getIrrigationSchedule(): Promise<{ success: boolean; data: IrrigationData; cached: boolean; urgency: string }> {
  const res = await fetch('/api/irrigation', { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error || 'Failed'), { status: res.status });
  return json;
}

export async function updateIrrigationSettings(settings: {
  cropName?: string;
  fieldName?: string;
  irrigationMethod?: string;
  fieldAreaAcres?: number;
  soilType?: string;
}): Promise<{ success: boolean; data: IrrigationData }> {
  const res = await fetch('/api/irrigation/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update settings');
  return json;
}

export async function logIrrigationSession(durationMinutes: number, method: string): Promise<{ success: boolean }> {
  const res = await fetch('/api/irrigation/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ durationMinutes, method }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to log');
  return json;
}

export async function refreshIrrigationSchedule(): Promise<{ success: boolean; data: IrrigationData; cached: boolean; urgency: string }> {
  await fetch('/api/irrigation/cache', { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  return getIrrigationSchedule();
}
