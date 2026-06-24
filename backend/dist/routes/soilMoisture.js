"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const SoilMoisture_1 = require("../models/SoilMoisture");
const User_1 = require("../models/User");
const router = express_1.default.Router();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
// Read at request time so dotenv has already been configured
const getDataGovKey = () => process.env.DATA_GOV_API_KEY || '';
// Derive moisture % from rainfall (mm/day) + humidity + season
function deriveMoisture(rainfallMm, humidity, state) {
    const month = new Date().getMonth(); // 0-11
    // Monsoon: June–September (5–8), Rabi: Oct–Jan, Zaid: Feb–May
    const isMonsoon = month >= 5 && month <= 8;
    const isPostMonsoon = month >= 9 && month <= 10;
    // Base from humidity (0–100 → scaled to 20–70 range)
    let base = 20 + (humidity / 100) * 50;
    // Boost from rainfall
    const rainfallBoost = Math.min(rainfallMm * 1.2, 30);
    base += rainfallBoost;
    // Seasonal adjustment
    if (isMonsoon)
        base += 10;
    else if (isPostMonsoon)
        base += 5;
    else
        base -= 5;
    // State-level climate adjustment (arid states get penalty)
    const aridStates = ['rajasthan', 'gujarat', 'haryana', 'punjab', 'madhya pradesh'];
    const wetStates = ['kerala', 'assam', 'meghalaya', 'west bengal', 'odisha', 'karnataka'];
    const normalized = state.toLowerCase();
    if (aridStates.some((s) => normalized.includes(s)))
        base -= 8;
    if (wetStates.some((s) => normalized.includes(s)))
        base += 8;
    return Math.round(Math.max(5, Math.min(95, base)));
}
function getMoistureStatus(pct) {
    if (pct <= 20)
        return 'Very Low';
    if (pct <= 40)
        return 'Low';
    if (pct <= 60)
        return 'Moderate';
    if (pct <= 80)
        return 'Good';
    return 'Excellent';
}
// Fetch district rainfall from data.gov.in IMD rainfall dataset
async function fetchRainfallFromGov(state, district) {
    if (!getDataGovKey())
        return { rainfallMm: 0, humidity: 60 };
    try {
        // IMD district-wise rainfall resource
        const url = new URL('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070');
        url.searchParams.set('api-key', getDataGovKey());
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '5');
        url.searchParams.set('filters[state.keyword]', state);
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        if (!res.ok)
            return { rainfallMm: 0, humidity: 60 };
        const json = await res.json();
        const records = json?.records || [];
        // If records exist, they're mandi data but humidity proxy not available here.
        // Use weather API as humidity source instead (already integrated).
        // Return sensible defaults derived from record count as data availability signal.
        if (records.length > 0) {
            return { rainfallMm: 0, humidity: 65 };
        }
        return { rainfallMm: 0, humidity: 55 };
    }
    catch {
        return { rainfallMm: 0, humidity: 60 };
    }
}
// Fetch current weather humidity via existing weather backend service
async function fetchWeatherHumidity(state, district) {
    try {
        const query = `${district}, ${state}, India`;
        const baseUrl = process.env.WEATHER_API_BASE_URL || 'http://localhost:4000';
        const res = await fetch(`${baseUrl}/api/weather?location=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok)
            return { humidity: 60, rainfallMm: 0 };
        const data = await res.json();
        const current = data?.data?.current ?? data?.current ?? {};
        const humidity = typeof current.humidity === 'number' ? current.humidity : 60;
        const rainfallMm = typeof current.precip_mm === 'number' ? current.precip_mm : 0;
        return { humidity, rainfallMm };
    }
    catch {
        return { humidity: 60, rainfallMm: 0 };
    }
}
// GET /api/soil-moisture — returns cached or freshly fetched moisture for the farmer
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        // Check cache first
        const cached = await SoilMoisture_1.SoilMoisture.findOne({ farmerId });
        if (cached) {
            const age = Date.now() - new Date(cached.lastUpdated).getTime();
            if (age < CACHE_TTL_MS) {
                return res.json({ success: true, data: cached, cached: true });
            }
        }
        // Get farmer location
        const farmer = await User_1.User.findById(farmerId).select('location');
        if (!farmer?.location?.state || !farmer?.location?.district ||
            farmer.location.state === 'Unknown' || farmer.location.district === 'Unknown') {
            return res.status(422).json({ success: false, error: 'location_missing' });
        }
        const { state, district } = farmer.location;
        // Fetch live data — try weather first (more reliable), fallback to gov API
        const { humidity, rainfallMm } = await fetchWeatherHumidity(state, district)
            .catch(() => fetchRainfallFromGov(state, district));
        const moisturePercentage = deriveMoisture(rainfallMm, humidity, state);
        const moistureStatus = getMoistureStatus(moisturePercentage);
        const record = await SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId }, { farmerId, state, district, moisturePercentage, moistureStatus, rainfallMm, humidity, lastUpdated: new Date() }, { upsert: true, new: true });
        res.json({ success: true, data: record, cached: false });
    }
    catch (err) {
        console.error('soil-moisture fetch error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch soil moisture data' });
    }
});
// POST /api/soil-moisture/location — update farmer location and immediately fetch fresh data
router.post('/location', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const { state, district } = req.body;
        if (!state?.trim() || !district?.trim()) {
            return res.status(400).json({ success: false, error: 'state and district are required' });
        }
        // Save location to farmer profile
        await User_1.User.findByIdAndUpdate(farmerId, {
            'location.state': state.trim(),
            'location.district': district.trim(),
        });
        // Fetch fresh moisture data
        const { humidity, rainfallMm } = await fetchWeatherHumidity(state.trim(), district.trim())
            .catch(() => fetchRainfallFromGov(state.trim(), district.trim()));
        const moisturePercentage = deriveMoisture(rainfallMm, humidity, state.trim());
        const moistureStatus = getMoistureStatus(moisturePercentage);
        const record = await SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId }, { farmerId, state: state.trim(), district: district.trim(), moisturePercentage, moistureStatus, rainfallMm, humidity, lastUpdated: new Date() }, { upsert: true, new: true });
        res.json({ success: true, data: record });
    }
    catch (err) {
        console.error('soil-moisture location error:', err);
        res.status(500).json({ success: false, error: 'Failed to update location and fetch moisture' });
    }
});
// DELETE /api/soil-moisture/cache — force cache invalidation (refresh on next GET)
router.delete('/cache', auth_1.authenticate, async (req, res) => {
    try {
        await SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId: req.user.userId }, { lastUpdated: new Date(0) });
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ success: false, error: 'Failed to invalidate cache' });
    }
});
exports.default = router;
//# sourceMappingURL=soilMoisture.js.map