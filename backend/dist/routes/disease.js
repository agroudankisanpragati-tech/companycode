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
const DiseaseKnowledgeBase_1 = require("../models/DiseaseKnowledgeBase");
const DiseaseRecommendation_1 = require("../models/DiseaseRecommendation");
const diseaseService_1 = require("../services/diseaseService");
const translationService_1 = require("../services/translationService");
const yoloService_1 = require("../services/yoloService");
const router = express_1.default.Router();
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'disease');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files allowed'));
    },
});
const imgUrl = (f) => `/uploads/disease/${f}`;
// ─── Supported crops (from YOLO dataset_index.json via FastAPI) ──────────────
router.get('/supported-crops', async (_req, res) => {
    try {
        const crops = await (0, yoloService_1.fetchCropsFromYolo)();
        // Always return something — if YOLO is down, return empty list
        res.json({ success: true, crops });
    }
    catch {
        res.json({ success: true, crops: [] });
    }
});
// ─── FARMER: Scan disease from uploaded image ─────────────────────────────────
// Pipeline: YOLO (prediction) → Knowledge Base (advisory) → persist → respond
// YOLO is the ONLY prediction engine. Pragati AI / LLM never predicts disease.
router.post('/scan', auth_1.authenticate, upload.single('image'), async (req, res) => {
    try {
        const cropHint = req.body.cropName;
        const userId = req.user.userId;
        if (!cropHint?.trim()) {
            return res.status(400).json({ success: false, error: 'Crop name is required before scanning.' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Image file is required' });
        }
        const savedImageUrl = imgUrl(req.file.filename);
        // ── Step 1: YOLO Classification — the ONLY prediction source ─────────────
        let yoloResult;
        try {
            yoloResult = await (0, diseaseService_1.runHybridDiseaseDetection)(req.file.path, '', cropHint);
        }
        catch (err) {
            console.error('[Disease Scan] YOLO error:', err?.message);
            return res.status(500).json({
                success: false,
                error: 'Disease detection failed. Please try again.',
                predictionSource: 'YOLOv8 Classification Model',
            });
        }
        // ── Step 2: Crop not supported by YOLO ───────────────────────────────────
        if (!yoloResult.result) {
            return res.status(422).json({
                success: false,
                predictionSource: 'YOLOv8 Classification Model',
                error: 'This crop is not yet supported by the AgroDhan AI model. Please upload a clearer image or select a supported crop.',
            });
        }
        const prediction = yoloResult.result;
        const yoloRaw = yoloResult.yoloRaw;
        const confidence = prediction.confidenceScore;
        // ── Step 3: Low-confidence guard ─────────────────────────────────────────
        if (confidence < diseaseService_1.YOLO_CONFIDENCE_THRESHOLD) {
            return res.status(200).json({
                success: false,
                lowConfidence: true,
                predictionSource: 'YOLOv8 Classification Model',
                confidence,
                threshold: diseaseService_1.YOLO_CONFIDENCE_THRESHOLD,
                cropName: prediction.cropName,
                error: `Low confidence prediction (${confidence}%). Please upload a clearer, well-lit image of the affected plant part for accurate detection.`,
                yoloTop5: yoloRaw?.top5 || [],
            });
        }
        // ── Step 4: Knowledge Base advisory lookup using YOLO labels ─────────────
        // YOLO provides: cropName, diseaseName — KB provides: symptoms, treatment, prevention
        const advisory = await (0, diseaseService_1.getAdvisoryFromKnowledgeBase)(prediction.cropName, prediction.diseaseName);
        // ── Step 5: Build final record — prediction from YOLO, advisory from KB ──
        const isHealthy = prediction.diseaseType === 'Healthy';
        const record = {
            userId,
            // Prediction fields — YOLO only
            cropName: prediction.cropName,
            diseaseName: prediction.diseaseName,
            diseaseType: prediction.diseaseType,
            severityLevel: prediction.severityLevel,
            confidenceScore: confidence,
            predictionSource: 'YOLOv8 Classification Model',
            yoloTop5: (yoloRaw?.top5 || []).map(t => ({
                rank: t.rank,
                class_name: t.class_name,
                confidence: t.confidence,
                category: t.category,
            })),
            imageUrl: savedImageUrl,
            source: 'yolo',
            // Advisory fields — Knowledge Base only (empty string if no KB match)
            knowledgeBaseId: advisory?.knowledgeBaseId || '',
            symptoms: advisory?.symptoms || '',
            organicTreatment: advisory?.organicTreatment || '',
            chemicalTreatment: advisory?.chemicalTreatment || '',
            treatment: advisory?.treatment || '',
            prevention: advisory?.prevention || '',
            description: advisory?.description || (isHealthy
                ? `Your ${prediction.cropName} plant appears healthy. No disease detected.`
                : `${prediction.diseaseName} detected on ${prediction.cropName} with ${confidence}% confidence by YOLOv8 Classification Model.`),
            recommendedActions: advisory?.recommendedActions || '',
            urgentPrevention: advisory?.urgentPrevention || '',
            recoveryTips: advisory?.recoveryTips || '',
            dos: advisory?.dos || '',
            donts: advisory?.donts || '',
            recommendedProducts: advisory?.recommendedProducts || '',
            recommendedFertilizer: advisory?.recommendedFertilizer || '',
            recommendedBioProduct: advisory?.recommendedBioProduct || '',
            recommendedOrganicProduct: advisory?.recommendedOrganicProduct || '',
            extraFarmerAdvice: advisory?.extraFarmerAdvice || '',
            suitableWeather: advisory?.suitableWeather || '',
            tags: advisory?.tags || [],
        };
        // ── Step 6: Persist to DiseaseRecommendation + auto-save to KB ───────────
        let saved;
        try {
            [saved] = await Promise.all([
                DiseaseRecommendation_1.DiseaseRecommendation.create(record),
                !isHealthy ? (0, diseaseService_1.autoSaveToKnowledgeBase)(prediction, savedImageUrl) : Promise.resolve(),
            ]);
        }
        catch (saveErr) {
            console.error('[Disease Scan] DB save failed:', saveErr?.message);
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
        console.log(`[Disease Scan] Engine: yolo | Crop: ${prediction.cropName} | Result: ${prediction.diseaseName} | Confidence: ${confidence}%`);
        return res.json({
            success: true,
            predictionSource: 'YOLOv8 Classification Model',
            source: 'yolo',
            engine: 'yolo',
            hasAdvisory: !!advisory,
            data: saved,
        });
    }
    catch (error) {
        console.error('[Disease Scan] Unhandled error:', error?.message, error?.stack);
        return res.status(500).json({
            success: false,
            predictionSource: 'YOLOv8 Classification Model',
            error: error?.message || 'Disease scan failed. Please try again.',
        });
    }
});
// ─── FARMER: Scan history ─────────────────────────────────────────────────────
router.get('/history', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const [data, total] = await Promise.all([
            DiseaseRecommendation_1.DiseaseRecommendation.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            DiseaseRecommendation_1.DiseaseRecommendation.countDocuments({ userId }),
        ]);
        res.json({ success: true, data, total, page, limit });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch history' });
    }
});
// ─── FARMER: Translate disease result ────────────────────────────────────────
router.post('/translate', auth_1.authenticate, async (req, res) => {
    try {
        const { recordId, language } = req.body;
        if (!recordId || !language)
            return res.status(400).json({ success: false, error: 'recordId and language are required' });
        if (language === 'en')
            return res.status(400).json({ success: false, error: 'Source language is already English' });
        if (!translationService_1.SUPPORTED_LANGUAGES.includes(language))
            return res.status(400).json({ success: false, error: 'Unsupported language' });
        const record = await DiseaseRecommendation_1.DiseaseRecommendation.findById(recordId);
        if (!record)
            return res.status(404).json({ success: false, error: 'Record not found' });
        if (record.userId && record.userId !== req.user.userId)
            return res.status(403).json({ success: false, error: 'Access denied' });
        // Check if translation already exists in DB
        const existing = record.translations?.get?.(language) ?? record.translations?.[language];
        if (existing) {
            return res.json({ success: true, cached: true, language, data: existing });
        }
        const enData = {
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
        const translated = await (0, translationService_1.translateObject)(enData, language);
        await DiseaseRecommendation_1.DiseaseRecommendation.findByIdAndUpdate(recordId, {
            $set: { [`translations.${language}`]: translated },
        });
        return res.json({ success: true, cached: false, language, data: translated });
    }
    catch (error) {
        console.error('Disease translate error:', error);
        res.status(500).json({ success: false, error: error?.message || 'Translation failed' });
    }
});
// ─── FARMER: Feedback ─────────────────────────────────────────────────────────
router.post('/feedback', auth_1.authenticate, async (req, res) => {
    try {
        const { recommendationId, feedback, comment, correctDisease } = req.body;
        if (!['helpful', 'not_helpful'].includes(feedback))
            return res.status(400).json({ success: false, error: 'Invalid feedback' });
        const updateFields = { feedback };
        if (comment?.trim())
            updateFields.comment = comment.trim();
        if (correctDisease?.trim())
            updateFields.correctDisease = correctDisease.trim();
        const updated = await DiseaseRecommendation_1.DiseaseRecommendation.findByIdAndUpdate(recommendationId, updateFields, { new: true });
        if (!updated)
            return res.status(404).json({ success: false, error: 'Not found' });
        await (0, diseaseService_1.handleFeedbackForKB)(updated.knowledgeBaseId, updated.cropName, updated.diseaseName, feedback === 'helpful');
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to save feedback' });
    }
});
// ─── ADMIN: Knowledge Base CRUD ───────────────────────────────────────────────
router.get('/admin/knowledge-base', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search, category, cropName } = req.query;
        const filter = {};
        if (search)
            filter.$or = [
                { cropName: new RegExp(search, 'i') },
                { diseaseName: new RegExp(search, 'i') },
            ];
        if (category)
            filter.cropCategory = new RegExp(category, 'i');
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        const [data, total, totalCrops, totalDiseaseImages, totalHealthyImages, totalScans] = await Promise.all([
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.find(filter).sort({ cropName: 1 }).skip((page - 1) * limit).limit(limit),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments(filter),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.distinct('cropName').then(r => r.length),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.aggregate([{ $project: { count: { $size: '$diseaseImages' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]).then(r => r[0]?.total || 0),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.aggregate([{ $project: { count: { $size: '$healthyImages' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]).then(r => r[0]?.total || 0),
            DiseaseRecommendation_1.DiseaseRecommendation.countDocuments(),
        ]);
        const totalRecords = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments();
        res.json({
            success: true, data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: { totalRecords, totalCrops, totalDiseaseImages, totalHealthyImages, totalRecommendations: totalScans },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch disease records' });
    }
});
router.get('/admin/knowledge-base/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findById(req.params.id);
        if (!record)
            return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, data: record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch record' });
    }
});
const kbUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files allowed'));
    },
});
const kbUploadFields = kbUpload.fields([
    { name: 'diseaseImages', maxCount: 10 },
    { name: 'healthyImages', maxCount: 10 },
    { name: 'imageGallery', maxCount: 20 },
]);
router.post('/admin/knowledge-base', auth_1.authenticate, auth_1.requireAdmin, kbUploadFields, async (req, res) => {
    try {
        const files = req.files;
        const diseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
        const healthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
        const imageGallery = (files?.imageGallery || []).map(f => imgUrl(f.filename));
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.create({
            ...req.body,
            diseaseImages, healthyImages, imageGallery,
            createdBy: req.user?.userId,
        });
        res.status(201).json({ success: true, data: record });
    }
    catch (error) {
        if (error.code === 11000)
            return res.status(400).json({ success: false, error: 'Disease record for this crop already exists' });
        res.status(500).json({ success: false, error: error?.message || 'Failed to create record' });
    }
});
router.put('/admin/knowledge-base/:id', auth_1.authenticate, auth_1.requireAdmin, kbUploadFields, async (req, res) => {
    try {
        const existing = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findById(req.params.id);
        if (!existing)
            return res.status(404).json({ success: false, error: 'Record not found' });
        const files = req.files;
        const newDiseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
        const newHealthyImages = (files?.healthyImages || []).map(f => imgUrl(f.filename));
        const newGallery = (files?.imageGallery || []).map(f => imgUrl(f.filename));
        const updated = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndUpdate(req.params.id, {
            ...req.body,
            diseaseImages: [...(existing.diseaseImages || []), ...newDiseaseImages],
            healthyImages: [...(existing.healthyImages || []), ...newHealthyImages],
            imageGallery: [...(existing.imageGallery || []), ...newGallery],
            updatedBy: req.user?.userId,
        }, { new: true, runValidators: true });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to update record' });
    }
});
router.delete('/admin/knowledge-base/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndDelete(req.params.id);
        if (!record)
            return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, message: 'Record deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to delete record' });
    }
});
// ─── ADMIN: Scan Recommendations list ────────────────────────────────────────
router.get('/admin/recommendations', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const [data, total] = await Promise.all([
            DiseaseRecommendation_1.DiseaseRecommendation.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            DiseaseRecommendation_1.DiseaseRecommendation.countDocuments(),
        ]);
        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch recommendations' });
    }
});
// ─── ADMIN: Disease & Pest Knowledge Management (new dedicated module) ────────
// Uses the same DiseaseKnowledgeBase collection but exposed under a separate
// route prefix so it is completely independent of the existing /admin/knowledge-base routes.
const dkUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => cb(null, `dk-${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files allowed'));
    },
});
const dkUploadFields = dkUpload.fields([
    { name: 'diseaseImages', maxCount: 10 },
    { name: 'referenceImages', maxCount: 10 },
]);
// LIST with search / filter / pagination
router.get('/admin/disease-pest-knowledge', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search, category, severity, status, cropName } = req.query;
        const filter = {};
        if (search)
            filter.$or = [
                { cropName: new RegExp(search, 'i') },
                { diseaseName: new RegExp(search, 'i') },
                { tags: new RegExp(search, 'i') },
            ];
        if (category)
            filter.diseaseType = new RegExp(category, 'i');
        if (severity)
            filter.severityLevel = severity;
        if (status)
            filter.status = status;
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        const [data, total] = await Promise.all([
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments(filter),
        ]);
        const [totalCrops, totalPublished, totalDraft, totalAI] = await Promise.all([
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.distinct('cropName').then(r => r.length),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments({ status: 'published' }),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments({ status: 'draft' }),
            DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments({ source: { $in: ['ai_auto', 'ai_verified'] } }),
        ]);
        res.json({
            success: true,
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: { total: await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.countDocuments(), totalCrops, totalPublished, totalDraft, totalAI },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch records' });
    }
});
// GET single
router.get('/admin/disease-pest-knowledge/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findById(req.params.id).lean();
        if (!record)
            return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, data: record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to fetch record' });
    }
});
// CREATE
router.post('/admin/disease-pest-knowledge', auth_1.authenticate, auth_1.requireAdmin, dkUploadFields, async (req, res) => {
    try {
        // Duplicate check — open update mode hint
        const existing = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findOne({
            cropName: new RegExp(`^${req.body.cropName?.trim()}$`, 'i'),
            diseaseName: new RegExp(`^${req.body.diseaseName?.trim()}$`, 'i'),
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'A record for this Crop + Disease already exists.',
                existingId: existing._id,
            });
        }
        const files = req.files;
        const diseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
        const referenceImages = (files?.referenceImages || []).map(f => imgUrl(f.filename));
        const body = req.body;
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.create({
            cropName: body.cropName?.trim(),
            diseaseName: body.diseaseName?.trim(),
            scientificName: body.scientificName,
            cropCategory: body.cropCategory || 'General',
            diseaseType: body.diseaseType || 'Disease',
            severityLevel: body.severityLevel || 'medium',
            status: body.status || 'draft',
            description: body.description || '',
            symptoms: body.symptoms,
            symptomsDescription: body.symptoms,
            causes: body.causes,
            organicSolution: body.organicSolution,
            organicTreatment: body.organicSolution,
            chemicalSolution: body.chemicalSolution,
            chemicalTreatment: body.chemicalSolution,
            prevention: body.prevention,
            preventionMethods: body.prevention,
            urgentPrevention: body.urgentPrevention,
            recoveryTips: body.recoveryTips,
            dos: body.dos,
            donts: body.donts,
            recommendedProducts: body.recommendedProducts,
            recommendedFertilizer: body.recommendedFertilizer,
            recommendedBioProduct: body.recommendedBioProduct,
            recommendedOrganicProduct: body.recommendedOrganicProduct,
            extraFarmerAdvice: body.extraFarmerAdvice,
            suitableWeather: body.suitableWeather,
            adminNotes: body.adminNotes,
            tags: body.tags ? (Array.isArray(body.tags) ? body.tags : body.tags.split(',').map((t) => t.trim()).filter(Boolean)) : [],
            seoKeywords: body.seoKeywords ? (Array.isArray(body.seoKeywords) ? body.seoKeywords : body.seoKeywords.split(',').map((t) => t.trim()).filter(Boolean)) : [],
            diseaseImages,
            imageGallery: referenceImages,
            healthyImages: [],
            source: 'admin',
            createdBy: req.user?.userId,
        });
        res.status(201).json({ success: true, data: record });
    }
    catch (error) {
        if (error.code === 11000)
            return res.status(409).json({ success: false, error: 'A record for this Crop + Disease already exists.' });
        res.status(500).json({ success: false, error: error?.message || 'Failed to create record' });
    }
});
// UPDATE
router.put('/admin/disease-pest-knowledge/:id', auth_1.authenticate, auth_1.requireAdmin, dkUploadFields, async (req, res) => {
    try {
        const existing = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findById(req.params.id);
        if (!existing)
            return res.status(404).json({ success: false, error: 'Record not found' });
        const files = req.files;
        const newDiseaseImages = (files?.diseaseImages || []).map(f => imgUrl(f.filename));
        const newReferenceImages = (files?.referenceImages || []).map(f => imgUrl(f.filename));
        const body = req.body;
        const parseTags = (v) => v ? (Array.isArray(v) ? v : v.split(',').map((t) => t.trim()).filter(Boolean)) : undefined;
        const updateData = {
            diseaseImages: [...(existing.diseaseImages || []), ...newDiseaseImages],
            imageGallery: [...(existing.imageGallery || []), ...newReferenceImages],
            updatedBy: req.user?.userId,
        };
        const textFields = [
            'cropName', 'diseaseName', 'scientificName', 'cropCategory', 'diseaseType', 'severityLevel', 'status',
            'description', 'symptoms', 'causes', 'organicSolution', 'chemicalSolution', 'prevention',
            'urgentPrevention', 'recoveryTips', 'dos', 'donts', 'recommendedProducts', 'recommendedFertilizer',
            'recommendedBioProduct', 'recommendedOrganicProduct', 'extraFarmerAdvice', 'suitableWeather', 'adminNotes',
        ];
        textFields.forEach(f => { if (body[f] !== undefined)
            updateData[f] = body[f]; });
        // Keep legacy fields in sync
        if (body.symptoms) {
            updateData.symptomsDescription = body.symptoms;
        }
        if (body.organicSolution) {
            updateData.organicTreatment = body.organicSolution;
        }
        if (body.chemicalSolution) {
            updateData.chemicalTreatment = body.chemicalSolution;
        }
        if (body.prevention) {
            updateData.preventionMethods = body.prevention;
        }
        if (body.tags)
            updateData.tags = parseTags(body.tags);
        if (body.seoKeywords)
            updateData.seoKeywords = parseTags(body.seoKeywords);
        const updated = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to update record' });
    }
});
// DELETE single
router.delete('/admin/disease-pest-knowledge/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findByIdAndDelete(req.params.id);
        if (!record)
            return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, message: 'Record deleted' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Failed to delete record' });
    }
});
// BULK DELETE
router.post('/admin/disease-pest-knowledge/bulk-delete', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0)
            return res.status(400).json({ success: false, error: 'ids array required' });
        const result = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, deleted: result.deletedCount });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Bulk delete failed' });
    }
});
// DUPLICATE
router.post('/admin/disease-pest-knowledge/:id/duplicate', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const original = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findById(req.params.id).lean();
        if (!original)
            return res.status(404).json({ success: false, error: 'Record not found' });
        const { _id, slug, createdAt, updatedAt, scanCount, helpfulCount, notHelpfulCount, ...rest } = original;
        const copy = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.create({
            ...rest,
            diseaseName: `${rest.diseaseName} (Copy)`,
            status: 'draft',
            source: 'admin',
            createdBy: req.user?.userId,
            scanCount: 0, helpfulCount: 0, notHelpfulCount: 0,
        });
        res.status(201).json({ success: true, data: copy });
    }
    catch (error) {
        if (error.code === 11000)
            return res.status(409).json({ success: false, error: 'Duplicate already exists' });
        res.status(500).json({ success: false, error: error?.message || 'Duplicate failed' });
    }
});
// EXPORT JSON
router.get('/admin/disease-pest-knowledge/export/json', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { cropName, status } = req.query;
        const filter = {};
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        if (status)
            filter.status = status;
        const data = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.find(filter).lean();
        res.setHeader('Content-Disposition', 'attachment; filename="disease-pest-knowledge.json"');
        res.setHeader('Content-Type', 'application/json');
        res.json({ exportedAt: new Date().toISOString(), count: data.length, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Export failed' });
    }
});
// IMPORT JSON (bulk upsert)
router.post('/admin/disease-pest-knowledge/import/json', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const records = req.body.data || req.body;
        if (!Array.isArray(records) || records.length === 0)
            return res.status(400).json({ success: false, error: 'data array required' });
        let created = 0, updated = 0, errors = 0;
        for (const r of records) {
            if (!r.cropName || !r.diseaseName) {
                errors++;
                continue;
            }
            try {
                const result = await DiseaseKnowledgeBase_1.DiseaseKnowledgeBase.findOneAndUpdate({ cropName: new RegExp(`^${r.cropName.trim()}$`, 'i'), diseaseName: new RegExp(`^${r.diseaseName.trim()}$`, 'i') }, { ...r, updatedBy: req.user?.userId, source: r.source || 'admin' }, { upsert: true, new: true, setDefaultsOnInsert: true });
                if (result) {
                    const isNew = result.__v === 0;
                    isNew ? created++ : updated++;
                }
            }
            catch {
                errors++;
            }
        }
        res.json({ success: true, created, updated, errors, total: records.length });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error?.message || 'Import failed' });
    }
});
exports.default = router;
//# sourceMappingURL=disease.js.map