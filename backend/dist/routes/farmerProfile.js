"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const FarmerProfileData_1 = require("../models/FarmerProfileData");
const User_1 = require("../models/User");
const FarmerMarketPreference_1 = require("../models/FarmerMarketPreference");
const SoilMoisture_1 = require("../models/SoilMoisture");
const router = express_1.default.Router();
const avatarDir = path_1.default.join(process.cwd(), 'uploads', 'avatars');
if (!fs_1.default.existsSync(avatarDir))
    fs_1.default.mkdirSync(avatarDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
            cb(null, true);
        else
            cb(new Error('Only image files are allowed'));
    },
});
// GET /api/farmer-profile
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
// PUT /api/farmer-profile
router.put('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, phone, location, soilType, waterSource, farmSize, ...ext } = req.body;
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
            if (state && district) {
                await Promise.all([
                    FarmerMarketPreference_1.FarmerMarketPreference.findOneAndUpdate({ farmerId: userId }, { $set: { selectedState: state, selectedDistrict: district } }, { upsert: true }),
                    SoilMoisture_1.SoilMoisture.findOneAndUpdate({ farmerId: userId }, { $set: { lastUpdated: new Date(0) } }),
                ]);
            }
        }
        // Strip array fields — managed via sub-routes
        const safeExt = { ...ext };
        delete safeExt.landParcels;
        delete safeExt.cropHistory;
        delete safeExt.farmDetails;
        const [updatedUser, updatedExt] = await Promise.all([
            User_1.User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: true }).select('-password'),
            FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $set: safeExt }, { upsert: true, new: true }),
        ]);
        res.json({ success: true, data: { user: updatedUser, ext: updatedExt } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/farmer-profile/avatar
router.post('/avatar', auth_1.authenticate, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        const userId = req.user.userId;
        const imageUrl = `/uploads/avatars/${req.file.filename}`;
        // Delete old avatar if local
        const user = await User_1.User.findById(userId);
        if (user?.profileImage && user.profileImage.startsWith('/uploads/')) {
            const oldPath = path_1.default.join(process.cwd(), user.profileImage);
            if (fs_1.default.existsSync(oldPath))
                fs_1.default.unlinkSync(oldPath);
        }
        const updated = await User_1.User.findByIdAndUpdate(userId, { $set: { profileImage: imageUrl } }, { new: true }).select('-password');
        res.json({ success: true, data: { profileImage: imageUrl, user: updated } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE /api/farmer-profile/avatar
router.delete('/avatar', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User_1.User.findById(userId);
        if (user?.profileImage && user.profileImage.startsWith('/uploads/')) {
            const oldPath = path_1.default.join(process.cwd(), user.profileImage);
            if (fs_1.default.existsSync(oldPath))
                fs_1.default.unlinkSync(oldPath);
        }
        await User_1.User.findByIdAndUpdate(userId, { $set: { profileImage: '' } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── Farm Details sub-routes ───────────────────────────────────────────────
router.post('/farm', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $push: { farmDetails: req.body } }, { upsert: true, new: true });
        res.json({ success: true, data: profile?.farmDetails });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.put('/farm/:farmId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = {};
        for (const [k, v] of Object.entries(req.body))
            updates[`farmDetails.$.${k}`] = v;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId, 'farmDetails._id': req.params.farmId }, { $set: updates }, { new: true });
        res.json({ success: true, data: profile?.farmDetails });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.delete('/farm/:farmId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId }, { $pull: { farmDetails: { _id: req.params.farmId } } }, { new: true });
        res.json({ success: true, data: profile?.farmDetails });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── Land sub-routes ───────────────────────────────────────────────────────
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
router.put('/land/:parcelId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = {};
        for (const [k, v] of Object.entries(req.body))
            updates[`landParcels.$.${k}`] = v;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId, 'landParcels._id': req.params.parcelId }, { $set: updates }, { new: true });
        res.json({ success: true, data: profile?.landParcels });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
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
// ── Crop History sub-routes ───────────────────────────────────────────────
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
router.put('/crop/:cropId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = {};
        for (const [k, v] of Object.entries(req.body))
            updates[`cropHistory.$.${k}`] = v;
        const profile = await FarmerProfileData_1.FarmerProfileData.findOneAndUpdate({ userId, 'cropHistory._id': req.params.cropId }, { $set: updates }, { new: true });
        res.json({ success: true, data: profile?.cropHistory });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
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
// ── Account: delete / deactivate ─────────────────────────────────────────
router.delete('/account', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { password } = req.body;
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ success: false, error: 'Password is incorrect' });
        await Promise.all([
            User_1.User.findByIdAndDelete(userId),
            FarmerProfileData_1.FarmerProfileData.findOneAndDelete({ userId }),
        ]);
        res.json({ success: true, message: 'Account deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=farmerProfile.js.map