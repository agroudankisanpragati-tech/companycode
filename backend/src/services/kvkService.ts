import axios from 'axios';
import { KVK, IKVK } from '../models/KVK';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface KVKWithDistance {
  kvk: IKVK;
  distanceKm: number;
}

/** Haversine formula — returns distance in km between two lat/lng points */
export function haversineKm(a: Coordinates, b: Coordinates): number {
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

/** Geocode an address string → coordinates using Google Geocoding API.
 *  Returns null if API key is missing or request fails (graceful degradation). */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address?.trim()) return null;

  try {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const { data } = await axios.get(url, {
      params: { address: `${address}, India`, key: apiKey },
      timeout: 5000,
    });
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      return { latitude: lat, longitude: lng };
    }
    return null;
  } catch {
    return null;
  }
}

/** Find nearest KVKs sorted by distance.
 *  Works entirely from MongoDB — no Google dependency at query time. */
export async function findNearestKVKs(
  farmerCoords: Coordinates,
  limit = 10
): Promise<KVKWithDistance[]> {
  const kvks = await KVK.find({ isActive: true }).lean();
  return kvks
    .map(kvk => ({
      kvk: kvk as unknown as IKVK,
      distanceKm: haversineKm(farmerCoords, { latitude: kvk.latitude, longitude: kvk.longitude }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Build a full address string from farmer profile fields for geocoding */
export function buildAddressString(fields: {
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
}): string {
  return [fields.address, fields.village, fields.district, fields.state, fields.pincode]
    .filter(Boolean)
    .join(', ');
}
