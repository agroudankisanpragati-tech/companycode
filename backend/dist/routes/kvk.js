"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const KVK_1 = require("../models/KVK");
const FarmerProfileData_1 = require("../models/FarmerProfileData");
const User_1 = require("../models/User");
const kvkService_1 = require("../services/kvkService");
const router = express_1.default.Router();
// ── Photo upload setup ────────────────────────────────────────────────────────
const kvkUploadsDir = path_1.default.join(process.cwd(), 'uploads', 'kvk');
if (!fs_1.default.existsSync(kvkUploadsDir))
    fs_1.default.mkdirSync(kvkUploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, kvkUploadsDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `kvk-${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files allowed'));
    },
});
// ─────────────────────────────────────────────────────────────────────────────
// FARMER ROUTES (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/kvk/nearest
 * Body: { address?, village?, district?, state?, pincode?, latitude?, longitude? }
 * Returns nearest KVKs sorted by distance.
 * Uses saved farmer profile address if no body provided.
 * Falls back to Haversine-only if Google API unavailable.
 */
router.post('/nearest', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        // Resolve coordinates: body → Google geocode → profile coords → profile address geocode
        let coords = null;
        // 1. Explicit lat/lng in body (fastest)
        if (req.body.latitude != null && req.body.longitude != null) {
            coords = {
                latitude: Number(req.body.latitude),
                longitude: Number(req.body.longitude),
            };
        }
        // 2. Try Google geocoding from body address fields
        if (!coords) {
            const addrStr = (0, kvkService_1.buildAddressString)(req.body);
            if (addrStr)
                coords = await (0, kvkService_1.geocodeAddress)(addrStr);
        }
        // 3. Fall back to farmer profile
        if (!coords) {
            const [user, ext] = await Promise.all([
                User_1.User.findById(userId).select('location').lean(),
                FarmerProfileData_1.FarmerProfileData.findOne({ userId }).select('address village district state pincode').lean(),
            ]);
            // 3a. Profile coordinates
            const profLat = user?.location?.coordinates?.latitude;
            const profLng = user?.location?.coordinates?.longitude;
            if (profLat && profLng && (profLat !== 0 || profLng !== 0)) {
                coords = { latitude: profLat, longitude: profLng };
            }
            // 3b. Geocode profile address
            if (!coords && ext) {
                const addrStr = (0, kvkService_1.buildAddressString)({
                    address: ext.address,
                    village: ext.village,
                    district: ext.district,
                    state: ext.state,
                    pincode: ext.pincode,
                });
                if (addrStr)
                    coords = await (0, kvkService_1.geocodeAddress)(addrStr);
            }
            // 3c. Geocode from User.location fields
            if (!coords && user?.location) {
                const addrStr = (0, kvkService_1.buildAddressString)({
                    village: user.location.village,
                    district: user.location.district,
                    state: user.location.state,
                });
                if (addrStr)
                    coords = await (0, kvkService_1.geocodeAddress)(addrStr);
            }
        }
        if (!coords) {
            return res.status(422).json({
                success: false,
                error: 'Could not determine your location. Please update your profile address.',
            });
        }
        const results = await (0, kvkService_1.findNearestKVKs)(coords, 10);
        if (results.length === 0) {
            return res.json({ success: true, data: [], coords, message: 'No nearby KVK centers found.' });
        }
        res.json({
            success: true,
            data: results.map(r => ({
                ...r.kvk,
                distanceKm: Math.round(r.distanceKm * 10) / 10,
            })),
            coords,
            nearest: {
                ...results[0].kvk,
                distanceKm: Math.round(results[0].distanceKm * 10) / 10,
            },
        });
    }
    catch (err) {
        console.error('KVK nearest error:', err);
        res.status(500).json({ success: false, error: 'Failed to find nearest KVK' });
    }
});
/**
 * POST /api/kvk/geocode
 * Geocodes an address string and returns coordinates.
 * Used by frontend "Change Address" flow.
 */
router.post('/geocode', auth_1.authenticate, async (req, res) => {
    try {
        const { address } = req.body;
        if (!address?.trim())
            return res.status(400).json({ error: 'Address is required' });
        const coords = await (0, kvkService_1.geocodeAddress)(address);
        if (!coords) {
            return res.json({ success: false, message: 'Could not geocode address' });
        }
        res.json({ success: true, data: coords });
    }
    catch (err) {
        res.status(500).json({ error: 'Geocoding failed' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────
/** GET /api/kvk/admin — list with search, filter, pagination */
router.get('/admin', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search, state, district, isActive } = req.query;
        const filter = {};
        if (search) {
            const re = new RegExp(search, 'i');
            filter.$or = [{ name: re }, { district: re }, { state: re }, { village: re }];
        }
        if (state)
            filter.state = new RegExp(state, 'i');
        if (district)
            filter.district = new RegExp(district, 'i');
        if (isActive === 'true')
            filter.isActive = true;
        if (isActive === 'false')
            filter.isActive = false;
        const [data, total, totalActive, totalInactive, districts] = await Promise.all([
            KVK_1.KVK.find(filter).sort({ state: 1, district: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            KVK_1.KVK.countDocuments(filter),
            KVK_1.KVK.countDocuments({ isActive: true }),
            KVK_1.KVK.countDocuments({ isActive: false }),
            KVK_1.KVK.distinct('district'),
        ]);
        res.json({
            success: true,
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: {
                total: await KVK_1.KVK.countDocuments(),
                active: totalActive,
                inactive: totalInactive,
                districtCount: districts.length,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch KVK list' });
    }
});
/** GET /api/kvk/admin/:id */
router.get('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const kvk = await KVK_1.KVK.findById(req.params.id).lean();
        if (!kvk)
            return res.status(404).json({ error: 'KVK not found' });
        res.json({ success: true, data: kvk });
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch KVK' });
    }
});
/** POST /api/kvk/admin — create */
router.post('/admin', auth_1.authenticate, auth_1.requireAdmin, upload.single('photo'), async (req, res) => {
    try {
        const body = { ...req.body };
        // Validate coordinates
        const lat = parseFloat(body.latitude);
        const lng = parseFloat(body.longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid latitude or longitude' });
        }
        // Validate phone
        if (body.phone && !/^[+\d\s\-()]{7,20}$/.test(body.phone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        // Validate email
        if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (req.file)
            body.photoUrl = `/uploads/kvk/${req.file.filename}`;
        if (body.servicesOffered && typeof body.servicesOffered === 'string') {
            body.servicesOffered = body.servicesOffered.split(',').map((s) => s.trim()).filter(Boolean);
        }
        body.latitude = lat;
        body.longitude = lng;
        body.createdBy = req.user.userId;
        const kvk = await KVK_1.KVK.create(body);
        res.status(201).json({ success: true, data: kvk });
    }
    catch (err) {
        if (err.code === 11000)
            return res.status(400).json({ error: 'A KVK with this name already exists in this district' });
        res.status(500).json({ error: err.message || 'Failed to create KVK' });
    }
});
/** PUT /api/kvk/admin/:id — update */
router.put('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, upload.single('photo'), async (req, res) => {
    try {
        const body = { ...req.body };
        if (body.latitude !== undefined) {
            const lat = parseFloat(body.latitude);
            if (isNaN(lat) || lat < -90 || lat > 90)
                return res.status(400).json({ error: 'Invalid latitude' });
            body.latitude = lat;
        }
        if (body.longitude !== undefined) {
            const lng = parseFloat(body.longitude);
            if (isNaN(lng) || lng < -180 || lng > 180)
                return res.status(400).json({ error: 'Invalid longitude' });
            body.longitude = lng;
        }
        if (body.phone && !/^[+\d\s\-()]{7,20}$/.test(body.phone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (req.file)
            body.photoUrl = `/uploads/kvk/${req.file.filename}`;
        if (body.servicesOffered && typeof body.servicesOffered === 'string') {
            body.servicesOffered = body.servicesOffered.split(',').map((s) => s.trim()).filter(Boolean);
        }
        body.updatedBy = req.user.userId;
        const kvk = await KVK_1.KVK.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
        if (!kvk)
            return res.status(404).json({ error: 'KVK not found' });
        res.json({ success: true, data: kvk });
    }
    catch (err) {
        if (err.code === 11000)
            return res.status(400).json({ error: 'Duplicate KVK entry' });
        res.status(500).json({ error: err.message || 'Failed to update KVK' });
    }
});
/** PATCH /api/kvk/admin/:id/toggle — enable/disable */
router.patch('/admin/:id/toggle', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const kvk = await KVK_1.KVK.findById(req.params.id);
        if (!kvk)
            return res.status(404).json({ error: 'KVK not found' });
        kvk.isActive = !kvk.isActive;
        kvk.updatedBy = req.user.userId;
        await kvk.save();
        res.json({ success: true, data: kvk });
    }
    catch {
        res.status(500).json({ error: 'Failed to toggle KVK status' });
    }
});
/** DELETE /api/kvk/admin/:id */
router.delete('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const kvk = await KVK_1.KVK.findByIdAndDelete(req.params.id);
        if (!kvk)
            return res.status(404).json({ error: 'KVK not found' });
        // Clean up photo file if local
        if (kvk.photoUrl?.startsWith('/uploads/')) {
            const filePath = path_1.default.join(process.cwd(), kvk.photoUrl);
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
        }
        res.json({ success: true, message: 'KVK deleted successfully' });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete KVK' });
    }
});
exports.default = router;
//# sourceMappingURL=kvk.js.map