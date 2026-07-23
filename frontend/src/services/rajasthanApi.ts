const API_BASE = '/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type GovtScheme = {
  _id: string;
  title: string;
  summary: string;
  state?: string;
  coverImage?: string;
  status?: string;
};

export type RajasthanProfile = {
  user: {
    name: string;
    email: string;
    phone?: string;
    location?: {
      state?: string;
      district?: string;
      village?: string;
    };
  };
  ext: {
    farmSize?: number;
    soilType?: string;
    waterSource?: string;
    district?: string;
    state?: string;
  };
};

export type RajasthanAIContext = {
  farmer: { name: string; location?: { state?: string; district?: string } } | null;
  soilMoisture: { percentage?: number; status?: string } | null;
  weather: { temp?: number; humidity?: number; condition?: string; wind?: number; precip?: number } | null;
};

export async function fetchRajasthanSchemes(): Promise<GovtScheme[]> {
  const response = await fetch(`${API_BASE}/schemes?status=published&schemeType=state&state=Rajasthan&limit=10`, {
    cache: 'no-store',
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error((payload as any)?.error || 'Unable to load Rajasthan schemes');
  return (payload as any)?.data || [];
}

export async function fetchRajasthanProfile(): Promise<RajasthanProfile> {
  const response = await fetch(`${API_BASE}/farmer-profile`, {
    headers: authHeaders(),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error((payload as any)?.error || 'Unable to load profile');
  return (payload as any)?.data;
}

export async function fetchRajasthanAIContext(): Promise<RajasthanAIContext> {
  const response = await fetch(`${API_BASE}/ai-assistant/dashboard-context`, {
    headers: authHeaders(),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error((payload as any)?.error || 'Unable to load assistant context');
  return (payload as any)?.data;
}
