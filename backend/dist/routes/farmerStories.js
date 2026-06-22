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
const FarmerStory_1 = require("../models/FarmerStory");
const router = express_1.default.Router();
const storiesDir = path_1.default.join(process.cwd(), 'uploads', 'stories');
if (!fs_1.default.existsSync(storiesDir))
    fs_1.default.mkdirSync(storiesDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, storiesDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()}`),
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for videos
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only video and image files are allowed'));
    },
});
const storyUpload = upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
]);
const mediaUrl = (filename) => `/uploads/stories/${filename}`;
// ─── PUBLIC: Get approved stories ─────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, parseInt(req.query.limit) || 10);
        const filter = req.query.filter || 'latest'; // latest | trending | featured
        const category = req.query.category;
        const query = { status: 'approved' };
        if (category && category !== 'All')
            query.category = category;
        let sortObj = { createdAt: -1 };
        if (filter === 'trending')
            sortObj = { likes: -1, views: -1, createdAt: -1 };
        if (filter === 'featured') {
            query.featured = true;
            sortObj = { createdAt: -1 };
        }
        const [stories, total] = await Promise.all([
            FarmerStory_1.FarmerStory.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
            FarmerStory_1.FarmerStory.countDocuments(query),
        ]);
        res.json({ success: true, data: stories, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});
// ─── PUBLIC: Get single story + increment views ───────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const story = await FarmerStory_1.FarmerStory.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        res.json({ success: true, data: story });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});
// ─── FARMER: Upload story ─────────────────────────────────────────────────────
router.post('/upload', auth_1.authenticate, storyUpload, async (req, res) => {
    try {
        const files = req.files;
        const videoFile = files?.video?.[0];
        const thumbFile = files?.thumbnail?.[0];
        if (!videoFile)
            return res.status(400).json({ error: 'Video file is required' });
        if (!req.body.title)
            return res.status(400).json({ error: 'Title is required' });
        if (!req.body.farmerName)
            return res.status(400).json({ error: 'Farmer name is required' });
        const story = await FarmerStory_1.FarmerStory.create({
            farmerName: req.body.farmerName,
            village: req.body.village,
            district: req.body.district,
            state: req.body.state,
            cropName: req.body.cropName,
            title: req.body.title,
            caption: req.body.caption,
            successDescription: req.body.successDescription,
            category: req.body.category || 'Success Story',
            videoUrl: mediaUrl(videoFile.filename),
            thumbnailUrl: thumbFile ? mediaUrl(thumbFile.filename) : undefined,
            status: 'pending', // farmer uploads need approval
            uploadedBy: req.user.userId,
            uploadedByAdmin: false,
        });
        res.status(201).json({ success: true, data: story, message: 'Story submitted for approval.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to upload story' });
    }
});
// ─── FARMER: Like story ───────────────────────────────────────────────────────
router.post('/:id/like', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const story = await FarmerStory_1.FarmerStory.findById(req.params.id);
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        const alreadyLiked = story.likedBy.includes(userId);
        if (alreadyLiked) {
            story.likedBy = story.likedBy.filter(id => id !== userId);
            story.likes = Math.max(0, story.likes - 1);
        }
        else {
            story.likedBy.push(userId);
            story.likes += 1;
        }
        await story.save();
        res.json({ success: true, liked: !alreadyLiked, likes: story.likes });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to like story' });
    }
});
// ─── FARMER: Save story ───────────────────────────────────────────────────────
router.post('/:id/save', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const story = await FarmerStory_1.FarmerStory.findById(req.params.id);
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        const alreadySaved = story.savedBy.includes(userId);
        if (alreadySaved) {
            story.savedBy = story.savedBy.filter(id => id !== userId);
        }
        else {
            story.savedBy.push(userId);
        }
        await story.save();
        res.json({ success: true, saved: !alreadySaved });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to save story' });
    }
});
// ─── FARMER: My stories ───────────────────────────────────────────────────────
router.get('/my/stories', auth_1.authenticate, async (req, res) => {
    try {
        const stories = await FarmerStory_1.FarmerStory.find({ uploadedBy: req.user.userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: stories });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch your stories' });
    }
});
// ─── ADMIN: Get all stories ───────────────────────────────────────────────────
router.get('/admin/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const status = req.query.status;
        const query = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status))
            query.status = status;
        const [stories, total, pending, approved, rejected, totalStories] = await Promise.all([
            FarmerStory_1.FarmerStory.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            FarmerStory_1.FarmerStory.countDocuments(query),
            FarmerStory_1.FarmerStory.countDocuments({ status: 'pending' }),
            FarmerStory_1.FarmerStory.countDocuments({ status: 'approved' }),
            FarmerStory_1.FarmerStory.countDocuments({ status: 'rejected' }),
            FarmerStory_1.FarmerStory.countDocuments(),
        ]);
        res.json({
            success: true, data: stories,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            summary: { total: totalStories, pending, approved, rejected },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});
// ─── ADMIN: Upload story (auto-approved) ─────────────────────────────────────
router.post('/admin/upload', auth_1.authenticate, auth_1.requireAdmin, storyUpload, async (req, res) => {
    try {
        const files = req.files;
        const videoFile = files?.video?.[0];
        const thumbFile = files?.thumbnail?.[0];
        if (!videoFile)
            return res.status(400).json({ error: 'Video file is required' });
        if (!req.body.title)
            return res.status(400).json({ error: 'Title is required' });
        const story = await FarmerStory_1.FarmerStory.create({
            farmerName: req.body.farmerName || 'Admin',
            village: req.body.village,
            district: req.body.district,
            state: req.body.state,
            cropName: req.body.cropName,
            title: req.body.title,
            caption: req.body.caption,
            successDescription: req.body.successDescription,
            category: req.body.category || 'Success Story',
            videoUrl: mediaUrl(videoFile.filename),
            thumbnailUrl: thumbFile ? mediaUrl(thumbFile.filename) : undefined,
            status: 'approved', // admin uploads are auto-approved
            featured: req.body.featured === 'true',
            uploadedBy: req.user.userId,
            uploadedByAdmin: true,
        });
        res.status(201).json({ success: true, data: story });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to upload story' });
    }
});
// ─── ADMIN: Update story ──────────────────────────────────────────────────────
router.put('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, storyUpload, async (req, res) => {
    try {
        const files = req.files;
        const updateData = { ...req.body };
        if (files?.video?.[0])
            updateData.videoUrl = mediaUrl(files.video[0].filename);
        if (files?.thumbnail?.[0])
            updateData.thumbnailUrl = mediaUrl(files.thumbnail[0].filename);
        if (updateData.featured !== undefined)
            updateData.featured = updateData.featured === 'true';
        const story = await FarmerStory_1.FarmerStory.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        res.json({ success: true, data: story });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update story' });
    }
});
// ─── ADMIN: Approve / Reject ──────────────────────────────────────────────────
router.patch('/admin/:id/status', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });
        const story = await FarmerStory_1.FarmerStory.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        res.json({ success: true, data: story });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});
// ─── ADMIN: Feature / Unfeature ───────────────────────────────────────────────
router.patch('/admin/:id/feature', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const story = await FarmerStory_1.FarmerStory.findByIdAndUpdate(req.params.id, { featured: Boolean(req.body.featured) }, { new: true });
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        res.json({ success: true, data: story });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update featured' });
    }
});
// ─── ADMIN: Delete story ──────────────────────────────────────────────────────
router.delete('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const story = await FarmerStory_1.FarmerStory.findByIdAndDelete(req.params.id);
        if (!story)
            return res.status(404).json({ error: 'Story not found' });
        // Clean up video and thumbnail files
        for (const url of [story.videoUrl, story.thumbnailUrl].filter(Boolean)) {
            const filePath = path_1.default.join(process.cwd(), 'uploads', 'stories', path_1.default.basename(url));
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
        }
        res.json({ success: true, message: 'Story deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete story' });
    }
});
exports.default = router;
//# sourceMappingURL=farmerStories.js.map