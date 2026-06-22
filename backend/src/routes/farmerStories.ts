import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { FarmerStory } from '../models/FarmerStory';

const router = express.Router();

const storiesDir = path.join(process.cwd(), 'uploads', 'stories');
if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, storiesDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for videos
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only video and image files are allowed'));
  },
});

const storyUpload = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

const mediaUrl = (filename: string) => `/uploads/stories/${filename}`;

// ─── PUBLIC: Get approved stories ─────────────────────────────────────────────

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const filter = req.query.filter as string || 'latest'; // latest | trending | featured
    const category = req.query.category as string;

    const query: any = { status: 'approved' };
    if (category && category !== 'All') query.category = category;

    let sortObj: any = { createdAt: -1 };
    if (filter === 'trending') sortObj = { likes: -1, views: -1, createdAt: -1 };
    if (filter === 'featured') { query.featured = true; sortObj = { createdAt: -1 }; }

    const [stories, total] = await Promise.all([
      FarmerStory.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
      FarmerStory.countDocuments(query),
    ]);

    res.json({ success: true, data: stories, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// ─── FARMER: My stories ───────────────────────────────────────────────────────

router.get('/my/stories', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stories = await FarmerStory.find({ uploadedBy: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: stories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your stories' });
  }
});

// ─── FARMER: Upload story ─────────────────────────────────────────────────────

router.post('/upload', authenticate, storyUpload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const thumbFile = files?.thumbnail?.[0];

    if (!videoFile) return res.status(400).json({ error: 'Video file is required' });
    if (!req.body.title) return res.status(400).json({ error: 'Title is required' });
    if (!req.body.farmerName) return res.status(400).json({ error: 'Farmer name is required' });

    const story = await FarmerStory.create({
      farmerName: req.body.farmerName,
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,
      cropName: req.body.cropName,
      title: req.body.title,
      caption: req.body.caption,
      successDescription: req.body.successDescription,
      category: req.body.category || 'Success Story',
      videoUrl: mediaUrl(videoFile.filename),
      thumbnailUrl: thumbFile ? mediaUrl(thumbFile.filename) : undefined,
      status: 'pending', // farmer uploads need approval
      uploadedBy: req.user!.userId,
      uploadedByAdmin: false,
    });

    res.status(201).json({ success: true, data: story, message: 'Story submitted for approval.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upload story' });
  }
});

// ─── FARMER: Like story ───────────────────────────────────────────────────────

router.post('/:id/like', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const story = await FarmerStory.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const alreadyLiked = story.likedBy.includes(userId);
    if (alreadyLiked) {
      story.likedBy = story.likedBy.filter(id => id !== userId);
      story.likes = Math.max(0, story.likes - 1);
    } else {
      story.likedBy.push(userId);
      story.likes += 1;
    }
    await story.save();
    res.json({ success: true, liked: !alreadyLiked, likes: story.likes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like story' });
  }
});

// ─── FARMER: Save story ───────────────────────────────────────────────────────

router.post('/:id/save', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const story = await FarmerStory.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const alreadySaved = story.savedBy.includes(userId);
    if (alreadySaved) {
      story.savedBy = story.savedBy.filter(id => id !== userId);
    } else {
      story.savedBy.push(userId);
    }
    await story.save();
    res.json({ success: true, saved: !alreadySaved });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save story' });
  }
});

// ─── PUBLIC: Get single story + increment views ───────────────────────────────

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const story = await FarmerStory.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, data: story });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// ─── ADMIN: Upload story (auto-approved) ─────────────────────────────────────

router.post('/admin/upload', authenticate, requireAdmin, storyUpload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const thumbFile = files?.thumbnail?.[0];

    if (!videoFile) return res.status(400).json({ error: 'Video file is required' });
    if (!req.body.title) return res.status(400).json({ error: 'Title is required' });

    const story = await FarmerStory.create({
      farmerName: req.body.farmerName || 'Admin',
      village: req.body.village,
      district: req.body.district,
      state: req.body.state,
      cropName: req.body.cropName,
      title: req.body.title,
      caption: req.body.caption,
      successDescription: req.body.successDescription,
      category: req.body.category || 'Success Story',
      videoUrl: mediaUrl(videoFile.filename),
      thumbnailUrl: thumbFile ? mediaUrl(thumbFile.filename) : undefined,
      status: 'approved', // admin uploads are auto-approved
      featured: req.body.featured === 'true',
      uploadedBy: req.user!.userId,
      uploadedByAdmin: true,
    });

    res.status(201).json({ success: true, data: story });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upload story' });
  }
});

// ─── ADMIN: Update story ──────────────────────────────────────────────────────

router.put('/admin/:id', authenticate, requireAdmin, storyUpload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const updateData: any = { ...req.body };
    if (files?.video?.[0]) updateData.videoUrl = mediaUrl(files.video[0].filename);
    if (files?.thumbnail?.[0]) updateData.thumbnailUrl = mediaUrl(files.thumbnail[0].filename);
    if (updateData.featured !== undefined) updateData.featured = updateData.featured === 'true';

    const story = await FarmerStory.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, data: story });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update story' });
  }
});

// ─── ADMIN: Approve / Reject ──────────────────────────────────────────────────

router.patch('/admin/:id/status', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const story = await FarmerStory.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, data: story });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ─── ADMIN: Feature / Unfeature ───────────────────────────────────────────────

router.patch('/admin/:id/feature', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const story = await FarmerStory.findByIdAndUpdate(
      req.params.id,
      { featured: Boolean(req.body.featured) },
      { new: true }
    );
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ success: true, data: story });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update featured' });
  }
});

// ─── ADMIN: Delete story ──────────────────────────────────────────────────────

router.delete('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const story = await FarmerStory.findByIdAndDelete(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Clean up video and thumbnail files
    for (const url of [story.videoUrl, story.thumbnailUrl].filter(Boolean)) {
      const filePath = path.join(process.cwd(), 'uploads', 'stories', path.basename(url!));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
