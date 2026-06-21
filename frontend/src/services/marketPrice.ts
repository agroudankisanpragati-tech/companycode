// Single centralized market price service
// Both Dashboard card and Market page use this — never call backend directly elsewhere.

const API = '/api/mandi';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Surface the real backend error — not a generic message
    const msg =
      json?.error ||
      json?.message ||
      json?.details ||
      `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data: json });
  }
  return json;
}

export interface MarketPreference {
  selectedCrop: string;
  selectedDistrict: string;
  selectedState: string;
  updatedAt?: string;
}

export interface CurrentMarketPrice {
  commodity: string;
  market: string;
  district: string;
  state: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  arrivalDate: string;
  searchLevel: 'district' | 'state' | 'india';
}

export interface PriceHistoryPoint {
  cropName: string;
  district: string;
  state: string;
  market: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  date: string;
}

export interface MarketCurrentResponse {
  success: boolean;
  data: CurrentMarketPrice | null;
  locationMissing?: boolean;
  message?: string;
}

export const marketService = {
  getPreference: () =>
    request<{ success: boolean; data: MarketPreference }>('/preference'),

  updatePreference: (update: Partial<MarketPreference>) =>
    request<{ success: boolean; data: MarketPreference }>('/preference', {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  getCurrentPrice: () =>
    request<MarketCurrentResponse>('/current'),

  getHistory: (crop?: string) =>
    request<{ success: boolean; data: PriceHistoryPoint[] }>(
      `/history${crop ? `?crop=${encodeURIComponent(crop)}` : ''}`
    ),
};

export const SUPPORTED_CROPS = [
  'Wheat', 'Rice', 'Mustard', 'Cotton', 'Gram', 'Soybean',
  'Maize', 'Bajra', 'Groundnut', 'Onion', 'Tomato', 'Potato',
  'Turmeric', 'Sugarcane', 'Jowar',
];
