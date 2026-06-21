function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SoilMoistureData {
  _id: string;
  farmerId: string;
  state: string;
  district: string;
  moisturePercentage: number;
  moistureStatus: string;
  rainfallMm?: number;
  humidity?: number;
  lastUpdated: string;
}

export async function getSoilMoisture(): Promise<{ success: boolean; data: SoilMoistureData; cached: boolean }> {
  const res = await fetch('/api/soil-moisture', { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error || 'Failed'), { status: res.status });
  return json;
}

export async function saveSoilMoistureLocation(
  state: string,
  district: string
): Promise<{ success: boolean; data: SoilMoistureData }> {
  const res = await fetch('/api/soil-moisture/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ state, district }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save location');
  return json;
}

export async function refreshSoilMoisture(): Promise<{ success: boolean; data: SoilMoistureData; cached: boolean }> {
  // Invalidate cache then re-fetch
  await fetch('/api/soil-moisture/cache', { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  return getSoilMoisture();
}
