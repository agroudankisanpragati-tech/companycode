"use strict";
/**
 * Language Engine Routes
 * Handles term lookup, batch lookup, and admin dictionary management.
 * All existing routes are untouched — this is a new /api/language-engine mount.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const LanguageDictionary_1 = require("../models/LanguageDictionary");
const DictionaryReviewQueue_1 = require("../models/DictionaryReviewQueue");
const languageDictionaryService_1 = require("../services/languageDictionaryService");
const speechTranslationPipeline_1 = require("../services/speechTranslationPipeline");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// ─── Public: detect language from text ──────────────────────────────────────
router.post('/detect-language', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text)
            return res.status(400).json({ error: 'text is required' });
        const detected = (0, speechTranslationPipeline_1.detectLanguageFromText)(text);
        res.json({ success: true, data: { detectedLang: detected } });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Detection failed' });
    }
});
// ─── Public: full speech translation pipeline (single input) ─────────────────
router.post('/pipeline', async (req, res) => {
    try {
        const { rawText, appLangCode = 'en', pageContext } = req.body;
        if (!rawText)
            return res.status(400).json({ error: 'rawText is required' });
        const result = await (0, speechTranslationPipeline_1.runSpeechTranslationPipeline)({ rawText, appLangCode, pageContext });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Pipeline failed' });
    }
});
// ─── Public: batch pipeline ───────────────────────────────────────────────────
router.post('/pipeline-batch', async (req, res) => {
    try {
        const { inputs } = req.body;
        if (!Array.isArray(inputs) || inputs.length === 0) {
            return res.status(400).json({ error: 'inputs array is required' });
        }
        const results = await (0, speechTranslationPipeline_1.runBatchPipeline)(inputs.map(i => ({ rawText: i.rawText, appLangCode: i.appLangCode || 'en', pageContext: i.pageContext })));
        res.json({ success: true, data: results });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Batch pipeline failed' });
    }
});
// ─── Public: translate English output → display language ─────────────────────
router.post('/translate-output', async (req, res) => {
    try {
        const { englishText, appLangCode = 'en' } = req.body;
        if (!englishText)
            return res.status(400).json({ error: 'englishText is required' });
        const result = await (0, speechTranslationPipeline_1.translateOutputForDisplay)(englishText, appLangCode);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Translation failed' });
    }
});
// ─── Admin: cache stats + clear ──────────────────────────────────────────────
router.get('/cache-stats', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    res.json({ success: true, data: { cacheSize: (0, speechTranslationPipeline_1.getCacheSize)() } });
});
router.delete('/cache', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    (0, speechTranslationPipeline_1.clearTranslationCache)();
    res.json({ success: true, message: 'Translation cache cleared' });
});
// ─── Public: single term lookup ───────────────────────────────────────────────
router.get('/lookup', async (req, res) => {
    try {
        const { term, lang = 'en', ctx } = req.query;
        if (!term)
            return res.status(400).json({ error: 'term is required' });
        const result = await (0, languageDictionaryService_1.lookupTerm)(term, lang, ctx);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lookup failed' });
    }
});
// ─── Public: batch lookup ─────────────────────────────────────────────────────
router.post('/lookup-batch', async (req, res) => {
    try {
        const { terms, lang = 'en', ctx } = req.body;
        if (!Array.isArray(terms) || terms.length === 0) {
            return res.status(400).json({ error: 'terms array is required' });
        }
        const results = await (0, languageDictionaryService_1.lookupTerms)(terms, lang, ctx);
        res.json({ success: true, data: results });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Batch lookup failed' });
    }
});
// ─── Admin: list dictionary entries ──────────────────────────────────────────
router.get('/dictionary', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const { search, category, approved } = req.query;
        const filter = {};
        if (search)
            filter.$or = [{ normalizedKey: new RegExp((0, languageDictionaryService_1.normalizeKey)(search), 'i') }, { english: new RegExp(search, 'i') }];
        if (category)
            filter.category = category;
        if (approved !== undefined)
            filter.approved = approved === 'true';
        const [data, total] = await Promise.all([
            LanguageDictionary_1.LanguageDictionary.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            LanguageDictionary_1.LanguageDictionary.countDocuments(filter),
        ]);
        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch dictionary' });
    }
});
// ─── Admin: create dictionary entry ──────────────────────────────────────────
router.post('/dictionary', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const body = req.body;
        body.normalizedKey = (0, languageDictionaryService_1.normalizeKey)(body.english || body.normalizedKey || '');
        const entry = new LanguageDictionary_1.LanguageDictionary(body);
        await entry.save();
        res.status(201).json({ success: true, data: entry });
    }
    catch (err) {
        if (err.code === 11000)
            return res.status(400).json({ error: 'Entry with this key already exists' });
        res.status(500).json({ error: err.message || 'Failed to create entry' });
    }
});
// ─── Admin: update dictionary entry (translations + aliases) ─────────────────
router.put('/dictionary/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const updated = await LanguageDictionary_1.LanguageDictionary.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true, runValidators: true });
        if (!updated)
            return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to update entry' });
    }
});
// ─── Admin: delete dictionary entry ──────────────────────────────────────────
router.delete('/dictionary/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const deleted = await LanguageDictionary_1.LanguageDictionary.findByIdAndDelete(req.params.id);
        if (!deleted)
            return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true, message: 'Entry deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete entry' });
    }
});
// ─── Admin: list review queue ─────────────────────────────────────────────────
router.get('/review-queue', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const status = req.query.status || 'pending';
        const [data, total] = await Promise.all([
            DictionaryReviewQueue_1.DictionaryReviewQueue.find({ status }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            DictionaryReviewQueue_1.DictionaryReviewQueue.countDocuments({ status }),
        ]);
        const pendingCount = await DictionaryReviewQueue_1.DictionaryReviewQueue.countDocuments({ status: 'pending' });
        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) }, pendingCount });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch review queue' });
    }
});
// ─── Admin: approve queue item → create dictionary entry ─────────────────────
router.post('/review-queue/:id/approve', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const item = await DictionaryReviewQueue_1.DictionaryReviewQueue.findById(req.params.id);
        if (!item)
            return res.status(404).json({ error: 'Queue item not found' });
        const { english, hindi, category, ...translations } = req.body;
        const entry = await LanguageDictionary_1.LanguageDictionary.findOneAndUpdate({ normalizedKey: item.normalizedKey }, {
            $setOnInsert: { normalizedKey: item.normalizedKey },
            $set: { english: english || item.rawInput, hindi: hindi || item.rawInput, category: category || item.pageContext || 'agriculture', approved: true, ...translations },
            $addToSet: { aliases: item.rawInput },
        }, { upsert: true, new: true });
        item.status = 'approved';
        item.reviewedBy = req.user?.id;
        item.reviewNote = req.body.reviewNote;
        await item.save();
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to approve item' });
    }
});
// ─── Admin: reject queue item ─────────────────────────────────────────────────
router.post('/review-queue/:id/reject', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const item = await DictionaryReviewQueue_1.DictionaryReviewQueue.findById(req.params.id);
        if (!item)
            return res.status(404).json({ error: 'Queue item not found' });
        item.status = 'rejected';
        item.reviewedBy = req.user?.id;
        item.reviewNote = req.body.reviewNote;
        await item.save();
        res.json({ success: true, message: 'Item rejected' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to reject item' });
    }
});
// ─── Admin: merge queue item as alias into existing entry ─────────────────────
router.post('/review-queue/:id/merge', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const item = await DictionaryReviewQueue_1.DictionaryReviewQueue.findById(req.params.id);
        if (!item)
            return res.status(404).json({ error: 'Queue item not found' });
        const { targetId } = req.body;
        if (!targetId)
            return res.status(400).json({ error: 'targetId is required' });
        const target = await LanguageDictionary_1.LanguageDictionary.findByIdAndUpdate(targetId, { $addToSet: { aliases: { $each: [item.rawInput, item.normalizedKey] } } }, { new: true });
        if (!target)
            return res.status(404).json({ error: 'Target dictionary entry not found' });
        item.status = 'merged';
        item.mergeTargetId = target._id;
        item.reviewedBy = req.user?.id;
        item.reviewNote = req.body.reviewNote;
        await item.save();
        res.json({ success: true, data: target });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to merge item' });
    }
});
exports.default = router;
//# sourceMappingURL=languageEngine.js.map