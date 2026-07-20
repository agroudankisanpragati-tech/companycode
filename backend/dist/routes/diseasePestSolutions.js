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
const DiseasePestSolution_1 = require("../models/DiseasePestSolution");
const router = express_1.default.Router();
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'dps');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only images allowed'));
    },
});
const imgUrl = (f) => `/uploads/dps/${f}`;
const parseTags = (v) => !v ? [] : Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean);
// LIST
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search, recordType, severity, status, cropName } = req.query;
        const filter = {};
        if (search)
            filter.$or = [{ cropName: new RegExp(search, 'i') }, { diseasePestName: new RegExp(search, 'i') }, { tags: new RegExp(search, 'i') }];
        if (recordType)
            filter.recordType = recordType;
        if (severity)
            filter.severity = severity;
        if (status)
            filter.status = status;
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        const [data, total] = await Promise.all([
            DiseasePestSolution_1.DiseasePestSolution.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            DiseasePestSolution_1.DiseasePestSolution.countDocuments(filter),
        ]);
        const [totalAll, totalCrops, totalPublished, totalDraft] = await Promise.all([
            DiseasePestSolution_1.DiseasePestSolution.countDocuments(),
            DiseasePestSolution_1.DiseasePestSolution.distinct('cropName').then(r => r.length),
            DiseasePestSolution_1.DiseasePestSolution.countDocuments({ status: 'published' }),
            DiseasePestSolution_1.DiseasePestSolution.countDocuments({ status: 'draft' }),
        ]);
        res.json({
            success: true, data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: { total: totalAll, totalCrops, totalPublished, totalDraft },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// GET ONE
router.get('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseasePestSolution_1.DiseasePestSolution.findById(req.params.id).lean();
        if (!record)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: record });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// CREATE
router.post('/', auth_1.authenticate, auth_1.requireAdmin, upload.array('referenceImages', 10), async (req, res) => {
    try {
        const files = req.files || [];
        const images = files.map(f => imgUrl(f.filename));
        const b = req.body;
        const record = await DiseasePestSolution_1.DiseasePestSolution.create({
            cropName: b.cropName?.trim(),
            recordType: b.recordType,
            diseasePestName: b.diseasePestName?.trim(),
            severity: b.severity || 'medium',
            description: b.description,
            symptoms: b.symptoms,
            organicSolution: b.organicSolution,
            chemicalSolution: b.chemicalSolution,
            urgentPrevention: b.urgentPrevention,
            recoveryTips: b.recoveryTips,
            preventiveMeasures: b.preventiveMeasures,
            dos: b.dos,
            donts: b.donts,
            recommendedProducts: b.recommendedProducts,
            farmerAdvice: b.farmerAdvice,
            referenceImages: images,
            tags: parseTags(b.tags),
            keywords: parseTags(b.keywords),
            status: b.status || 'draft',
        });
        res.status(201).json({ success: true, data: record });
    }
    catch (e) {
        if (e.code === 11000)
            return res.status(409).json({ success: false, error: 'Record for this Crop + Disease/Pest already exists.' });
        res.status(500).json({ success: false, error: e.message });
    }
});
// UPDATE
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, upload.array('referenceImages', 10), async (req, res) => {
    try {
        const existing = await DiseasePestSolution_1.DiseasePestSolution.findById(req.params.id);
        if (!existing)
            return res.status(404).json({ success: false, error: 'Not found' });
        const files = req.files || [];
        const newImages = files.map(f => imgUrl(f.filename));
        const b = req.body;
        const update = {
            referenceImages: [...(existing.referenceImages || []), ...newImages],
        };
        const fields = ['cropName', 'recordType', 'diseasePestName', 'severity', 'description', 'symptoms',
            'organicSolution', 'chemicalSolution', 'urgentPrevention', 'recoveryTips', 'preventiveMeasures',
            'dos', 'donts', 'recommendedProducts', 'farmerAdvice', 'status'];
        fields.forEach(f => { if (b[f] !== undefined)
            update[f] = b[f]; });
        if (b.tags)
            update.tags = parseTags(b.tags);
        if (b.keywords)
            update.keywords = parseTags(b.keywords);
        const updated = await DiseasePestSolution_1.DiseasePestSolution.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// DELETE
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await DiseasePestSolution_1.DiseasePestSolution.findByIdAndDelete(req.params.id);
        if (!record)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// BULK DELETE
router.post('/bulk-delete', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length)
            return res.status(400).json({ success: false, error: 'ids array required' });
        const result = await DiseasePestSolution_1.DiseasePestSolution.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, deleted: result.deletedCount });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// EXPORT JSON
router.get('/export/json', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { cropName, status } = req.query;
        const filter = {};
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        if (status)
            filter.status = status;
        const data = await DiseasePestSolution_1.DiseasePestSolution.find(filter).lean();
        res.setHeader('Content-Disposition', 'attachment; filename="disease-pest-solutions.json"');
        res.json({ exportedAt: new Date().toISOString(), count: data.length, data });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// IMPORT JSON
router.post('/import/json', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const records = req.body.data || req.body;
        if (!Array.isArray(records) || !records.length)
            return res.status(400).json({ success: false, error: 'data array required' });
        let created = 0, updated = 0, errors = 0;
        for (const r of records) {
            if (!r.cropName || !r.diseasePestName) {
                errors++;
                continue;
            }
            try {
                const res2 = await DiseasePestSolution_1.DiseasePestSolution.findOneAndUpdate({ cropName: new RegExp(`^${r.cropName.trim()}$`, 'i'), diseasePestName: new RegExp(`^${r.diseasePestName.trim()}$`, 'i') }, { ...r }, { upsert: true, new: true, setDefaultsOnInsert: true });
                if (res2) {
                    const isNew = res2.__v === 0;
                    isNew ? created++ : updated++;
                }
            }
            catch {
                errors++;
            }
        }
        res.json({ success: true, created, updated, errors });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// PUBLIC LOOKUP (used by Disease Detection in next prompt)
router.get('/lookup/:cropName/:diseasePestName', async (req, res) => {
    try {
        const { cropName, diseasePestName } = req.params;
        const record = await DiseasePestSolution_1.DiseasePestSolution.findOne({
            cropName: { $regex: `^${cropName}$`, $options: 'i' },
            diseasePestName: { $regex: `^${diseasePestName}$`, $options: 'i' },
            status: 'published',
        }).lean();
        if (!record)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: record });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=diseasePestSolutions.js.map