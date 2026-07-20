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
const PestKnowledgeBase_1 = require("../models/PestKnowledgeBase");
const router = express_1.default.Router();
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'pest');
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
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))
            cb(null, true);
        else
            cb(new Error('Only image and video files allowed'));
    },
});
const mediaUrl = (type, filename) => `/uploads/pest/${filename}`;
// ─── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const { search, cropName, status } = req.query;
        const filter = {};
        if (search)
            filter.$or = [
                { cropName: new RegExp(search, 'i') },
                { pestName: new RegExp(search, 'i') },
            ];
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        if (status)
            filter.status = status;
        const [data, total, totalCrops, totalImages] = await Promise.all([
            PestKnowledgeBase_1.PestKnowledgeBase.find(filter).sort({ cropName: 1 }).skip((page - 1) * limit).limit(limit),
            PestKnowledgeBase_1.PestKnowledgeBase.countDocuments(filter),
            PestKnowledgeBase_1.PestKnowledgeBase.distinct('cropName').then(r => r.length),
            PestKnowledgeBase_1.PestKnowledgeBase.aggregate([
                { $project: { count: { $size: '$images' } } },
                { $group: { _id: null, total: { $sum: '$count' } } },
            ]).then(r => r[0]?.total || 0),
        ]);
        const totalRecords = await PestKnowledgeBase_1.PestKnowledgeBase.countDocuments();
        res.json({
            success: true,
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: { totalRecords, totalCrops, totalImages },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch pest records' });
    }
});
// ─── GET ONE ──────────────────────────────────────────────────────────────────
router.get('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await PestKnowledgeBase_1.PestKnowledgeBase.findById(req.params.id);
        if (!record)
            return res.status(404).json({ error: 'Record not found' });
        res.json({ success: true, data: record });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch record' });
    }
});
// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post('/', auth_1.authenticate, auth_1.requireAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]), async (req, res) => {
    try {
        const files = req.files;
        const images = (files?.images || []).map(f => mediaUrl('image', f.filename));
        const videos = (files?.videos || []).map(f => mediaUrl('video', f.filename));
        const record = await PestKnowledgeBase_1.PestKnowledgeBase.create({
            ...req.body,
            images,
            videos,
            createdBy: req.user?.userId,
        });
        res.status(201).json({ success: true, data: record });
    }
    catch (error) {
        if (error.code === 11000)
            return res.status(400).json({ error: 'Pest record for this crop already exists' });
        res.status(500).json({ error: error.message || 'Failed to create record' });
    }
});
// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]), async (req, res) => {
    try {
        const existing = await PestKnowledgeBase_1.PestKnowledgeBase.findById(req.params.id);
        if (!existing)
            return res.status(404).json({ error: 'Record not found' });
        const files = req.files;
        const newImages = (files?.images || []).map(f => mediaUrl('image', f.filename));
        const newVideos = (files?.videos || []).map(f => mediaUrl('video', f.filename));
        const updated = await PestKnowledgeBase_1.PestKnowledgeBase.findByIdAndUpdate(req.params.id, {
            ...req.body,
            images: [...(existing.images || []), ...newImages],
            videos: [...(existing.videos || []), ...newVideos],
            updatedBy: req.user?.userId,
        }, { new: true, runValidators: true });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update record' });
    }
});
// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const record = await PestKnowledgeBase_1.PestKnowledgeBase.findByIdAndDelete(req.params.id);
        if (!record)
            return res.status(404).json({ error: 'Record not found' });
        res.json({ success: true, message: 'Pest record deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete record' });
    }
});
// ─── PUBLIC: lookup by crop + pest (used by AI knowledge_service) ─────────────
router.get('/lookup/:cropName/:pestName', async (req, res) => {
    try {
        const { cropName, pestName } = req.params;
        const record = await PestKnowledgeBase_1.PestKnowledgeBase.findOne({
            cropName: { $regex: `^${cropName}$`, $options: 'i' },
            pestName: { $regex: `^${pestName}$`, $options: 'i' },
            status: 'published',
        });
        if (!record)
            return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, data: record });
    }
    catch (error) {
        res.status(500).json({ error: 'Lookup failed' });
    }
});
exports.default = router;
//# sourceMappingURL=pestKnowledge.js.map