"use strict";
/**
 * Memory Engine Admin Routes — Phase 5
 *
 * Admin-only endpoints for:
 * - Viewing memory stats per farmer
 * - Managing translation cache
 * - Approving/reviewing voice dataset registrations
 * - Viewing FAQ analytics
 *
 * All existing routes (language-dictionary, disease, soil, etc.) are unchanged.
 * This is a new route file mounted at /api/memory-engine.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const FarmerMemory_1 = require("../models/FarmerMemory");
const TranslationCache_1 = require("../models/TranslationCache");
const translationCacheService_1 = require("../services/translationCacheService");
const voiceDatasetRegistry_1 = require("../services/voiceDatasetRegistry");
const memoryEngine_1 = require("../services/memoryEngine");
const router = express_1.default.Router();
// ─── All routes require authentication ───────────────────────────────────────
router.use(auth_1.authenticate);
// ─── Farmer: get own memory summary ──────────────────────────────────────────
// GET /api/memory-engine/my-memory
router.get('/my-memory', async (req, res) => {
    try {
        const memory = await FarmerMemory_1.FarmerMemory.findOne({ userId: req.user.userId })
            .select('preferences totalInteractions lastInteractionAt faqEntries voiceDatasetRefs')
            .lean();
        if (!memory) {
            return res.json({ success: true, data: null, message: 'No memory stored yet' });
        }
        res.json({
            success: true,
            data: {
                preferences: memory.preferences,
                totalInteractions: memory.totalInteractions,
                lastInteractionAt: memory.lastInteractionAt,
                topFAQs: [...(memory.faqEntries || [])]
                    .sort((a, b) => b.askedCount - a.askedCount)
                    .slice(0, 10),
                voiceDatasets: memory.voiceDatasetRefs,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/memory-engine/my-memory/language
// Body: { langCode: 'hi', dialectCode?: 'mwr' }
router.patch('/my-memory/language', async (req, res) => {
    try {
        const { langCode, dialectCode } = req.body;
        if (!langCode)
            return res.status(400).json({ error: 'langCode is required' });
        await (0, memoryEngine_1.updateLanguagePreference)(req.user.userId, langCode, dialectCode);
        res.json({ success: true, message: 'Language preference updated in memory' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// DELETE /api/memory-engine/my-memory/history
// Clears conversation history only (not preferences or FAQs)
router.delete('/my-memory/history', async (req, res) => {
    try {
        await FarmerMemory_1.FarmerMemory.updateOne({ userId: req.user.userId }, { $set: { conversationHistory: [] } });
        res.json({ success: true, message: 'Conversation history cleared' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ─── Admin-only routes ────────────────────────────────────────────────────────
router.use(auth_1.requireAdmin);
// GET /api/memory-engine/admin/stats
router.get('/admin/stats', async (req, res) => {
    try {
        const [totalFarmers, totalInteractions, cacheStats] = await Promise.all([
            FarmerMemory_1.FarmerMemory.countDocuments(),
            FarmerMemory_1.FarmerMemory.aggregate([
                { $group: { _id: null, total: { $sum: '$totalInteractions' } } },
            ]).then(r => r[0]?.total || 0),
            (0, translationCacheService_1.getCacheStats)(),
        ]);
        // Top FAQ across all farmers
        const topFAQs = await FarmerMemory_1.FarmerMemory.aggregate([
            { $unwind: '$faqEntries' },
            { $group: { _id: '$faqEntries.normalizedKey', totalAsked: { $sum: '$faqEntries.askedCount' }, question: { $first: '$faqEntries.question' } } },
            { $sort: { totalAsked: -1 } },
            { $limit: 10 },
        ]);
        // Language distribution
        const langDist = await FarmerMemory_1.FarmerMemory.aggregate([
            { $group: { _id: '$preferences.selectedLang', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        res.json({
            success: true,
            data: {
                totalFarmers,
                totalInteractions,
                translationCache: cacheStats,
                topFAQs,
                languageDistribution: langDist,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/memory-engine/admin/farmers?page=1&limit=20
router.get('/admin/farmers', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const [data, total] = await Promise.all([
            FarmerMemory_1.FarmerMemory.find()
                .select('userId preferences totalInteractions lastInteractionAt')
                .sort({ lastInteractionAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            FarmerMemory_1.FarmerMemory.countDocuments(),
        ]);
        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/memory-engine/admin/farmers/:userId
router.get('/admin/farmers/:userId', async (req, res) => {
    try {
        const memory = await FarmerMemory_1.FarmerMemory.findOne({ userId: req.params.userId }).lean();
        if (!memory)
            return res.status(404).json({ error: 'No memory found for this farmer' });
        res.json({ success: true, data: memory });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ─── Translation cache management ────────────────────────────────────────────
// GET /api/memory-engine/admin/translation-cache/stats
router.get('/admin/translation-cache/stats', async (req, res) => {
    try {
        const stats = await (0, translationCacheService_1.getCacheStats)();
        res.json({ success: true, data: stats });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// DELETE /api/memory-engine/admin/translation-cache/l1
// Clears in-process L1 cache only
router.delete('/admin/translation-cache/l1', async (req, res) => {
    (0, translationCacheService_1.clearL1Cache)();
    res.json({ success: true, message: 'L1 in-process translation cache cleared' });
});
// DELETE /api/memory-engine/admin/translation-cache/entry
// Body: { sourceText, targetLang }
router.delete('/admin/translation-cache/entry', async (req, res) => {
    try {
        const { sourceText, targetLang } = req.body;
        if (!sourceText || !targetLang)
            return res.status(400).json({ error: 'sourceText and targetLang required' });
        await (0, translationCacheService_1.invalidateCacheEntry)(sourceText, targetLang);
        res.json({ success: true, message: 'Cache entry invalidated' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/memory-engine/admin/translation-cache?page=1&limit=20
router.get('/admin/translation-cache', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const lang = req.query.lang;
        const filter = {};
        if (lang)
            filter.targetLang = lang;
        const [data, total] = await Promise.all([
            TranslationCache_1.TranslationCache.find(filter)
                .sort({ hitCount: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            TranslationCache_1.TranslationCache.countDocuments(filter),
        ]);
        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ─── Voice dataset management ─────────────────────────────────────────────────
// PATCH /api/memory-engine/admin/voice-datasets/:userId/:datasetId
// Body: { status: 'pending_review' | 'approved' }
router.patch('/admin/voice-datasets/:userId/:datasetId', async (req, res) => {
    try {
        const { userId, datasetId } = req.params;
        const { status } = req.body;
        if (!['registered', 'pending_review', 'approved'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const updated = await (0, voiceDatasetRegistry_1.updateDatasetStatus)(userId, datasetId, status);
        if (!updated)
            return res.status(404).json({ error: 'Dataset not found' });
        res.json({ success: true, message: `Dataset status updated to ${status}` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=memoryEngine.js.map