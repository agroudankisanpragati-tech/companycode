"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const FarmerProfileData_1 = require("../models/FarmerProfileData");
const User_1 = require("../models/User");
const FarmerMarketPreference_1 = require("../models/FarmerMarketPreference");
const SoilMoisture_1 = require("../models/SoilMoisture");
const router = express_1.default.Router();
// GET /api/farmer-profile — load full extended profile
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [user, ext] = await Promise.all([
            User_1.User.findById(userId).select('-password'),
            FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true }),
        ]);
        res.json({ success: true, data: { user, ext } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/farmer-profile — save personal + farm details
router.put('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, phone, location, soilType, waterSource, farmSize, ...ext } = req.body;
        // Update core User document
        const userUpdates = {};
        if (name !== undefined)
            userUpdates.name = name;
        if (phone !== undefined)
            userUpdates.phone = phone;
        if (soilType !== undefined)
            userUpdates.soilType = soilType;
        if (waterSource !== undefined)
            userUpdates.waterSource = waterSource;
        if (farmSize !== undefined)
            userUpdates.farmSize = Number(farmSize) || 0;
        if (location) {
            const { state, district, village, country, latitude, longitude } = location;
            if (state)
                userUpdates['location.state'] = state;
            if (district)
                userUpdates['location.district'] = district;
            if (village)
                userUpdates['location.village'] = village;
            if (country)
                userUpdates['location.country'] = country;
            if (latitude != null)
                userUpdates['location.coordinates.latitude'] = Number(latitude);
            if (longitude != null)
                userUpdates['location.coordinates.longitude'] = Number(longitude);
            // Sync mandi preference & invalidate soil cache
            if (state && district) {
                await Promise.all([
                    FarmerMarketPreference_1.FarmerMarketPreference.findOneAndUpdate({ farmerId: userId }, { $set: { selectedState: state, selectedDistrict: district } }, { upsert: true }),
                    SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId: userId }, { $set: { lastUpdated: new Date(0) } }),
                ]);
            }
        }
        const [updatedUser, updatedExt] = await Promise.all([
            User_1.User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: true }).select('-password'),
            FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $set: { ...ext } }, { upsert: true, new: true }),
        ]);
        res.json({ success: true, data: { user: updatedUser, ext: updatedExt } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/farmer-profile/land — add land parcel
router.post('/land', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $push: { landParcels: req.body } }, { upsert: true, new: true });
        res.json({ success: true, data: profile?.landParcels });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/farmer-profile/land/:parcelId — edit land parcel
router.put('/land/:parcelId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = {};
        for (const [k, v] of Object.entries(req.body)) {
            updates[`landParcels.$.${k}`] = v;
        }
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId, 'landParcels._id': req.params.parcelId }, { $set: updates }, { new: true });
        res.json({ success: true, data: profile?.landParcels });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE /api/farmer-profile/land/:parcelId
router.delete('/land/:parcelId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $pull: { landParcels: { _id: req.params.parcelId } } }, { new: true });
        res.json({ success: true, data: profile?.landParcels });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/farmer-profile/crop — add crop history record
router.post('/crop', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $push: { cropHistory: req.body } }, { upsert: true, new: true });
        res.json({ success: true, data: profile?.cropHistory });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/farmer-profile/crop/:cropId — edit crop record
router.put('/crop/:cropId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = {};
        for (const [k, v] of Object.entries(req.body)) {
            updates[`cropHistory.$.${k}`] = v;
        }
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId, 'cropHistory._id': req.params.cropId }, { $set: updates }, { new: true });
        res.json({ success: true, data: profile?.cropHistory });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE /api/farmer-profile/crop/:cropId
router.delete('/crop/:cropId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $pull: { cropHistory: { _id: req.params.cropId } } }, { new: true });
        res.json({ success: true, data: profile?.cropHistory });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=farmerProfile.js.map