"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.geocodeAddress = geocodeAddress;
exports.findNearestKVKs = findNearestKVKs;
exports.buildAddressString = buildAddressString;
const axios_1 = __importDefault(require("axios"));
const KVK_1 = require("../models/KVK");
/** Haversine formula — returns distance in km between two lat/lng points */
function haversineKm(a, b) {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
}
/** Geocode an address string → coordinates using Google Geocoding API.
 *  Returns null if API key is missing or request fails (graceful degradation). */
async function geocodeAddress(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !address?.trim())
        return null;
    try {
        const url = 'https://maps.googleapis.com/maps/api/geocode/json';
        const { data } = await axios_1.default.get(url, {
            params: { address: `${address}, India`, key: apiKey },
            timeout: 5000,
        });
        if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
            const { lat, lng } = data.results[0].geometry.location;
            return { latitude: lat, longitude: lng };
        }
        return null;
    }
    catch {
        return null;
    }
}
/** Find nearest KVKs sorted by distance.
 *  Works entirely from MongoDB — no Google dependency at query time. */
async function findNearestKVKs(farmerCoords, limit = 10) {
    const kvks = await KVK_1.KVK.find({ isActive: true }).lean();
    return kvks
        .map(kvk => ({
        kvk: kvk,
        distanceKm: haversineKm(farmerCoords, { latitude: kvk.latitude, longitude: kvk.longitude }),
    }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);
}
/** Build a full address string from farmer profile fields for geocoding */
function buildAddressString(fields) {
    return [fields.address, fields.village, fields.district, fields.state, fields.pincode]
        .filter(Boolean)
        .join(', ');
}
//# sourceMappingURL=kvkService.js.map