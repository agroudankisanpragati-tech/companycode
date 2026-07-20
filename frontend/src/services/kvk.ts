function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export interface KVKCenter {
  _id: string;
  name: string;
  address: string;
  village?: string;
  district: string;
  state: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  altPhone?: string;
  email?: string;
  website?: string;
  officeTimings?: string;
  servicesOffered?: string[];
  notes?: string;
  photoUrl?: string;
  isActive: boolean;
  distanceKm?: number;
}

export interface NearestKVKResponse {
  success: boolean;
  data: KVKCenter[];
  nearest?: KVKCenter;
  coords?: { latitude: number; longitude: number };
  message?: string;
}

export interface AddressPayload {
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

/** Fetch nearest KVK centers. Optionally pass address fields to override profile address. */
export async function fetchNearestKVK(payload: AddressPayload = {}): Promise<NearestKVKResponse> {
  const res = await fetch('/api/kvk/nearest', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch nearest KVK');
  return json;
}

/** Geocode an address string to coordinates via backend (keeps API key server-side). */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch('/api/kvk/geocode', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ address }),
    });
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch {
    return null;
  }
}

/** Build Google Maps navigation URL */
export function mapsNavUrl(kvk: KVKCenter): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${kvk.latitude},${kvk.longitude}`;
}

/** Build Google Maps static embed URL (no API key needed for basic link) */
export function mapsEmbedUrl(kvk: KVKCenter): string {
  return `https://maps.google.com/?q=${kvk.latitude},${kvk.longitude}`;
}
