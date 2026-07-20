import { IKVK } from '../models/KVK';
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface KVKWithDistance {
    kvk: IKVK;
    distanceKm: number;
}
/** Haversine formula — returns distance in km between two lat/lng points */
export declare function haversineKm(a: Coordinates, b: Coordinates): number;
/** Geocode an address string → coordinates using Google Geocoding API.
 *  Returns null if API key is missing or request fails (graceful degradation). */
export declare function geocodeAddress(address: string): Promise<Coordinates | null>;
/** Find nearest KVKs sorted by distance.
 *  Works entirely from MongoDB — no Google dependency at query time. */
export declare function findNearestKVKs(farmerCoords: Coordinates, limit?: number): Promise<KVKWithDistance[]>;
/** Build a full address string from farmer profile fields for geocoding */
export declare function buildAddressString(fields: {
    address?: string;
    village?: string;
    district?: string;
    state?: string;
    pincode?: string;
}): string;
//# sourceMappingURL=kvkService.d.ts.map