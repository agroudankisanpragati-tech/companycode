export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface GovtScheme {
  _id: string;
  title: string;
  state?: string;
  summary: string;
  coverImage?: string;
  status?: string;
}

export async function fetchStateSchemes(state: string) {
  const url = `${API_BASE}/schemes?status=published&schemeType=state&state=${encodeURIComponent(state)}&limit=10`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch schemes: ${response.status} ${errorText}`);
  }
  const payload = await response.json();
  return payload.data as GovtScheme[];
}
