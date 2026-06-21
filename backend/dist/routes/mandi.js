"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../middleware/auth");
const FarmerMarketPreference_1 = require("../models/FarmerMarketPreference");
const MarketPriceHistory_1 = require("../models/MarketPriceHistory");
const User_1 = require("../models/User");
const router = express_1.default.Router();
const MANDI_API_BASE = 'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24';
// Read at request time — NOT at module load time (dotenv hasn't run yet when this file is imported)
const getApiKey = () => process.env.DATA_GOV_API_KEY || process.env.MANDI_API_KEY || '';
// BUG FIX 1: API returns numbers OR strings — handle both
function parsePrice(val) {
    if (val === undefined || val === null || val === '')
        return 0;
    if (typeof val === 'number')
        return val;
    return parseFloat(val) || 0;
}
// Historical dataset uses DD/MM/YYYY format
function normalizeDate(raw) {
    if (!raw)
        return todayStr();
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m)
        return `${m[3]}-${m[2]}-${m[1]}`;
    return raw;
}
function todayStr() {
    return new Date().toISOString().split('T')[0];
}
// Historical dataset uses PascalCase field names + sort[Arrival_Date]=desc for latest prices
async function fetchMandiData(commodity, extraFilters = {}) {
    const params = {
        'api-key': getApiKey(),
        format: 'json',
        limit: '50',
        'filters[Commodity]': commodity,
        'sort[Arrival_Date]': 'desc',
    };
    // PascalCase filter keys for this dataset
    for (const [k, v] of Object.entries(extraFilters)) {
        if (v)
            params[`filters[${k}]`] = v;
    }
    console.log(`[Mandi] Fetching → commodity="${commodity}"`, extraFilters);
    const response = await axios_1.default.get(MANDI_API_BASE, { params, timeout: 20000 });
    const records = response.data?.records || [];
    console.log(`[Mandi] Got ${records.length} records (total=${response.data?.total})`);
    if (records.length > 0)
        console.log(`[Mandi] Latest record →`, JSON.stringify(records[0]));
    return records;
}
// District → State → India fallback — use PascalCase filter keys
async function searchMandiWithFallback(commodity, district, state) {
    if (district && state) {
        console.log(`[Mandi] Level 1: district search → ${commodity} in ${district}, ${state}`);
        const records = await fetchMandiData(commodity, { State: state, District: district });
        if (records.length > 0)
            return { records, level: 'district' };
        console.log(`[Mandi] Level 1 empty → falling back to state`);
    }
    if (state) {
        console.log(`[Mandi] Level 2: state search → ${commodity} in ${state}`);
        const records = await fetchMandiData(commodity, { State: state });
        if (records.length > 0)
            return { records, level: 'state' };
        console.log(`[Mandi] Level 2 empty → falling back to India`);
    }
    console.log(`[Mandi] Level 3: India-wide search → ${commodity}`);
    const records = await fetchMandiData(commodity);
    return { records, level: 'india' };
}
async function pruneOldHistory(farmerId, cropName) {
    const all = await MarketPriceHistory_1.MarketPriceHistory.find({ farmerId, cropName })
        .sort({ date: -1 })
        .select('_id date');
    if (all.length > 20) {
        const toDelete = all.slice(20).map((r) => r._id);
        await MarketPriceHistory_1.MarketPriceHistory.deleteMany({ _id: { $in: toDelete } });
        console.log(`[Mandi] Pruned ${toDelete.length} old history records for ${cropName}`);
    }
}
async function storePriceHistory(farmerId, cropName, record) {
    const date = todayStr();
    console.log(`[Mandi] Storing history → farmer=${farmerId} crop=${cropName} date=${date} price=${record.Modal_Price}`);
    await MarketPriceHistory_1.MarketPriceHistory.findOneAndUpdate({ farmerId, cropName, date }, {
        farmerId,
        cropName,
        district: record.District,
        state: record.State,
        market: record.Market,
        modalPrice: parsePrice(record.Modal_Price),
        minPrice: parsePrice(record.Min_Price),
        maxPrice: parsePrice(record.Max_Price),
        date,
    }, { upsert: true, new: true });
    await pruneOldHistory(farmerId, cropName);
}
// ─── ROUTES ─────────────────────────────────────────────────────────────────
// GET /api/mandi/preference
router.get('/preference', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        let pref = await FarmerMarketPreference_1.FarmerMarketPreference.findOne({ farmerId });
        if (!pref) {
            const user = await User_1.User.findById(farmerId).select('location');
            pref = await FarmerMarketPreference_1.FarmerMarketPreference.create({
                farmerId,
                selectedCrop: 'Wheat',
                selectedState: user?.location?.state || '',
                selectedDistrict: user?.location?.district || '',
            });
            console.log(`[Mandi] Created preference for farmer ${farmerId}`, {
                state: pref.selectedState,
                district: pref.selectedDistrict,
            });
        }
        res.json({ success: true, data: pref });
    }
    catch (err) {
        console.error('[Mandi] preference GET error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/mandi/preference
router.put('/preference', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const { selectedCrop, selectedDistrict, selectedState } = req.body;
        console.log(`[Mandi] preference PUT → farmer=${farmerId}`, { selectedCrop, selectedDistrict, selectedState });
        const update = {};
        if (selectedCrop !== undefined)
            update.selectedCrop = selectedCrop;
        if (selectedDistrict !== undefined)
            update.selectedDistrict = selectedDistrict;
        if (selectedState !== undefined)
            update.selectedState = selectedState;
        const pref = await FarmerMarketPreference_1.FarmerMarketPreference.findOneAndUpdate({ farmerId }, { $set: update }, { upsert: true, new: true });
        if (selectedState || selectedDistrict) {
            const userUpdate = {};
            if (selectedState)
                userUpdate['location.state'] = selectedState;
            if (selectedDistrict)
                userUpdate['location.district'] = selectedDistrict;
            await User_1.User.findByIdAndUpdate(farmerId, { $set: userUpdate });
        }
        res.json({ success: true, data: pref });
    }
    catch (err) {
        console.error('[Mandi] preference PUT error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/mandi/current
router.get('/current', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        let pref = await FarmerMarketPreference_1.FarmerMarketPreference.findOne({ farmerId });
        if (!pref) {
            const user = await User_1.User.findById(farmerId).select('location');
            pref = await FarmerMarketPreference_1.FarmerMarketPreference.create({
                farmerId,
                selectedCrop: 'Wheat',
                selectedState: user?.location?.state || '',
                selectedDistrict: user?.location?.district || '',
            });
        }
        const { selectedCrop, selectedState, selectedDistrict } = pref;
        console.log(`[Mandi] /current → farmer=${farmerId} crop=${selectedCrop} state=${selectedState} district=${selectedDistrict}`);
        if (!selectedState && !selectedDistrict) {
            return res.json({
                success: true,
                data: null,
                locationMissing: true,
                message: 'Please select your location to get mandi prices.',
            });
        }
        const apiKey = getApiKey();
        if (!apiKey) {
            console.error('[Mandi] DATA_GOV_API_KEY is not set in .env');
            return res.status(500).json({ success: false, error: 'Mandi API key not configured on server. Set DATA_GOV_API_KEY in backend .env' });
        }
        console.log(`[Mandi] API key loaded: ${apiKey.slice(0, 8)}...`);
        const { records, level } = await searchMandiWithFallback(selectedCrop, selectedDistrict, selectedState);
        if (records.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: `No mandi data found for ${selectedCrop} anywhere in India. Try a different crop.`,
            });
        }
        const best = records[0];
        await storePriceHistory(farmerId, selectedCrop, best);
        res.json({
            success: true,
            data: {
                commodity: best.Commodity,
                market: best.Market,
                district: best.District,
                state: best.State,
                modalPrice: parsePrice(best.Modal_Price),
                minPrice: parsePrice(best.Min_Price),
                maxPrice: parsePrice(best.Max_Price),
                arrivalDate: normalizeDate(best.Arrival_Date),
                searchLevel: level,
            },
        });
    }
    catch (err) {
        console.error('[Mandi] /current error:', {
            message: err.message,
            code: err.code,
            status: err.response?.status,
            responseData: err.response?.data,
        });
        // BUG FIX 4: Return the actual error message, not a generic one
        const detail = err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            'Unknown error';
        res.status(502).json({
            success: false,
            error: `Mandi API error: ${detail}`,
            code: err.code || null,
            httpStatus: err.response?.status || null,
        });
    }
});
// GET /api/mandi/history
router.get('/history', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const cropName = req.query.crop || '';
        console.log(`[Mandi] /history → farmer=${farmerId} crop=${cropName || 'all'}`);
        const query = { farmerId };
        if (cropName)
            query.cropName = cropName;
        const history = await MarketPriceHistory_1.MarketPriceHistory.find(query)
            .sort({ date: 1 })
            .limit(20)
            .select('cropName district state market modalPrice minPrice maxPrice date -_id');
        console.log(`[Mandi] /history → returned ${history.length} records`);
        res.json({ success: true, data: history });
    }
    catch (err) {
        console.error('[Mandi] /history error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/mandi/prices — legacy public endpoint
router.get('/prices', async (req, res) => {
    try {
        const commodity = req.query.commodity || 'Wheat';
        const state = req.query.state || '';
        const district = req.query.district || '';
        if (!getApiKey()) {
            return res.status(500).json({ success: false, error: 'DATA_GOV_API_KEY not configured' });
        }
        const extraFilters = {};
        if (state)
            extraFilters.state = state;
        if (district)
            extraFilters.district = district;
        const records = await fetchMandiData(commodity, extraFilters);
        res.json({
            success: true,
            data: records.map((r) => ({
                commodity: r.Commodity,
                market: r.Market,
                state: r.State,
                district: r.District,
                modalPrice: parsePrice(r.Modal_Price),
                minPrice: parsePrice(r.Min_Price),
                maxPrice: parsePrice(r.Max_Price),
                date: normalizeDate(r.Arrival_Date),
            })),
        });
    }
    catch (err) {
        console.error('[Mandi] /prices error:', err.message);
        const detail = err.response?.data?.message || err.message || 'Unknown error';
        res.status(502).json({ success: false, error: `Mandi API error: ${detail}` });
    }
});
exports.default = router;
//# sourceMappingURL=mandi.js.map