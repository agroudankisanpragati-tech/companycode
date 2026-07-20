"use strict";
/**
 * Pragati AI Routes
 *
 * Unified AI endpoint that accepts text, voice, and image requests
 * from the website. Automatically detects request type, enriches
 * context with farmer/farm/crop profiles, routes through the
 * Pragati AI Controller, persists results to MongoDB, and returns
 * structured responses.
 *
 * Routes:
 *   POST /api/pragati-ai/text          — text query
 *   POST /api/pragati-ai/voice         — voice upload
 *   POST /api/pragati-ai/image         — image upload (disease detection)
 *   GET  /api/pragati-ai/history       — conversation history
 *   GET  /api/pragati-ai/health        — AI module health
 *   GET  /api/pragati-ai/status        — AI module status (admin)
 *   DELETE /api/pragati-ai/session/:id — end session
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const FarmerProfileData_1 = require("../models/FarmerProfileData");
const MyCrop_1 = require("../models/MyCrop");
const FarmerMemory_1 = require("../models/FarmerMemory");
const AIConversation_1 = require("../models/AIConversation");
const DiseaseRecommendation_1 = require("../models/DiseaseRecommendation");
const pragatiAIService_1 = require("../services/pragatiAIService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const log = (0, logger_1.createLogger)('pragatiAI');
// ---------------------------------------------------------------------------
// Normalize Python bridge snake_case → camelCase
// ---------------------------------------------------------------------------
function normalizeAIResponse(raw) {
    return {
        ...raw,
        sessionId: raw.sessionId || raw.session_id || '',
        farmerId: raw.farmerId || raw.farmer_id || '',
        moduleId: raw.moduleId || raw.module_id || '',
        responseText: raw.responseText || raw.response_text || '',
        responseAudio: raw.responseAudio || raw.response_audio || undefined,
        fallbackReason: raw.fallbackReason || raw.fallback_reason || '',
        metrics: raw.metrics ? {
            totalMs: raw.metrics.total_ms ?? raw.metrics.totalMs,
            sttMs: raw.metrics.stt_ms ?? raw.metrics.sttMs,
            intentMs: raw.metrics.intent_ms ?? raw.metrics.intentMs,
            routerMs: raw.metrics.router_ms ?? raw.metrics.routerMs,
            ttsMs: raw.metrics.tts_ms ?? raw.metrics.ttsMs,
            inferenceMs: raw.metrics.inference_ms ?? raw.metrics.inferenceMs,
            knowledgeMs: raw.metrics.knowledge_ms ?? raw.metrics.knowledgeMs,
        } : undefined,
    };
}
// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------
const aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Please wait a moment.' },
    skip: () => process.env.NODE_ENV === 'development',
});
// ---------------------------------------------------------------------------
// Multer — temp storage for voice and image uploads
// ---------------------------------------------------------------------------
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'ai_temp');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ts = Date.now();
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${ts}${ext}`);
    },
});
const audioFilter = (_req, file, cb) => {
    const allowed = new Set(['.wav', '.flac', '.ogg', '.mp3', '.m4a', '.aac', '.opus']);
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (allowed.has(ext) || file.mimetype.startsWith('audio/')) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported audio format: ${ext}`));
    }
};
const imageFilter = (_req, file, cb) => {
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif']);
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (allowed.has(ext) || file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported image format: ${ext}`));
    }
};
const uploadAudio = (0, multer_1.default)({ storage, fileFilter: audioFilter, limits: { fileSize: 25 * 1024 * 1024 } });
const uploadImage = (0, multer_1.default)({ storage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function buildFarmerContext(userId) {
    try {
        const [user, profile, crops] = await Promise.all([
            User_1.User.findById(userId).select('name location farmSize soilType crops').lean(),
            FarmerProfileData_1.FarmerProfileData.findOne({ userId }).select('district state soilType totalArea farmingType waterAvailability cropHistory').lean(),
            MyCrop_1.MyCrop.find({ userId, status: 'active' }).select('cropName category').limit(10).lean(),
        ]);
        const u = user;
        const p = profile;
        return {
            name: u?.name,
            district: p?.district || u?.location?.district,
            state: p?.state || u?.location?.state,
            soilType: p?.soilType || u?.soilType,
            farmSize: p?.totalArea || u?.farmSize,
            cropNames: crops.map((c) => c.cropName),
        };
    }
    catch {
        return {};
    }
}
function cleanupFile(filePath) {
    if (!filePath)
        return;
    try {
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
    }
    catch { /* non-critical */ }
}
async function persistConversation(userId, sessionId, inputType, aiResponse, farmerContext, extras = {}) {
    try {
        const metrics = aiResponse.metrics || {};
        await AIConversation_1.AIConversation.create({
            userId,
            sessionId,
            inputType,
            inputText: extras.inputText,
            inputAudioUrl: extras.inputAudioUrl,
            inputImageUrl: extras.inputImageUrl,
            status: aiResponse.success ? (aiResponse.status || 'success') : 'error',
            intent: aiResponse.intent,
            confidence: aiResponse.confidence,
            moduleId: aiResponse.moduleId,
            language: aiResponse.language,
            responseText: aiResponse.responseText,
            responseAudioUrl: aiResponse.responseAudio,
            imageAnalysis: inputType === 'image' ? buildImageAnalysis(aiResponse) : undefined,
            knowledgeData: aiResponse.knowledge || undefined,
            suggestions: aiResponse.suggestions || [],
            metrics: {
                totalMs: metrics.totalMs,
                sttMs: metrics.sttMs,
                intentMs: metrics.intentMs,
                routerMs: metrics.routerMs,
                ttsMs: metrics.ttsMs,
                inferenceMs: metrics.inferenceMs,
                knowledgeMs: metrics.knowledgeMs,
            },
            error: aiResponse.error,
            fallbackReason: aiResponse.fallbackReason,
            farmerContext,
        });
    }
    catch (err) {
        log.warn('persistConversation failed (non-fatal)', { error: err?.message });
    }
}
function buildImageAnalysis(aiResponse) {
    const data = aiResponse.data;
    if (!data)
        return undefined;
    return {
        crop: data.crop,
        className: data.class_name,
        category: data.category,
        confidence: data.confidence,
        top5: (data.top5 || []).map((t) => ({
            rank: t.rank,
            className: t.class_name,
            confidence: t.confidence,
        })),
    };
}
async function persistDiseaseRecommendation(userId, aiResponse, imageUrl) {
    try {
        const data = aiResponse.data;
        const knowledge = aiResponse.knowledge;
        if (!data?.class_name)
            return;
        await DiseaseRecommendation_1.DiseaseRecommendation.create({
            userId,
            cropName: data.crop || 'Unknown',
            diseaseName: data.class_name,
            diseaseType: data.category || '',
            severityLevel: knowledge?.severity || '',
            symptoms: knowledge?.symptoms || '',
            organicTreatment: knowledge?.organic_treatment || '',
            chemicalTreatment: knowledge?.chemical_treatment || '',
            treatment: knowledge?.treatment || aiResponse.responseText || '',
            prevention: knowledge?.prevention || '',
            description: knowledge?.description || aiResponse.responseText || '',
            confidenceScore: data.confidence,
            imageUrl: imageUrl,
            source: 'yolo',
        });
    }
    catch (err) {
        log.warn('persistDiseaseRecommendation failed (non-fatal)', { error: err?.message });
    }
}
async function updateFarmerMemory(userId, inputText, aiReply, langCode, intent) {
    try {
        const turn = {
            role: 'user',
            content: inputText,
            timestamp: new Date(),
            langCode,
            agentUsed: intent,
        };
        const replyTurn = {
            role: 'assistant',
            content: aiReply,
            timestamp: new Date(),
            langCode,
            agentUsed: intent,
        };
        await FarmerMemory_1.FarmerMemory.findOneAndUpdate({ userId }, {
            $push: {
                conversationHistory: {
                    $each: [turn, replyTurn],
                    $slice: -100,
                },
            },
            $inc: { totalInteractions: 1 },
            $set: { lastInteractionAt: new Date() },
        }, { upsert: true, new: true });
    }
    catch (err) {
        log.warn('updateFarmerMemory failed (non-fatal)', { error: err?.message });
    }
}
// ---------------------------------------------------------------------------
// POST /api/pragati-ai/text
// ---------------------------------------------------------------------------
router.post('/text', auth_1.authenticate, aiLimiter, async (req, res) => {
    const userId = req.user.userId;
    const { text, sessionId, language, synthesizeAudio = false, extra, } = req.body;
    if (!text?.trim()) {
        return res.status(400).json({ success: false, error: 'text field is required' });
    }
    const farmerContext = await buildFarmerContext(userId);
    const aiResponse = normalizeAIResponse(await (0, pragatiAIService_1.processText)({
        text,
        sessionId,
        farmerId: userId,
        farmerName: farmerContext.name,
        language: language || 'hi',
        synthesizeAudio: synthesizeAudio,
        extra,
    }));
    const sid = aiResponse.sessionId || sessionId || '';
    setImmediate(async () => {
        await persistConversation(userId, sid, 'text', aiResponse, farmerContext, { inputText: text });
        await updateFarmerMemory(userId, text, aiResponse.responseText || '', aiResponse.language || language || 'hi', aiResponse.intent);
    });
    log.info('text request processed', {
        userId,
        intent: aiResponse.intent,
        success: aiResponse.success,
        ms: aiResponse.metrics?.totalMs,
    });
    return res.json({
        success: aiResponse.success,
        sessionId: sid,
        pipeline: 'text',
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        language: aiResponse.language,
        responseText: aiResponse.responseText,
        suggestions: aiResponse.suggestions || [],
        moduleId: aiResponse.moduleId,
        metrics: aiResponse.metrics,
        error: aiResponse.error,
        timestamp: aiResponse.timestamp || new Date().toISOString(),
    });
});
// ---------------------------------------------------------------------------
// POST /api/pragati-ai/voice
// ---------------------------------------------------------------------------
router.post('/voice', auth_1.authenticate, aiLimiter, uploadAudio.single('audio'), async (req, res) => {
    const userId = req.user.userId;
    const file = req.file;
    if (!file) {
        return res.status(400).json({ success: false, error: 'audio file is required' });
    }
    const { sessionId, language, synthesizeAudio = 'true', } = req.body;
    const farmerContext = await buildFarmerContext(userId);
    let aiResponse;
    try {
        aiResponse = normalizeAIResponse(await (0, pragatiAIService_1.processVoice)({
            audioPath: file.path,
            sessionId,
            farmerId: userId,
            farmerName: farmerContext.name,
            language,
            synthesizeAudio: synthesizeAudio !== 'false',
        }));
    }
    finally {
        cleanupFile(file.path);
    }
    const sid = aiResponse.sessionId || sessionId || '';
    setImmediate(async () => {
        await persistConversation(userId, sid, 'voice', aiResponse, farmerContext, {
            inputText: aiResponse.responseText ? `[voice transcript]` : undefined,
            inputAudioUrl: file.filename,
        });
        if (aiResponse.responseText) {
            await updateFarmerMemory(userId, '[voice input]', aiResponse.responseText, aiResponse.language || language || 'hi', aiResponse.intent);
        }
    });
    log.info('voice request processed', {
        userId,
        intent: aiResponse.intent,
        success: aiResponse.success,
        ms: aiResponse.metrics?.totalMs,
    });
    return res.json({
        success: aiResponse.success,
        sessionId: sid,
        pipeline: 'voice',
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        language: aiResponse.language,
        responseText: aiResponse.responseText,
        responseAudio: aiResponse.responseAudio,
        suggestions: aiResponse.suggestions || [],
        moduleId: aiResponse.moduleId,
        metrics: aiResponse.metrics,
        error: aiResponse.error,
        timestamp: aiResponse.timestamp || new Date().toISOString(),
    });
});
// ---------------------------------------------------------------------------
// POST /api/pragati-ai/image
// ---------------------------------------------------------------------------
router.post('/image', auth_1.authenticate, aiLimiter, uploadImage.single('image'), async (req, res) => {
    const userId = req.user.userId;
    const file = req.file;
    if (!file) {
        return res.status(400).json({ success: false, error: 'image file is required' });
    }
    const { sessionId, language, } = req.body;
    const farmerContext = await buildFarmerContext(userId);
    let aiResponse;
    try {
        aiResponse = normalizeAIResponse(await (0, pragatiAIService_1.processImage)({
            imagePath: file.path,
            sessionId,
            farmerId: userId,
            language,
        }));
    }
    finally {
        cleanupFile(file.path);
    }
    const sid = aiResponse.sessionId || sessionId || '';
    setImmediate(async () => {
        await persistConversation(userId, sid, 'image', aiResponse, farmerContext, {
            inputImageUrl: file.filename,
        });
        await persistDiseaseRecommendation(userId, aiResponse, file.filename);
        if (aiResponse.responseText) {
            await updateFarmerMemory(userId, '[image analysis]', aiResponse.responseText, aiResponse.language || language || 'hi', 'disease');
        }
    });
    log.info('image request processed', {
        userId,
        intent: aiResponse.intent,
        success: aiResponse.success,
        ms: aiResponse.metrics?.totalMs,
    });
    return res.json({
        success: aiResponse.success,
        sessionId: sid,
        pipeline: 'image',
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        language: aiResponse.language,
        responseText: aiResponse.responseText,
        imageAnalysis: buildImageAnalysis(aiResponse),
        knowledge: aiResponse.knowledge,
        suggestions: aiResponse.suggestions || [],
        moduleId: aiResponse.moduleId,
        metrics: aiResponse.metrics,
        error: aiResponse.error,
        timestamp: aiResponse.timestamp || new Date().toISOString(),
    });
});
// ---------------------------------------------------------------------------
// GET /api/pragati-ai/history
// ---------------------------------------------------------------------------
router.get('/history', auth_1.authenticate, async (req, res) => {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const type = req.query.type;
    const skip = parseInt(req.query.skip || '0', 10);
    try {
        const filter = { userId };
        if (type && ['text', 'voice', 'image'].includes(type)) {
            filter.inputType = type;
        }
        const [conversations, total] = await Promise.all([
            AIConversation_1.AIConversation.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v')
                .lean(),
            AIConversation_1.AIConversation.countDocuments(filter),
        ]);
        return res.json({
            success: true,
            conversations,
            total,
            limit,
            skip,
        });
    }
    catch (err) {
        log.error('history fetch failed', { error: err?.message });
        return res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});
// ---------------------------------------------------------------------------
// GET /api/pragati-ai/health
// ---------------------------------------------------------------------------
router.get('/health', auth_1.authenticate, async (_req, res) => {
    const health = await (0, pragatiAIService_1.getAIHealth)();
    if (!health) {
        return res.status(503).json({
            success: false,
            status: 'unavailable',
            error: 'Pragati AI Bridge is not reachable. Ensure fastapi_bridge.py is running on port 8001.',
        });
    }
    return res.json({ success: true, ...health });
});
// ---------------------------------------------------------------------------
// GET /api/pragati-ai/status  (admin only)
// ---------------------------------------------------------------------------
router.get('/status', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    const status = await (0, pragatiAIService_1.getAIStatus)();
    if (!status) {
        return res.status(503).json({
            success: false,
            error: 'Pragati AI Bridge is not reachable',
        });
    }
    return res.json({ success: true, ...status });
});
// ---------------------------------------------------------------------------
// DELETE /api/pragati-ai/session/:sessionId
// ---------------------------------------------------------------------------
router.delete('/session/:sessionId', auth_1.authenticate, async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    await (0, pragatiAIService_1.endAISession)(sessionId);
    return res.json({ success: true, sessionId });
});
// ---------------------------------------------------------------------------
// GET /api/pragati-ai/stats  — per-user AI usage stats
// ---------------------------------------------------------------------------
router.get('/stats', auth_1.authenticate, async (req, res) => {
    const userId = req.user.userId;
    try {
        const [total, byType, recentIntents] = await Promise.all([
            AIConversation_1.AIConversation.countDocuments({ userId }),
            AIConversation_1.AIConversation.aggregate([
                { $match: { userId } },
                { $group: { _id: '$inputType', count: { $sum: 1 } } },
            ]),
            AIConversation_1.AIConversation.find({ userId, intent: { $exists: true, $ne: '' } })
                .sort({ createdAt: -1 })
                .limit(20)
                .select('intent createdAt')
                .lean(),
        ]);
        const typeMap = {};
        for (const b of byType)
            typeMap[b._id] = b.count;
        return res.json({
            success: true,
            stats: {
                total,
                byType: {
                    text: typeMap['text'] || 0,
                    voice: typeMap['voice'] || 0,
                    image: typeMap['image'] || 0,
                },
                recentIntents: recentIntents.map((r) => ({
                    intent: r.intent,
                    createdAt: r.createdAt,
                })),
            },
        });
    }
    catch (err) {
        log.error('stats fetch failed', { error: err?.message });
        return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});
exports.default = router;
//# sourceMappingURL=pragatiAI.js.map