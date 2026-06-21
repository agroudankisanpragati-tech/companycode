"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const FarmerMarketPreference_1 = require("../models/FarmerMarketPreference");
const SoilMoisture_1 = require("../models/SoilMoisture");
const router = express_1.default.Router();
// PUT /api/users/location — Global Location System: single endpoint for all modules
// Updates User profile + syncs FarmerMarketPreference + invalidates soil moisture cache
router.put('/location', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const { country, state, district, village, latitude, longitude } = req.body;
        if (!state?.trim() || !district?.trim()) {
            return res.status(400).json({ success: false, error: 'state and district are required' });
        }
        // 1. Save to user profile
        const locationUpdate = {
            'location.state': state.trim(),
            'location.district': district.trim(),
        };
        if (country !== undefined)
            locationUpdate['location.country'] = country.trim();
        if (village !== undefined)
            locationUpdate['location.village'] = village.trim();
        if (latitude !== undefined)
            locationUpdate['location.coordinates.latitude'] = Number(latitude);
        if (longitude !== undefined)
            locationUpdate['location.coordinates.longitude'] = Number(longitude);
        const updatedUser = await User_1.User.findByIdAndUpdate(farmerId, { $set: locationUpdate }, { new: true }).select('-password');
        // 2. Sync mandi preference location
        await FarmerMarketPreference_1.FarmerMarketPreference.findOneAndUpdate({ farmerId }, { $set: { selectedState: state.trim(), selectedDistrict: district.trim() } }, { upsert: true });
        // 3. Invalidate soil moisture cache so next fetch uses new location
        await SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId }, { $set: { lastUpdated: new Date(0) } });
        console.log(`[Location] Updated for farmer ${farmerId}: ${district}, ${state}`);
        res.json({ success: true, data: updatedUser?.location });
    }
    catch (err) {
        console.error('[Location] update error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// Get user profile
router.get('/:id', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Update user profile
router.put('/:id', async (req, res) => {
    try {
        const user = await User_1.User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// Save a recommended crop to user's profile
router.post('/:id/save-recommendation', async (req, res) => {
    try {
        const { crop, variety } = req.body;
        const userId = req.params.id;
        if (!crop)
            return res.status(400).json({ error: 'crop is required' });
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const entry = variety ? `${crop} (${variety})` : crop;
        if (!user.crops)
            user.crops = [];
        if (!user.crops.includes(entry)) {
            user.crops.push(entry);
            await user.save();
        }
        res.json({ success: true, data: user.crops });
    }
    catch (error) {
        console.error('save-recommendation error', error);
        res.status(500).json({ error: 'Failed to save recommendation' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map