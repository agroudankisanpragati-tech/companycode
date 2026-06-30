import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseaseKnowledgeBase } from '../models/DiseaseKnowledgeBase';
import { DiseaseRecommendation } from '../models/DiseaseRecommendation';
import { searchCache, searchKnowledgeBase, callAIForDisease, autoSaveToKnowledgeBase, handleFeedbackForKB } from '../services/diseaseService';
import { translateObject, SUPPORTED_LANGUAGES } from '../services/translationService';

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

    // ── Step 1: Search scan-history cache (fastest) ──────────────────────────
    if (cropHint) {
      const cached = await searchCache(cropHint, '');
      if (cached) {
        return res.json({ success: true, source: 'cache', similarityScore: cached.similarityScore, data: { ...cached, imageUrl: savedImageUrl } });
      }
    }

    // ── Step 2: Search Disease Knowledge Base ─────────────────────────────────
    if (cropHint) {
      const kb = await searchKnowledgeBase(cropHint, '');
      if (kb) {
        const saved = await DiseaseRecommendation.create({ userId, ...kb, imageUrl: savedImageUrl });
        return res.json({ success: true, source: 'knowledge_base', similarityScore: kb.similarityScore, data: saved });
      }
    }

    // ── Step 3: Call AI Vision API ────────────────────────────────────────────
    let aiResult: Awaited<ReturnType<typeof callAIForDisease>> | null = null;
    try {
      aiResult = await callAIForDisease(imageBase64, cropHint);
    } catch (aiErr: any) {
      console.error('AI Disease API error:', aiErr.message);
    }

    if (aiResult) {
      // Re-check KB with AI-identified names for a better match
      const kb = await searchKnowledgeBase(aiResult.cropName, aiResult.diseaseName);
      if (kb) {
        const saved = await DiseaseRecommendation.create({ userId, ...kb, imageUrl: savedImageUrl });
        return res.json({ success: true, source: 'knowledge_base', similarityScore: kb.similarityScore, data: saved });
      }

      // ── Step 4: Save AI result to both Recommendation + Knowledge Base ──────
      const [saved] = await Promise.all([
        DiseaseRecommendation.create({ userId, ...aiResult, imageUrl: savedImageUrl, source: 'ai' }),
        autoSaveToKnowledgeBase(aiResult, savedImageUrl),
      ]);
      return res.json({ success: true, source: 'ai', data: saved });
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

// ─── FARMER: Translate disease result ────────────────────────────────────────

router.post('/translate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recordId, language } = req.body;
    if (!recordId || !language) return res.status(400).json({ error: 'recordId and language are required' });
    if (language === 'en') return res.status(400).json({ error: 'Source language is already English' });
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const record = await DiseaseRecommendation.findById(recordId);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (record.userId && record.userId !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    // Check if translation already exists in DB
    const existing = (record.translations as any)?.get?.(language) ?? (record.translations as any)?.[language];
    if (existing) {
      return res.json({ success: true, cached: true, language, data: existing });
    }

    // Extract translatable fields from the English record
    const enData: Record<string, any> = {
      cropName: record.cropName,
      diseaseName: record.diseaseName,
      diseaseType: record.diseaseType,
      severityLevel: record.severityLevel,
      symptoms: record.symptoms,
      organicTreatment: record.organicTreatment,
      chemicalTreatment: record.chemicalTreatment,
      treatment: record.treatment,
      prevention: record.prevention,
      description: record.description,
      recommendedActions: record.recommendedActions,
    };

    const translated = await translateObject(enData, language);

    // Permanently save to DB
    await DiseaseRecommendation.findByIdAndUpdate(recordId, {
      $set: { [`translations.${language}`]: translated },
    });

    return res.json({ success: true, cached: false, language, data: translated });
  } catch (error: any) {
    console.error('Disease translate error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

// ─── FARMER: Feedback ─────────────────────────────────────────────────────────

router.post('/feedback', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recommendationId, feedback } = req.body;
    if (!['helpful', 'not_helpful'].includes(feedback)) return res.status(400).json({ error: 'Invalid feedback' });
    const updated = await DiseaseRecommendation.findByIdAndUpdate(recommendationId, { feedback }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });

    // Self-learning: update KB feedback counters & auto-promote if threshold met
    await handleFeedbackForKB(
      updated.knowledgeBaseId,
      updated.cropName,
      updated.diseaseName,
      feedback === 'helpful'
    );

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
