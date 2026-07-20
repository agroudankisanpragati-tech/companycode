import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { PestKnowledgeBase } from '../models/PestKnowledgeBase';

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'uploads', 'pest');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))
      cb(null, true);
    else cb(new Error('Only image and video files allowed'));
  },
});

const mediaUrl = (type: 'image' | 'video', filename: string) =>
  `/uploads/pest/${filename}`;

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, cropName, status } = req.query as Record<string, string>;

    const filter: any = {};
    if (search) filter.$or = [
      { cropName: new RegExp(search, 'i') },
      { pestName: new RegExp(search, 'i') },
    ];
    if (cropName) filter.cropName = new RegExp(cropName, 'i');
    if (status)   filter.status = status;

    const [data, total, totalCrops, totalImages] = await Promise.all([
      PestKnowledgeBase.find(filter).sort({ cropName: 1 }).skip((page - 1) * limit).limit(limit),
      PestKnowledgeBase.countDocuments(filter),
      PestKnowledgeBase.distinct('cropName').then(r => r.length),
      PestKnowledgeBase.aggregate([
        { $project: { count: { $size: '$images' } } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]).then(r => r[0]?.total || 0),
    ]);

    const totalRecords = await PestKnowledgeBase.countDocuments();

    res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { totalRecords, totalCrops, totalImages },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pest records' });
  }
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────

router.get('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await PestKnowledgeBase.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post('/', authenticate, requireAdmin,
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const images = (files?.images || []).map(f => mediaUrl('image', f.filename));
      const videos = (files?.videos || []).map(f => mediaUrl('video', f.filename));

      const record = await PestKnowledgeBase.create({
        ...req.body,
        images,
        videos,
        createdBy: req.user?.userId,
      });
      res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      if (error.code === 11000)
        return res.status(400).json({ error: 'Pest record for this crop already exists' });
      res.status(500).json({ error: error.message || 'Failed to create record' });
    }
  }
);

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.put('/:id', authenticate, requireAdmin,
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await PestKnowledgeBase.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Record not found' });

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const newImages = (files?.images || []).map(f => mediaUrl('image', f.filename));
      const newVideos = (files?.videos || []).map(f => mediaUrl('video', f.filename));

      const updated = await PestKnowledgeBase.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          images: [...(existing.images || []), ...newImages],
          videos: [...(existing.videos || []), ...newVideos],
          updatedBy: req.user?.userId,
        },
        { new: true, runValidators: true }
      );
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update record' });
    }
  }
);

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await PestKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, message: 'Pest record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ─── PUBLIC: lookup by crop + pest (used by AI knowledge_service) ─────────────

router.get('/lookup/:cropName/:pestName', async (req, res: Response) => {
  try {
    const { cropName, pestName } = req.params;
    const record = await PestKnowledgeBase.findOne({
      cropName:  { $regex: `^${cropName}$`,  $options: 'i' },
      pestName:  { $regex: `^${pestName}$`,  $options: 'i' },
      status: 'published',
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

export default router;
