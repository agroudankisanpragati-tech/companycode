/**
 * LocationService — centralized location + KVK coordination layer.
 *
 * Responsibilities:
 *  - Geocode an address string via backend (keeps API key server-side)
 *  - Reverse-geocode GPS coordinates via backend
 *  - Emit 'farmer-address-changed' so all subscribers (KVK widget, weather, etc.) refresh
 *  - Provide haversine distance calculation on the client (offline-safe)
 *  - Build Google Maps URLs without exposing the API key in source
 */

export interface Coords {
  latitude: number;
  longitude: number;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/** Geocode an address string → coordinates (via backend, API key stays server-side). */
export async function geocodeAddress(address: string): Promise<Coords | null> {
  if (!address?.trim()) return null;
  try {
    const res = await fetch('/api/kvk/geocode', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ address }),
    });
    const json = await res.json();
    if (json.success && json.data) return json.data as Coords;
    return null;
  } catch {
    return null;
  }
}

/** Reverse-geocode GPS coords using OpenStreetMap Nominatim (free, no key). */
export async function reverseGeocode(lat: number, lon: number): Promise<{
  state: string; district: string; village: string;
} | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address || {};
    return {
      state: a.state || a.state_district || '',
      district: a.county || a.state_district || a.district || a.city || '',
      village: a.village || a.town || a.suburb || a.city_district || '',
    };
  } catch {
    return null;
  }
}

/** Client-side Haversine distance in km (works fully offline). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Build Google Maps navigation URL (no API key needed for directions link). */
export function mapsNavUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Build Google Maps embed URL using env key — never hardcoded. */
export function mapsEmbedUrl(lat: number, lng: number, zoom = 14): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!key || key.includes('DUMMY')) {
    // Fallback: OpenStreetMap iframe (no key required)
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}&layer=mapnik&marker=${lat},${lng}`;
  }
  return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=${zoom}`;
}

/** Build Google Maps search URL for an address string. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Dispatch the global address-changed event so all subscribers auto-refresh. */
export function notifyAddressChanged(payload: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('farmer-address-changed', { detail: payload }));
}
