"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const LanguageDictionary_1 = require("../models/LanguageDictionary");
const DictionaryReviewQueue_1 = require("../models/DictionaryReviewQueue");
const languageDictionaryService_1 = require("../services/languageDictionaryService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// ─── Public: lookup ───────────────────────────────────────────────────────────
// GET /api/language-dictionary/lookup?term=BlackGram&lang=hi&ctx=disease
router.get('/lookup', async (req, res) => {
    const { term, lang = 'en', ctx } = req.query;
    if (!term)
        return res.status(400).json({ error: 'term is required' });
    try {
        const result = await (0, languageDictionaryService_1.lookupTerm)(term, lang, ctx);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/language-dictionary/lookup-batch
router.post('/lookup-batch', async (req, res) => {
    const { terms, lang = 'en', ctx } = req.body;
    if (!Array.isArray(terms) || terms.length === 0)
        return res.status(400).json({ error: 'terms array required' });
    try {
        const results = await (0, languageDictionaryService_1.lookupTerms)(terms, lang, ctx);
        res.json({ success: true, data: results });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ─── Admin: dictionary CRUD ───────────────────────────────────────────────────
router.use(auth_1.authenticate, auth_1.requireAdmin);
// GET /api/language-dictionary?category=crops&approved=true&page=1&limit=20
router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const filter = {};
    if (req.query.category)
        filter.category = req.query.category;
    if (req.query.approved !== undefined)
        filter.approved = req.query.approved === 'true';
    if (req.query.search)
        filter.normalizedKey = new RegExp((0, languageDictionaryService_1.normalizeKey)(req.query.search), 'i');
    const [data, total] = await Promise.all([
        LanguageDictionary_1.LanguageDictionary.find(filter).sort({ normalizedKey: 1 }).skip((page - 1) * limit).limit(limit),
        LanguageDictionary_1.LanguageDictionary.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});
// POST /api/language-dictionary
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        body.normalizedKey = (0, languageDictionaryService_1.normalizeKey)(body.english || body.normalizedKey || '');
        if (body.aliases)
            body.aliases = body.aliases.map(languageDictionaryService_1.normalizeKey);
        const entry = await LanguageDictionary_1.LanguageDictionary.create(body);
        res.status(201).json({ success: true, data: entry });
    }
    catch (err) {
        if (err.code === 11000)
            return res.status(400).json({ error: 'Entry with this key already exists' });
        res.status(500).json({ error: err.message });
    }
});
// PUT /api/language-dictionary/:id
router.put('/:id', async (req, res) => {
    try {
        const body = req.body;
        if (body.english)
            body.normalizedKey = (0, languageDictionaryService_1.normalizeKey)(body.english);
        if (body.aliases)
            body.aliases = body.aliases.map(languageDictionaryService_1.normalizeKey);
        const entry = await LanguageDictionary_1.LanguageDictionary.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
        if (!entry)
            return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// DELETE /api/language-dictionary/:id
router.delete('/:id', async (req, res) => {
    const entry = await LanguageDictionary_1.LanguageDictionary.findByIdAndDelete(req.params.id);
    if (!entry)
        return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, message: 'Deleted' });
});
// ─── Admin: review queue ──────────────────────────────────────────────────────
// GET /api/language-dictionary/review-queue?status=pending
router.get('/review-queue', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const status = req.query.status || 'pending';
    const [data, total] = await Promise.all([
        DictionaryReviewQueue_1.DictionaryReviewQueue.find({ status }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        DictionaryReviewQueue_1.DictionaryReviewQueue.countDocuments({ status }),
    ]);
    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});
// POST /api/language-dictionary/review-queue/:id/approve
// Body: full dictionary entry fields (english, hindi, category, …)
router.post('/review-queue/:id/approve', async (req, res) => {
    try {
        const queueItem = await DictionaryReviewQueue_1.DictionaryReviewQueue.findById(req.params.id);
        if (!queueItem)
            return res.status(404).json({ error: 'Queue item not found' });
        const body = req.body;
        body.normalizedKey = queueItem.normalizedKey;
        if (body.aliases)
            body.aliases = body.aliases.map(languageDictionaryService_1.normalizeKey);
        else
            body.aliases = [(0, languageDictionaryService_1.normalizeKey)(queueItem.rawInput)];
        const entry = await LanguageDictionary_1.LanguageDictionary.findOneAndUpdate({ normalizedKey: queueItem.normalizedKey }, { ...body, approved: true }, { upsert: true, new: true, runValidators: true });
        await DictionaryReviewQueue_1.DictionaryReviewQueue.findByIdAndUpdate(req.params.id, {
            status: 'approved',
            reviewedBy: req.user?.userId,
            reviewNote: req.body.reviewNote,
        });
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/language-dictionary/review-queue/:id/reject
router.post('/review-queue/:id/reject', async (req, res) => {
    const queueItem = await DictionaryReviewQueue_1.DictionaryReviewQueue.findByIdAndUpdate(req.params.id, { status: 'rejected', reviewedBy: req.user?.userId, reviewNote: req.body.reviewNote }, { new: true });
    if (!queueItem)
        return res.status(404).json({ error: 'Queue item not found' });
    res.json({ success: true, data: queueItem });
});
// POST /api/language-dictionary/review-queue/:id/merge
// Body: { targetId: "<existing dictionary entry id>", aliases?: string[] }
router.post('/review-queue/:id/merge', async (req, res) => {
    try {
        const queueItem = await DictionaryReviewQueue_1.DictionaryReviewQueue.findById(req.params.id);
        if (!queueItem)
            return res.status(404).json({ error: 'Queue item not found' });
        const { targetId, aliases = [] } = req.body;
        const target = await LanguageDictionary_1.LanguageDictionary.findById(targetId);
        if (!target)
            return res.status(404).json({ error: 'Target dictionary entry not found' });
        // Merge raw input + any provided aliases into target
        const newAliases = [(0, languageDictionaryService_1.normalizeKey)(queueItem.rawInput), ...aliases.map(languageDictionaryService_1.normalizeKey)];
        const merged = Array.from(new Set([...target.aliases, ...newAliases]));
        await LanguageDictionary_1.LanguageDictionary.findByIdAndUpdate(targetId, { aliases: merged });
        await DictionaryReviewQueue_1.DictionaryReviewQueue.findByIdAndUpdate(req.params.id, {
            status: 'merged',
            mergeTargetId: targetId,
            reviewedBy: req.user?.userId,
            reviewNote: req.body.reviewNote,
        });
        res.json({ success: true, message: 'Merged into existing entry', mergedAliases: merged });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=languageDictionary.js.map