import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { FarmerProfileData } from '../models/FarmerProfileData';
import { User } from '../models/User';
import { FarmerMarketPreference } from '../models/FarmerMarketPreference';
import { SoilMoisture } from '../models/SoilMoisture';

const router = express.Router();

const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// GET /api/farmer-profile
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [user, ext] = await Promise.all([
      User.findById(userId).select('-password'),
      FarmerProfileData.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId } },
        { upsert: true, new: true }
      ),
    ]);
    res.json({ success: true, data: { user, ext } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/farmer-profile
router.put('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, phone, location, soilType, waterSource, farmSize, ...ext } = req.body;

    const userUpdates: Record<string, any> = {};
    if (name !== undefined) userUpdates.name = name;
    if (phone !== undefined) userUpdates.phone = phone;
    if (soilType !== undefined) userUpdates.soilType = soilType;
    if (waterSource !== undefined) userUpdates.waterSource = waterSource;
    if (farmSize !== undefined) userUpdates.farmSize = Number(farmSize) || 0;

    if (location) {
      const { state, district, village, country, latitude, longitude } = location;
      if (state) userUpdates['location.state'] = state;
      if (district) userUpdates['location.district'] = district;
      if (village) userUpdates['location.village'] = village;
      if (country) userUpdates['location.country'] = country;
      if (latitude != null) userUpdates['location.coordinates.latitude'] = Number(latitude);
      if (longitude != null) userUpdates['location.coordinates.longitude'] = Number(longitude);

      if (state && district) {
        await Promise.all([
          FarmerMarketPreference.findOneAndUpdate(
            { farmerId: userId },
            { $set: { selectedState: state, selectedDistrict: district } },
            { upsert: true }
          ),
          SoilMoisture.findOneAndUpdate(
            { farmerId: userId },
            { $set: { lastUpdated: new Date(0) } }
          ),
        ]);
      }
    }

    // Strip array fields — managed via sub-routes
    const safeExt = { ...ext };
    delete safeExt.landParcels;
    delete safeExt.cropHistory;
    delete safeExt.farmDetails;

    const [updatedUser, updatedExt] = await Promise.all([
      User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: true }).select('-password'),
      FarmerProfileData.findOneAndUpdate(
        { userId },
        { $set: safeExt },
        { upsert: true, new: true }
      ),
    ]);

    res.json({ success: true, data: { user: updatedUser, ext: updatedExt } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/farmer-profile/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const userId = req.user!.userId;
    const imageUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar if local
    const user = await User.findById(userId);
    if (user?.profileImage && user.profileImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { profileImage: imageUrl } },
      { new: true }
    ).select('-password');

    res.json({ success: true, data: { profileImage: imageUrl, user: updated } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/farmer-profile/avatar
router.delete('/avatar', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (user?.profileImage && user.profileImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await User.findByIdAndUpdate(userId, { $set: { profileImage: '' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Farm Details sub-routes ───────────────────────────────────────────────

router.post('/farm', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $push: { farmDetails: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: profile?.farmDetails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/farm/:farmId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.body)) updates[`farmDetails.$.${k}`] = v;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId, 'farmDetails._id': req.params.farmId },
      { $set: updates },
      { new: true }
    );
    res.json({ success: true, data: profile?.farmDetails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/farm/:farmId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $pull: { farmDetails: { _id: req.params.farmId } } },
      { new: true }
    );
    res.json({ success: true, data: profile?.farmDetails });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Land sub-routes ───────────────────────────────────────────────────────

router.post('/land', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $push: { landParcels: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: profile?.landParcels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/land/:parcelId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.body)) updates[`landParcels.$.${k}`] = v;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId, 'landParcels._id': req.params.parcelId },
      { $set: updates },
      { new: true }
    );
    res.json({ success: true, data: profile?.landParcels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/land/:parcelId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $pull: { landParcels: { _id: req.params.parcelId } } },
      { new: true }
    );
    res.json({ success: true, data: profile?.landParcels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Crop History sub-routes ───────────────────────────────────────────────

router.post('/crop', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $push: { cropHistory: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: profile?.cropHistory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/crop/:cropId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.body)) updates[`cropHistory.$.${k}`] = v;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId, 'cropHistory._id': req.params.cropId },
      { $set: updates },
      { new: true }
    );
    res.json({ success: true, data: profile?.cropHistory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/crop/:cropId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = await FarmerProfileData.findOneAndUpdate(
      { userId },
      { $pull: { cropHistory: { _id: req.params.cropId } } },
      { new: true }
    );
    res.json({ success: true, data: profile?.cropHistory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Account: delete / deactivate ─────────────────────────────────────────

router.delete('/account', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { password } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ success: false, error: 'Password is incorrect' });

    await Promise.all([
      User.findByIdAndDelete(userId),
      FarmerProfileData.findOneAndDelete({ userId }),
    ]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
