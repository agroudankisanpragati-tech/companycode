import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseaseKnowledgeBase } from '../models/DiseaseKnowledgeBase';
import { DiseaseRecommendation } from '../models/DiseaseRecommendation';
import { searchCache, searchKnowledgeBase, callAIForDisease } from '../services/diseaseService';

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'uploads', 'disease');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const imgUrl = (f: string) => `/uploads/disease/${f}`;

// ─── FARMER: Scan disease from uploaded image ─────────────────────────────────

router.post('/scan', authenticate, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cropHint = req.body.cropName as string | undefined;
    const userId = req.user!.userId;

    if (!req.file) return res.status(400).json({ error: 'Image file is required' });

    const imageBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = imageBuffer.toString('base64');
    const savedImageUrl = imgUrl(req.file.filename);

    // Step 1: search cache
    if (cropHint) {
      const cached = await searchCache(cropHint, '');
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          similarityScore: cached.similarityScore,
          data: { ...cached, imageUrl: savedImageUrl },
        });
      }
    }

    // Step 2: AI analysis first to get disease name, then check KB
    let aiResult: Awaited<ReturnType<typeof callAIForDisease>> | null = null;
    try {
      aiResult = await callAIForDisease(imageBase64, cropHint);
    } catch (_e) {
      // AI failed — still try KB with crop hint
    }

    if (aiResult) {
      // Check cache with AI-identified names
      const cached = await searchCache(aiResult.cropName, aiResult.diseaseName);
      if (cached) {
        return res.json({
          success: true, source: 'cache', similarityScore: cached.similarityScore,
          data: { ...cached, imageUrl: savedImageUrl },
        });
      }

      // Check knowledge base
      const kb = await searchKnowledgeBase(aiResult.cropName, aiResult.diseaseName);
      if (kb) {
        const saved = await DiseaseRecommendation.create({ userId, ...kb, imageUrl: savedImageUrl });
        return res.json({ success: true, source: 'knowledge_base', similarityScore: kb.similarityScore, data: saved });
      }

      // Save AI result
      const saved = await DiseaseRecommendation.create({
        userId, ...aiResult, imageUrl: savedImageUrl, source: 'ai',
      });
      return res.json({ success: true, source: 'ai', data: saved });
    }

    // Fallback if AI completely fails — try KB with crop hint only
    if (cropHint) {
      const kb = await searchKnowledgeBase(cropHint, '');
      if (kb) {
        const saved = await DiseaseRecommendation.create({ userId, ...kb, imageUrl: savedImageUrl });
        return res.json({ success: true, source: 'knowledge_base', data: saved });
      }
    }

    return res.status(422).json({ error: 'Could not analyze the image. Please try a clearer photo.' });
  } catch (error: any) {
    console.error('Disease scan error:', error);
    res.status(500).json({ error: error.message || 'Disease scan failed' });
  }
});

// ─── FARMER: Scan history ─────────────────────────────────────────────────────

router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const [data, total] = await Promise.all([
      DiseaseRecommendation.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      DiseaseRecommendation.countDocuments({ userId }),
    ]);
    res.json({ success: true, data, total, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─── FARMER: Feedback ─────────────────────────────────────────────────────────

router.post('/feedback', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recommendationId, feedback } = req.body;
    if (!['helpful', 'not_helpful'].includes(feedback)) return res.status(400).json({ error: 'Invalid feedback' });
    const updated = await DiseaseRecommendation.findByIdAndUpdate(recommendationId, { feedback }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ─── ADMIN: Knowledge Base CRUD ───────────────────────────────────────────────

router.get('/admin/knowledge-base', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, category, cropName } = req.query as Record<string, string>;
    const filter: any = {};
    if (search) filter.$or = [
      { cropName: new RegExp(search, 'i') },
      { diseaseName: new RegExp(search, 'i') },
    ];
    if (category) filter.cropCategory = new RegExp(category, 'i');
    if (cropName) filter.cropName = new RegExp(cropName, 'i');

    const [data, total, totalCrops, totalDiseaseImages, totalHealthyImages, totalScans] = await Promise.all([
      DiseaseKnowledgeBase.find(filter).sort({ cropName: 1 }).skip((page - 1) * limit).limit(limit),
      DiseaseKnowledgeBase.countDocuments(filter),
      DiseaseKnowledgeBase.distinct('cropName').then(r => r.length),
      DiseaseKnowledgeBase.aggregate([{ $project: { count: { $size: '$diseaseImages' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]).then(r => r[0]?.total || 0),
      DiseaseKnowledgeBase.aggregate([{ $project: { count: { $size: '$healthyImages' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]).then(r => r[0]?.total || 0),
      DiseaseRecommendation.countDocuments(),
    ]);

    const totalRecords = await DiseaseKnowledgeBase.countDocuments();

    res.json({
      success: true, data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { totalRecords, totalCrops, totalDiseaseImages, totalHealthyImages, totalRecommendations: totalScans },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disease records' });
  }
});

router.get('/admin/knowledge-base/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

const kbUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

router.post('/admin/knowledge-base', authenticate, requireAdmin, kbUpload.fields([
  { name: 'diseaseImages', maxCount: 10 },
  { name: 'healthyImages', maxCount: 10 },
]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const diseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
    const healthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
    const record = await DiseaseKnowledgeBase.create({ ...req.body, diseaseImages, healthyImages });
    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create record' });
  }
});

router.put('/admin/knowledge-base/:id', authenticate, requireAdmin, kbUpload.fields([
  { name: 'diseaseImages', maxCount: 10 },
  { name: 'healthyImages', maxCount: 10 },
]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await DiseaseKnowledgeBase.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const newDiseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
    const newHealthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
    const diseaseImages = [...(existing.diseaseImages || []), ...newDiseaseImages];
    const healthyImages = [...(existing.healthyImages || []), ...newHealthyImages];
    const updated = await DiseaseKnowledgeBase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, diseaseImages, healthyImages },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update record' });
  }
});

router.delete('/admin/knowledge-base/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ─── ADMIN: Scan Recommendations list ────────────────────────────────────────

router.get('/admin/recommendations', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const [data, total] = await Promise.all([
      DiseaseRecommendation.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      DiseaseRecommendation.countDocuments(),
    ]);
    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
