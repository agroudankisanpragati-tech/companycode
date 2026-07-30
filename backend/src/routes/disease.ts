import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseaseRecommendation } from '../models/DiseaseRecommendation';
import { DiseasePestSolution } from '../models/DiseasePestSolution';
// Disease & Pest Management (diseasepestsolutions) is the ONLY source of truth.
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
import { createSafeRegex } from '../utils/regex';

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
// YOLO is the ONLY prediction engine. Crop Verification AI is NOT used.

router.post('/scan', authenticate, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // cropName is MANDATORY — reject immediately if missing
    const cropName = (req.body.cropName as string | undefined)?.trim();
    if (!cropName) {
      return res.status(400).json({ success: false, error: 'Please select a crop before scanning.' });
    }

    const userId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    const savedImageUrl = imgUrl(req.file.filename);

    // ── Step 1: YOLO Classification — the ONLY prediction source ─────────────
    // cropName is passed as the class filter — disease search is restricted
    // to this crop's classes only. No cross-crop search. No auto-detection.
    let yoloResult: Awaited<ReturnType<typeof runHybridDiseaseDetection>>;
    try {
      log.info('Disease scan: request received', { userId, cropName, file: req.file.filename });
      log.info('Disease scan: image validated', { path: req.file.path, size: req.file.size });
      log.info('Disease scan: YOLO prediction started', { cropName });
      yoloResult = await runHybridDiseaseDetection(req.file.path, '', cropName);
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
    if (!yoloResult.result) {
      return res.status(422).json({
        success: false,
        predictionSource: 'YOLOv8 Classification Model',
        error: yoloResult.error || 'Unable to identify the disease in this image. Please upload a clear leaf image.',
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
    // YOLO provides: cropName, diseaseName, rawAiLabel — KB provides advisory
    log.info('Disease scan: knowledge base search started', { crop: prediction.cropName, disease: prediction.diseaseName, rawAiLabel: prediction.rawAiLabel });
    const advisory = await getAdvisoryFromKnowledgeBase(
      prediction.cropName,
      prediction.diseaseName,
      prediction.rawAiLabel,
    );
    log.info('Disease scan: knowledge base search complete', { found: !!advisory, knowledgeBaseId: advisory?.knowledgeBaseId || 'none' });

    // ── Step 5: Build final record — prediction from YOLO, advisory from KB ──
    const isHealthy = prediction.diseaseType === 'Healthy';

    // Build { en, hi } description object.
    // Use advisory.description (en) if present; otherwise YOLO fallback.
    // Use advisory.descriptionHi (hi) if present; otherwise same fallback.
    const fallbackDesc = isHealthy
      ? `Your ${prediction.cropName} plant appears healthy. No disease detected.`
      : `${prediction.diseaseName} detected on ${prediction.cropName} with ${confidence}% confidence by YOLOv8 Classification Model.`;

    const resolvedDescription = {
      en: advisory?.description   || fallbackDesc,
      hi: advisory?.descriptionHi || advisory?.description || fallbackDesc,
    };

    const record = {
      userId,
      // Prediction fields — YOLO only (always plain English strings)
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
      // Advisory fields — stored as { en, hi } objects for offline multilingual
      knowledgeBaseId:          advisory?.knowledgeBaseId    || '',
      symptoms:                 advisory ? { en: advisory.symptoms,           hi: advisory.symptomsHi           } : '',
      organicTreatment:         advisory ? { en: advisory.organicTreatment,   hi: advisory.organicTreatmentHi   } : '',
      chemicalTreatment:        advisory ? { en: advisory.chemicalTreatment,  hi: advisory.chemicalTreatmentHi  } : '',
      treatment:                advisory?.treatment          || '',
      prevention:               advisory ? { en: advisory.prevention,         hi: advisory.preventionHi         } : '',
      description:              resolvedDescription,
      recommendedActions:       advisory ? { en: advisory.recommendedActions, hi: advisory.recommendedActionsHi } : '',
      urgentPrevention:         advisory ? { en: advisory.urgentPrevention,   hi: advisory.urgentPreventionHi   } : '',
      recoveryTips:             advisory ? { en: advisory.recoveryTips,       hi: advisory.recoveryTipsHi       } : '',
      dos:                      advisory ? { en: advisory.dos,                hi: advisory.dosHi                } : '',
      donts:                    advisory ? { en: advisory.donts,              hi: advisory.dontsHi              } : '',
      recommendedProducts:      advisory ? { en: advisory.recommendedProducts,hi: advisory.recommendedProductsHi} : '',
      recommendedFertilizer:    advisory?.recommendedFertilizer || '',
      recommendedBioProduct:    advisory?.recommendedBioProduct || '',
      recommendedOrganicProduct: advisory?.recommendedOrganicProduct || '',
      extraFarmerAdvice:        advisory ? { en: advisory.extraFarmerAdvice,  hi: advisory.extraFarmerAdviceHi  } : '',
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
      return res.json({
        success: true,
        predictionSource: 'YOLOv8 Classification Model',
        source: 'yolo',
        engine: 'yolo',
        hasAdvisory: !!advisory,
        data: {
          ...record,
          // Map extraFarmerAdvice → farmerAdvice so ScanResult.farmerAdvice is populated
          farmerAdvice: (record as any).extraFarmerAdvice,
        },
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
      data: {
        ...saved.toObject(),
        // Map extraFarmerAdvice → farmerAdvice so ScanResult.farmerAdvice is populated
        farmerAdvice: saved.extraFarmerAdvice,
      },
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

export default router;
