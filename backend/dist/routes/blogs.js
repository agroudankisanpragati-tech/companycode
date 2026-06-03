"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// require to avoid missing type declarations in this project setup
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const BlogPost_1 = require("../models/BlogPost");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
const useCloud = !!process.env.CLOUDINARY_URL;
if (useCloud) {
    cloudinary.config({
        secure: true,
    });
}
const diskStorage = multer_1.default.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, uploadsDir);
    },
    filename: (_req, file, callback) => {
        const safeName = file.originalname
            .toLowerCase()
            .replace(/[^a-z0-9.\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        callback(null, `${Date.now()}-${safeName}`);
    },
});
const memoryStorage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: useCloud ? memoryStorage : diskStorage,
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype.startsWith('image/')) {
            callback(null, true);
            return;
        }
        callback(new Error('Only image files are allowed'));
    },
});
const buildMediaUrl = (fileNameOrUrl) => {
    if (!fileNameOrUrl)
        return '';
    if (useCloud)
        return fileNameOrUrl; // already a full URL from Cloudinary
    return `/uploads/${fileNameOrUrl}`;
};
const buildSlug = (rawTitle) => rawTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
const generateUniqueSlug = async (baseTitle, currentPostId) => {
    const baseSlug = buildSlug(baseTitle) || `post-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await BlogPost_1.BlogPost.findOne({ slug });
        if (!existing || (currentPostId && existing._id.toString() === currentPostId)) {
            return slug;
        }
        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }
};
const sanitizeTags = (tags) => {
    if (!Array.isArray(tags))
        return [];
    return tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
};
const convertEditorJsToHtml = (data) => {
    if (!data || !Array.isArray(data.blocks))
        return '';
    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return data.blocks
        .map((block) => {
        const t = block.type;
        const d = block.data || {};
        switch (t) {
            case 'paragraph':
                return `<p>${d.text ? d.text : ''}</p>`;
            case 'header':
                const level = d.level && [1, 2, 3, 4].includes(d.level) ? d.level : 2;
                return `<h${level}>${d.text ? d.text : ''}</h${level}>`;
            case 'list':
                if (Array.isArray(d.items)) {
                    if (d.style === 'ordered') {
                        return `<ol>${d.items.map((it) => `<li>${it}</li>`).join('')}</ol>`;
                    }
                    return `<ul>${d.items.map((it) => `<li>${it}</li>`).join('')}</ul>`;
                }
                return '';
            case 'quote':
                return `<blockquote><p>${d.text || ''}</p><footer>${d.caption || ''}</footer></blockquote>`;
            case 'image':
                return `<figure><img src="${d.file?.url || d.url || ''}" alt="${escapeHtml(d.caption || '')}" /><figcaption>${escapeHtml(d.caption || '')}</figcaption></figure>`;
            case 'embed':
                return d.embed ? d.embed : (d.html ? d.html : '');
            default:
                return '';
        }
    })
        .join('\n');
};
router.get('/', async (req, res) => {
    try {
        const status = req.query.status || 'published';
        if (!['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }
        const posts = await BlogPost_1.BlogPost.find({ status })
            .sort({ publishedAt: -1, createdAt: -1 })
            .populate('authorId', 'name')
            .lean();
        return res.json({
            success: true,
            data: posts.map((post) => ({
                ...post,
                authorName: post.authorId?.name || 'Admin',
            })),
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});
router.get('/admin/all', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const posts = await BlogPost_1.BlogPost.find()
            .sort({ updatedAt: -1 })
            .populate('authorId', 'name')
            .lean();
        return res.json({
            success: true,
            data: posts.map((post) => ({
                ...post,
                authorName: post.authorId?.name || 'Admin',
            })),
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch admin blog posts' });
    }
});
router.get('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const post = await BlogPost_1.BlogPost.findById(req.params.id).populate('authorId', 'name').lean();
        if (!post) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        return res.json({
            success: true,
            data: {
                ...post,
                authorName: post.authorId?.name || 'Admin',
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});
router.post('/admin/upload-cover', auth_1.authenticate, auth_1.requireAdmin, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Cover image file is required' });
        }
        if (useCloud && file.buffer) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({ folder: 'kisan-unnati/blogs' }, (err, resCloud) => {
                    if (err)
                        return reject(err);
                    resolve(resCloud);
                });
                streamifier.createReadStream(file.buffer).pipe(uploadStream);
            });
            return res.status(201).json({
                success: true,
                data: {
                    coverImage: result.secure_url,
                    fileName: path_1.default.basename(result.secure_url),
                    mimeType: file.mimetype,
                },
            });
        }
        // Fallback to disk storage handling
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        // multer with diskStorage will have saved the file to disk and provided filename
        const filename = file.filename || file.originalname;
        return res.status(201).json({
            success: true,
            data: {
                coverImage: buildMediaUrl(filename),
                fileName: filename,
                mimeType: file.mimetype,
            },
        });
    }
    catch (error) {
        if (req.file && !useCloud) {
            const filePath = path_1.default.join(uploadsDir, req.file.filename || req.file.originalname);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload cover image' });
    }
});
router.post('/admin', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { title, excerpt, content, coverImage, tags, status } = req.body;
        if (!title || !excerpt || !content) {
            return res.status(400).json({ error: 'Title, excerpt, and content are required' });
        }
        if (!['draft', 'published'].includes(status || 'draft')) {
            return res.status(400).json({ error: 'Invalid blog status' });
        }
        const slug = await generateUniqueSlug(title);
        const now = new Date();
        let contentHtml = '';
        let contentJson = undefined;
        if (content) {
            const trimmed = content.trim();
            try {
                const parsed = JSON.parse(trimmed);
                contentJson = JSON.stringify(parsed);
                contentHtml = convertEditorJsToHtml(parsed) || '';
            }
            catch (e) {
                contentHtml = trimmed;
            }
        }
        const created = await BlogPost_1.BlogPost.create({
            title: title.trim(),
            excerpt: excerpt.trim(),
            content: contentHtml,
            contentJson: contentJson,
            coverImage: coverImage?.trim(),
            tags: sanitizeTags(tags),
            status: status || 'draft',
            slug,
            authorId: req.user.userId,
            publishedAt: (status || 'draft') === 'published' ? now : undefined,
        });
        return res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create blog post' });
    }
});
router.patch('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { title, excerpt, content, coverImage, tags, status } = req.body;
        const existing = await BlogPost_1.BlogPost.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        if (title?.trim() && title.trim() !== existing.title) {
            existing.slug = await generateUniqueSlug(title.trim(), existing._id.toString());
            existing.title = title.trim();
        }
        if (excerpt?.trim())
            existing.excerpt = excerpt.trim();
        if (content?.trim()) {
            const trimmed = content.trim();
            try {
                const parsed = JSON.parse(trimmed);
                existing.contentJson = JSON.stringify(parsed);
                existing.content = convertEditorJsToHtml(parsed) || '';
            }
            catch (e) {
                existing.content = trimmed;
            }
        }
        if (typeof coverImage === 'string')
            existing.coverImage = coverImage.trim() || undefined;
        if (Array.isArray(tags))
            existing.tags = sanitizeTags(tags);
        if (status && ['draft', 'published'].includes(status)) {
            const wasDraft = existing.status === 'draft';
            existing.status = status;
            if (status === 'published' && wasDraft) {
                existing.publishedAt = new Date();
            }
            if (status === 'draft') {
                existing.publishedAt = undefined;
            }
        }
        await existing.save();
        return res.json({ success: true, data: existing });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update blog post' });
    }
});
router.delete('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const deleted = await BlogPost_1.BlogPost.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        return res.json({ success: true, message: 'Blog post deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to delete blog post' });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        const post = await BlogPost_1.BlogPost.findOne({ slug: req.params.slug, status: 'published' })
            .populate('authorId', 'name')
            .lean();
        if (!post) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        return res.json({
            success: true,
            data: {
                ...post,
                authorName: post.authorId?.name || 'Admin',
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});
exports.default = router;
//# sourceMappingURL=blogs.js.map