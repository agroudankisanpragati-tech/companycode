import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseaseKnowledgeBase } from '../models/DiseaseKnowledgeBase';
import { DiseaseRecommendation } from '../models/DiseaseRecommendation';
import { DiseasePestSolution } from '../models/DiseasePestSolution';
import {
  searchCache,
  searchKnowledgeBase,
  getAdvisoryFromKnowledgeBase,
  runHybridDiseaseDetection,
  autoSaveToKnowledgeBase,
  handleFeedbackForKB,
  YOLO_CONFIDENCE_THRESHOLD,
} from '../services/diseaseService';
import { translateObject, SUPPORTED_LANGUAGES } from '../services/translationService';
import { fetchCropsFromYolo } from '../services/yoloService';
import { createLogger } from '../utils/logger';
import { createExactSafeRegex, createSafeRegex } from '../utils/regex';

const router = express.Router();
const log = createLogger('diseaseRoute');

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

// ─── Supported crops (from YOLO dataset_index.json via FastAPI) ──────────────

router.get('/supported-crops', async (_req, res: Response) => {
  try {
    const crops = await fetchCropsFromYolo();
    // Always return something — if YOLO is down, return empty list
    res.json({ success: true, crops });
  } catch {
    res.json({ success: true, crops: [] });
  }
});

// ─── FARMER: Scan disease from uploaded image ─────────────────────────────────
// Pipeline: YOLO (prediction) → Knowledge Base (advisory) → persist → respond
// YOLO is the ONLY prediction engine. Pragati AI / LLM never predicts disease.

router.post('/scan', authenticate, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // cropName is SECONDARY metadata — optional. Crop Verification AI is PRIMARY.
    const cropHint = (req.body.cropName as string | undefined)?.trim() || undefined;
    const userId   = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    const savedImageUrl = imgUrl(req.file.filename);

    // ── Step 1: YOLO Classification — the ONLY prediction source ─────────────
    // cropHint is passed only for YOLO class filtering — never as a hard requirement.
    // Crop Verification AI (EfficientNet) has already run on the Python side and
    // will have validated/overridden the crop before YOLO runs.
    let yoloResult: Awaited<ReturnType<typeof runHybridDiseaseDetection>>;
    try {
      log.info('Disease scan: request received', { userId, cropHint: cropHint || '(none)', file: req.file.filename });
      log.info('Disease scan: image validated', { path: req.file.path, size: req.file.size });
      log.info('Disease scan: crop verification + YOLO prediction started');
      yoloResult = await runHybridDiseaseDetection(req.file.path, '', cropHint);
    } catch (err: any) {
      const msg = err?.message || '';
      const lower = msg.toLowerCase();
      let userError = 'Disease detection failed. Please try again.';
      if (lower.includes('econnrefused') || lower.includes('connect')) {
        userError = 'FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again.';
      } else if (lower.includes('timeout') || lower.includes('econnaborted')) {
        userError = 'FastAPI AI server timed out. The model may still be loading. Please try again in a moment.';
      }
      log.error('YOLO/FastAPI error', { error: msg, stack: err?.stack });
      return res.status(500).json({
        success: false,
        error: userError,
        predictionSource: 'YOLOv8 Classification Model',
      });
    }

    // ── Step 2: YOLO returned no result ──────────────────────────────────────
    // Happens when the image is not a recognisable crop leaf, the crop is not
    // in the YOLO training dataset, or Crop Verification returned a mismatch.
    if (!yoloResult.result) {
      return res.status(422).json({
        success: false,
        predictionSource: 'YOLOv8 Classification Model',
        error: yoloResult.error || 'Unable to identify the crop in this image. Please upload a clear leaf image of a supported crop.',
      });
    }

    const prediction  = yoloResult.result;
    const yoloRaw     = yoloResult.yoloRaw;
    const confidence  = prediction.confidenceScore;

    log.info('Disease scan: YOLO prediction received', { crop: prediction.cropName, disease: prediction.diseaseName, confidence });

    // ── Step 3: Low-confidence guard ─────────────────────────────────────────
    if (confidence < YOLO_CONFIDENCE_THRESHOLD) {
      return res.status(200).json({
        success: false,
        lowConfidence: true,
        predictionSource: 'YOLOv8 Classification Model',
        confidence,
        threshold: YOLO_CONFIDENCE_THRESHOLD,
        cropName: prediction.cropName,
        error: `Low confidence prediction (${confidence}%). Please upload a clearer, well-lit image of the affected plant part for accurate detection.`,
        yoloTop5: yoloRaw?.top5 || [],
      });
    }

    // ── Step 4: Knowledge Base advisory lookup using YOLO labels ─────────────
    // YOLO provides: cropName, diseaseName — KB provides: symptoms, treatment, prevention
    log.info('Disease scan: knowledge base search started', { crop: prediction.cropName, disease: prediction.diseaseName });
    const advisory = await getAdvisoryFromKnowledgeBase(
      prediction.cropName,
      prediction.diseaseName
    );
    log.info('Disease scan: knowledge base search complete', { found: !!advisory });

    // ── Step 5: Build final record — prediction from YOLO, advisory from KB ──
    const isHealthy = prediction.diseaseType === 'Healthy';

    const record = {
      userId,
      // Prediction fields — YOLO only
      cropName:         prediction.cropName,
      diseaseName:      prediction.diseaseName,
      diseaseType:      prediction.diseaseType,
      severityLevel:    prediction.severityLevel,
      confidenceScore:  confidence,
      predictionSource: 'YOLOv8 Classification Model',
      yoloTop5:         (yoloRaw?.top5 || []).map(t => ({
        rank:       t.rank,
        class_name: t.class_name,
        confidence: t.confidence,
        category:   t.category,
      })),
      imageUrl:         savedImageUrl,
      source:           'yolo' as const,
      // Advisory fields — Knowledge Base only (empty string if no KB match)
      knowledgeBaseId:          advisory?.knowledgeBaseId    || '',
      symptoms:                 advisory?.symptoms           || '',
      organicTreatment:         advisory?.organicTreatment   || '',
      chemicalTreatment:        advisory?.chemicalTreatment  || '',
      treatment:                advisory?.treatment          || '',
      prevention:               advisory?.prevention         || '',
      description:              advisory?.description        || (isHealthy
        ? `Your ${prediction.cropName} plant appears healthy. No disease detected.`
        : `${prediction.diseaseName} detected on ${prediction.cropName} with ${confidence}% confidence by YOLOv8 Classification Model.`),
      recommendedActions:       advisory?.recommendedActions || '',
      urgentPrevention:         advisory?.urgentPrevention   || '',
      recoveryTips:             advisory?.recoveryTips       || '',
      dos:                      advisory?.dos                || '',
      donts:                    advisory?.donts              || '',
      recommendedProducts:      advisory?.recommendedProducts || '',
      recommendedFertilizer:    advisory?.recommendedFertilizer || '',
      recommendedBioProduct:    advisory?.recommendedBioProduct || '',
      recommendedOrganicProduct: advisory?.recommendedOrganicProduct || '',
      extraFarmerAdvice:        advisory?.extraFarmerAdvice  || '',
      suitableWeather:          advisory?.suitableWeather    || '',
      tags:                     advisory?.tags               || [],
    };

    // ── Step 6: Persist to DiseaseRecommendation + auto-save to KB ───────────
    let saved: any;
    try {
      [saved] = await Promise.all([
        DiseaseRecommendation.create(record),
        !isHealthy ? autoSaveToKnowledgeBase(prediction, savedImageUrl) : Promise.resolve(),
      ]);
    } catch (saveErr: any) {
      log.error('DB save failed', { error: saveErr?.message });
      // Return result even if DB save fails
      return res.json({
        success: true,
        predictionSource: 'YOLOv8 Classification Model',
        source: 'yolo',
        engine: 'yolo',
        hasAdvisory: !!advisory,
        data: { ...record },
      });
    }

    log.info('Disease scan complete', { engine: 'yolo', crop: prediction.cropName, result: prediction.diseaseName, confidence });
    log.info('Disease scan: response sent', { savedId: saved?._id });

    return res.json({
      success: true,
      predictionSource: 'YOLOv8 Classification Model',
      source: 'yolo',
      engine: 'yolo',
      hasAdvisory: !!advisory,
      data: saved,
    });

  } catch (error: any) {
    log.error('Unhandled error', { error: error?.message, stack: error?.stack });
    return res.status(500).json({
      success: false,
      predictionSource: 'YOLOv8 Classification Model',
      error: error?.message || 'Disease scan failed. Please try again.',
    });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch history' });
  }
});

// ─── FARMER: Translate disease result ────────────────────────────────────────

router.post('/translate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recordId, language } = req.body;
    if (!recordId || !language) return res.status(400).json({ success: false, error: 'recordId and language are required' });
    if (language === 'en') return res.status(400).json({ success: false, error: 'Source language is already English' });
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ success: false, error: 'Unsupported language' });

    const record = await DiseaseRecommendation.findById(recordId);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    if (record.userId && record.userId !== req.user!.userId) return res.status(403).json({ success: false, error: 'Access denied' });

    // Check if translation already exists in DB
    const existing = (record.translations as any)?.get?.(language) ?? (record.translations as any)?.[language];
    if (existing) {
      return res.json({ success: true, cached: true, language, data: existing });
    }

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

    await DiseaseRecommendation.findByIdAndUpdate(recordId, {
      $set: { [`translations.${language}`]: translated },
    });

    return res.json({ success: true, cached: false, language, data: translated });
  } catch (error: any) {
    log.error('Disease translate error', { error: error?.message || String(error) });
    res.status(500).json({ success: false, error: error?.message || 'Translation failed' });
  }
});

// ─── FARMER: Feedback ─────────────────────────────────────────────────────────

router.post('/feedback', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recommendationId, feedback, comment, correctDisease } = req.body;
    if (!['helpful', 'not_helpful'].includes(feedback)) return res.status(400).json({ success: false, error: 'Invalid feedback' });
    const updateFields: any = { feedback };
    if (comment?.trim()) updateFields.comment = comment.trim();
    if (correctDisease?.trim()) updateFields.correctDisease = correctDisease.trim();
    const updated = await DiseaseRecommendation.findByIdAndUpdate(recommendationId, updateFields, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });

    await handleFeedbackForKB(
      updated.knowledgeBaseId,
      updated.cropName,
      updated.diseaseName,
      feedback === 'helpful'
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to save feedback' });
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
      { cropName: createSafeRegex(search) },
      { diseaseName: createSafeRegex(search) },
    ];
    if (category) filter.cropCategory = createSafeRegex(category);
    if (cropName) filter.cropName = createSafeRegex(cropName);

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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch disease records' });
  }
});

router.get('/admin/knowledge-base/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch record' });
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

const kbUploadFields = kbUpload.fields([
  { name: 'diseaseImages', maxCount: 10 },
  { name: 'healthyImages', maxCount: 10 },
  { name: 'imageGallery',  maxCount: 20 },
]);

router.post('/admin/knowledge-base', authenticate, requireAdmin, kbUploadFields,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const diseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
      const healthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
      const imageGallery  = (files?.imageGallery  || []).map(f => imgUrl(f.filename));
      const record = await DiseaseKnowledgeBase.create({
        ...req.body,
        diseaseImages, healthyImages, imageGallery,
        createdBy: req.user?.userId,
      });
      res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      if (error.code === 11000)
        return res.status(400).json({ success: false, error: 'Disease record for this crop already exists' });
      res.status(500).json({ success: false, error: error?.message || 'Failed to create record' });
    }
  }
);

router.put('/admin/knowledge-base/:id', authenticate, requireAdmin, kbUploadFields,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await DiseaseKnowledgeBase.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Record not found' });
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const newDiseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
      const newHealthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
      const newGallery       = (files?.imageGallery  || []).map(f => imgUrl(f.filename));
      const updated = await DiseaseKnowledgeBase.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          diseaseImages: [...(existing.diseaseImages || []), ...newDiseaseImages],
          healthyImages: [...(existing.healthyImages || []), ...newHealthyImages],
          imageGallery:  [...(existing.imageGallery  || []), ...newGallery],
          updatedBy: req.user?.userId,
        },
        { new: true, runValidators: true }
      );
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to update record' });
    }
  }
);

router.delete('/admin/knowledge-base/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to delete record' });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch recommendations' });
  }
});

// ─── ADMIN: Disease & Pest Knowledge Management (new dedicated module) ────────
// Uses the same DiseaseKnowledgeBase collection but exposed under a separate
// route prefix so it is completely independent of the existing /admin/knowledge-base routes.

const dkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `dk-${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const dkUploadFields = dkUpload.fields([
  { name: 'diseaseImages', maxCount: 10 },
  { name: 'referenceImages', maxCount: 10 },
]);

// LIST with search / filter / pagination
router.get('/admin/disease-pest-knowledge', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, category, severity, status, cropName } = req.query as Record<string, string>;

    const filter: any = {};
    if (search) filter.$or = [
      { cropName:    createSafeRegex(search) },
      { diseaseName: createSafeRegex(search) },
      { tags:        createSafeRegex(search) },
    ];
    if (category) filter.diseaseType   = createSafeRegex(category);
    if (severity) filter.severityLevel = severity;
    if (status)   filter.status        = status;
    if (cropName) filter.cropName      = createSafeRegex(cropName);

    const [data, total] = await Promise.all([
      DiseaseKnowledgeBase.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      DiseaseKnowledgeBase.countDocuments(filter),
    ]);

    const [totalCrops, totalPublished, totalDraft, totalAI] = await Promise.all([
      DiseaseKnowledgeBase.distinct('cropName').then(r => r.length),
      DiseaseKnowledgeBase.countDocuments({ status: 'published' }),
      DiseaseKnowledgeBase.countDocuments({ status: 'draft' }),
      DiseaseKnowledgeBase.countDocuments({ source: { $in: ['ai_auto', 'ai_verified'] } }),
    ]);

    res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { total: await DiseaseKnowledgeBase.countDocuments(), totalCrops, totalPublished, totalDraft, totalAI },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch records' });
  }
});

// GET single
router.get('/admin/disease-pest-knowledge/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch record' });
  }
});

// CREATE
router.post('/admin/disease-pest-knowledge', authenticate, requireAdmin, dkUploadFields,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Duplicate check — open update mode hint
      const existing = await DiseaseKnowledgeBase.findOne({
        cropName:    createExactSafeRegex(String(req.body.cropName || '').trim()),
        diseaseName: createExactSafeRegex(String(req.body.diseaseName || '').trim()),
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'A record for this Crop + Disease already exists.',
          existingId: existing._id,
        });
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const diseaseImages   = (files?.diseaseImages   || []).map(f => imgUrl(f.filename));
      const referenceImages = (files?.referenceImages || []).map(f => imgUrl(f.filename));

      const body = req.body;
      const record = await DiseaseKnowledgeBase.create({
        cropName:    body.cropName?.trim(),
        diseaseName: body.diseaseName?.trim(),
        scientificName: body.scientificName,
        cropCategory:   body.cropCategory || 'General',
        diseaseType:    body.diseaseType   || 'Disease',
        severityLevel:  body.severityLevel || 'medium',
        status:         body.status        || 'draft',
        description:    body.description   || '',
        symptoms:       body.symptoms,
        symptomsDescription: body.symptoms,
        causes:         body.causes,
        organicSolution:  body.organicSolution,
        organicTreatment: body.organicSolution,
        chemicalSolution: body.chemicalSolution,
        chemicalTreatment: body.chemicalSolution,
        prevention:       body.prevention,
        preventionMethods: body.prevention,
        urgentPrevention:  body.urgentPrevention,
        recoveryTips:      body.recoveryTips,
        dos:               body.dos,
        donts:             body.donts,
        recommendedProducts:      body.recommendedProducts,
        recommendedFertilizer:    body.recommendedFertilizer,
        recommendedBioProduct:    body.recommendedBioProduct,
        recommendedOrganicProduct: body.recommendedOrganicProduct,
        extraFarmerAdvice: body.extraFarmerAdvice,
        suitableWeather:   body.suitableWeather,
        adminNotes:        body.adminNotes,
        tags:     body.tags     ? (Array.isArray(body.tags)     ? body.tags     : body.tags.split(',').map((t: string) => t.trim()).filter(Boolean))     : [],
        seoKeywords: body.seoKeywords ? (Array.isArray(body.seoKeywords) ? body.seoKeywords : body.seoKeywords.split(',').map((t: string) => t.trim()).filter(Boolean)) : [],
        diseaseImages,
        imageGallery: referenceImages,
        healthyImages: [],
        source: 'admin',
        createdBy: req.user?.userId,
      });
      res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      if (error.code === 11000)
        return res.status(409).json({ success: false, error: 'A record for this Crop + Disease already exists.' });
      res.status(500).json({ success: false, error: error?.message || 'Failed to create record' });
    }
  }
);

// UPDATE
router.put('/admin/disease-pest-knowledge/:id', authenticate, requireAdmin, dkUploadFields,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await DiseaseKnowledgeBase.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Record not found' });

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const newDiseaseImages   = (files?.diseaseImages   || []).map(f => imgUrl(f.filename));
      const newReferenceImages = (files?.referenceImages || []).map(f => imgUrl(f.filename));

      const body = req.body;
      const parseTags = (v: any) => v ? (Array.isArray(v) ? v : v.split(',').map((t: string) => t.trim()).filter(Boolean)) : undefined;

      const updateData: any = {
        diseaseImages: [...(existing.diseaseImages || []), ...newDiseaseImages],
        imageGallery:  [...(existing.imageGallery  || []), ...newReferenceImages],
        updatedBy: req.user?.userId,
      };

      const textFields = [
        'cropName','diseaseName','scientificName','cropCategory','diseaseType','severityLevel','status',
        'description','symptoms','causes','organicSolution','chemicalSolution','prevention',
        'urgentPrevention','recoveryTips','dos','donts','recommendedProducts','recommendedFertilizer',
        'recommendedBioProduct','recommendedOrganicProduct','extraFarmerAdvice','suitableWeather','adminNotes',
      ];
      textFields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

      // Keep legacy fields in sync
      if (body.symptoms)          { updateData.symptomsDescription = body.symptoms; }
      if (body.organicSolution)   { updateData.organicTreatment    = body.organicSolution; }
      if (body.chemicalSolution)  { updateData.chemicalTreatment   = body.chemicalSolution; }
      if (body.prevention)        { updateData.preventionMethods   = body.prevention; }

      if (body.tags)        updateData.tags        = parseTags(body.tags);
      if (body.seoKeywords) updateData.seoKeywords = parseTags(body.seoKeywords);

      const updated = await DiseaseKnowledgeBase.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to update record' });
    }
  }
);

// DELETE single
router.delete('/admin/disease-pest-knowledge/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseaseKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, message: 'Record deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to delete record' });
  }
});

// BULK DELETE
router.post('/admin/disease-pest-knowledge/bulk-delete', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, error: 'ids array required' });
    const result = await DiseaseKnowledgeBase.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Bulk delete failed' });
  }
});

// DUPLICATE
router.post('/admin/disease-pest-knowledge/:id/duplicate', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const original = await DiseaseKnowledgeBase.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, error: 'Record not found' });
    const { _id, slug, createdAt, updatedAt, scanCount, helpfulCount, notHelpfulCount, ...rest } = original as any;
    const copy = await DiseaseKnowledgeBase.create({
      ...rest,
      diseaseName: `${rest.diseaseName} (Copy)`,
      status: 'draft',
      source: 'admin',
      createdBy: req.user?.userId,
      scanCount: 0, helpfulCount: 0, notHelpfulCount: 0,
    });
    res.status(201).json({ success: true, data: copy });
  } catch (error: any) {
    if (error.code === 11000)
      return res.status(409).json({ success: false, error: 'Duplicate already exists' });
    res.status(500).json({ success: false, error: error?.message || 'Duplicate failed' });
  }
});

// EXPORT JSON
router.get('/admin/disease-pest-knowledge/export/json', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cropName, status } = req.query as Record<string, string>;
    const filter: any = {};
    if (cropName) filter.cropName = createSafeRegex(cropName);
    if (status)   filter.status   = status;
    const data = await DiseaseKnowledgeBase.find(filter).lean();
    res.setHeader('Content-Disposition', 'attachment; filename="disease-pest-knowledge.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json({ exportedAt: new Date().toISOString(), count: data.length, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Export failed' });
  }
});

// IMPORT JSON (bulk upsert)
router.post('/admin/disease-pest-knowledge/import/json', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records: any[] = req.body.data || req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ success: false, error: 'data array required' });

    let created = 0, updated = 0, errors = 0;
    for (const r of records) {
      if (!r.cropName || !r.diseaseName) { errors++; continue; }
      try {
        const result = await DiseaseKnowledgeBase.findOneAndUpdate(
          { cropName: createExactSafeRegex(r.cropName.trim()), diseaseName: createExactSafeRegex(r.diseaseName.trim()) },
          { ...r, updatedBy: req.user?.userId, source: r.source || 'admin' },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (result) { const isNew = (result as any).__v === 0; isNew ? created++ : updated++; }
      } catch { errors++; }
    }
    res.json({ success: true, created, updated, errors, total: records.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Import failed' });
  }
});

export default router;
