import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { KVK } from '../models/KVK';
import { FarmerProfileData } from '../models/FarmerProfileData';
import { User } from '../models/User';
import {
  geocodeAddress,
  findNearestKVKs,
  buildAddressString,
  haversineKm,
  Coordinates,
} from '../services/kvkService';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const router = express.Router();
const log = createLogger('kvkRoute');

// ── Photo upload setup ────────────────────────────────────────────────────────
const kvkUploadsDir = path.join(process.cwd(), 'uploads', 'kvk');
if (!fs.existsSync(kvkUploadsDir)) fs.mkdirSync(kvkUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, kvkUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `kvk-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
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
router.post('/nearest', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Resolve coordinates: body → Google geocode → profile coords → profile address geocode
    let coords: Coordinates | null = null;

    // 1. Explicit lat/lng in body (fastest)
    if (req.body.latitude != null && req.body.longitude != null) {
      coords = {
        latitude: Number(req.body.latitude),
        longitude: Number(req.body.longitude),
      };
    }

    // 2. Try Google geocoding from body address fields
    if (!coords) {
      const addrStr = buildAddressString(req.body);
      if (addrStr) coords = await geocodeAddress(addrStr);
    }

    // 3. Fall back to farmer profile
    if (!coords) {
      const [user, ext] = await Promise.all([
        User.findById(userId).select('location').lean(),
        FarmerProfileData.findOne({ userId }).select('address village district state pincode').lean(),
      ]);

      // 3a. Profile coordinates
      const profLat = user?.location?.coordinates?.latitude;
      const profLng = user?.location?.coordinates?.longitude;
      if (profLat && profLng && (profLat !== 0 || profLng !== 0)) {
        coords = { latitude: profLat, longitude: profLng };
      }

      // 3b. Geocode profile address
      if (!coords && ext) {
        const addrStr = buildAddressString({
          address: ext.address,
          village: ext.village,
          district: ext.district,
          state: ext.state,
          pincode: ext.pincode,
        });
        if (addrStr) coords = await geocodeAddress(addrStr);
      }

      // 3c. Geocode from User.location fields
      if (!coords && user?.location) {
        const addrStr = buildAddressString({
          village: user.location.village,
          district: user.location.district,
          state: user.location.state,
        });
        if (addrStr) coords = await geocodeAddress(addrStr);
      }
    }

    if (!coords) {
      return res.status(422).json({
        success: false,
        error: 'Could not determine your location. Please update your profile address.',
      });
    }

    const results = await findNearestKVKs(coords, 10);

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
  } catch (err: any) {
    log.error('KVK nearest error', { error: err?.message || String(err) });
    res.status(500).json({ success: false, error: 'Failed to find nearest KVK' });
  }
});

/**
 * POST /api/kvk/geocode
 * Geocodes an address string and returns coordinates.
 * Used by frontend "Change Address" flow.
 */
router.post('/geocode', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address } = req.body;
    if (!address?.trim()) return res.status(400).json({ error: 'Address is required' });

    const coords = await geocodeAddress(address);
    if (!coords) {
      return res.json({ success: false, message: 'Could not geocode address' });
    }
    res.json({ success: true, data: coords });
  } catch (err: any) {
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/kvk/admin — list with search, filter, pagination */
router.get('/admin', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, state, district, isActive } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search) {
      const re = createSafeRegex(search);
      filter.$or = [{ name: re }, { district: re }, { state: re }, { village: re }];
    }
    if (state)    filter.state    = createSafeRegex(state);
    if (district) filter.district = createSafeRegex(district);
    if (isActive === 'true')  filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;

    const [data, total, totalActive, totalInactive, districts] = await Promise.all([
      KVK.find(filter).sort({ state: 1, district: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      KVK.countDocuments(filter),
      KVK.countDocuments({ isActive: true }),
      KVK.countDocuments({ isActive: false }),
      KVK.distinct('district'),
    ]);

    res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: {
        total: await KVK.countDocuments(),
        active: totalActive,
        inactive: totalInactive,
        districtCount: districts.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch KVK list' });
  }
});

/** GET /api/kvk/admin/:id */
router.get('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kvk = await KVK.findById(req.params.id).lean();
    if (!kvk) return res.status(404).json({ error: 'KVK not found' });
    res.json({ success: true, data: kvk });
  } catch {
    res.status(500).json({ error: 'Failed to fetch KVK' });
  }
});

/** POST /api/kvk/admin — create */
router.post('/admin', authenticate, requireAdmin, upload.single('photo'), async (req: AuthenticatedRequest, res: Response) => {
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

    if (req.file) body.photoUrl = `/uploads/kvk/${req.file.filename}`;
    if (body.servicesOffered && typeof body.servicesOffered === 'string') {
      body.servicesOffered = body.servicesOffered.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    body.latitude  = lat;
    body.longitude = lng;
    body.createdBy = req.user!.userId;

    const kvk = await KVK.create(body);
    res.status(201).json({ success: true, data: kvk });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'A KVK with this name already exists in this district' });
    res.status(500).json({ error: err.message || 'Failed to create KVK' });
  }
});

/** PUT /api/kvk/admin/:id — update */
router.put('/admin/:id', authenticate, requireAdmin, upload.single('photo'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = { ...req.body };

    if (body.latitude !== undefined) {
      const lat = parseFloat(body.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: 'Invalid latitude' });
      body.latitude = lat;
    }
    if (body.longitude !== undefined) {
      const lng = parseFloat(body.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Invalid longitude' });
      body.longitude = lng;
    }
    if (body.phone && !/^[+\d\s\-()]{7,20}$/.test(body.phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (req.file) body.photoUrl = `/uploads/kvk/${req.file.filename}`;
    if (body.servicesOffered && typeof body.servicesOffered === 'string') {
      body.servicesOffered = body.servicesOffered.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    body.updatedBy = req.user!.userId;

    const kvk = await KVK.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!kvk) return res.status(404).json({ error: 'KVK not found' });
    res.json({ success: true, data: kvk });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'Duplicate KVK entry' });
    res.status(500).json({ error: err.message || 'Failed to update KVK' });
  }
});

/** PATCH /api/kvk/admin/:id/toggle — enable/disable */
router.patch('/admin/:id/toggle', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kvk = await KVK.findById(req.params.id);
    if (!kvk) return res.status(404).json({ error: 'KVK not found' });
    kvk.isActive = !kvk.isActive;
    kvk.updatedBy = req.user!.userId;
    await kvk.save();
    res.json({ success: true, data: kvk });
  } catch {
    res.status(500).json({ error: 'Failed to toggle KVK status' });
  }
});

/** DELETE /api/kvk/admin/:id */
router.delete('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kvk = await KVK.findByIdAndDelete(req.params.id);
    if (!kvk) return res.status(404).json({ error: 'KVK not found' });

    // Clean up photo file if local
    if (kvk.photoUrl?.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), kvk.photoUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'KVK deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete KVK' });
  }
});

export default router;
