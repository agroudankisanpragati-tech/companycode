"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const GovtScheme_1 = require("../models/GovtScheme");
const auth_1 = require("../middleware/auth");
const schemeUpload_1 = require("../utils/schemeUpload");
const router = express_1.default.Router();
// ─── Slug helpers ──────────────────────────────────────────────────────────────
const buildSlug = (rawTitle) => rawTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
const generateUniqueSlug = async (baseTitle, currentId) => {
    const baseSlug = buildSlug(baseTitle) || `scheme-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await GovtScheme_1.GovtScheme.findOne({ slug });
        if (!existing || (currentId && existing._id.toString() === currentId))
            return slug;
        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }
};
const sanitizeList = (items) => {
    if (!Array.isArray(items))
        return [];
    return items.filter((i) => typeof i === 'string').map((i) => i.trim()).filter(Boolean).slice(0, 20);
};
// ─── External API fallback ────────────────────────────────────────────────────
const fetchAndStoreSchemesFromAPI = async (schemeType, state) => {
    try {
        const apiKey = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001379cf89b87fe47dc41c8556259e4446b';
        const params = {
            'api-key': apiKey,
            format: 'json',
            limit: '20',
            filters: schemeType === 'central' ? 'Central' : 'State',
        };
        if (state && schemeType === 'state')
            params['state'] = state;
        const response = await axios_1.default.get('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070', {
            params,
            timeout: 10000,
        });
        const records = response.data?.records || [];
        for (const record of records) {
            const title = record['scheme_name'] || record['schemeName'] || record['name'];
            if (!title)
                continue;
            const slug = await generateUniqueSlug(title);
            const schemeState = record['state_name'] || record['state'] || state || '';
            // Skip duplicate by title
            const exists = await GovtScheme_1.GovtScheme.findOne({ title: { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
            if (exists)
                continue;
            await GovtScheme_1.GovtScheme.create({
                title: title.trim(),
                slug,
                summary: (record['short_description'] || record['description'] || title).slice(0, 500).trim(),
                description: (record['description'] || record['details'] || title).trim(),
                department: (record['ministry'] || record['department'] || 'Government of India').trim(),
                audience: (record['beneficiaries'] || record['target_group'] || 'All Farmers').trim(),
                benefits: record['benefits'] ? [record['benefits'].toString().trim()] : [],
                applicationLink: record['apply_link'] || record['application_link'] || '',
                officialLink: record['official_link'] || '',
                tags: ['agriculture', schemeType === 'state' ? schemeState.toLowerCase() : 'central'].filter(Boolean),
                keywords: [schemeType, ...(schemeState ? [schemeState.toLowerCase()] : [])],
                schemeType,
                state: schemeState,
                status: 'published',
                source: 'api',
                publishedAt: new Date(),
            });
        }
    }
    catch { /* silent — fallback failure should not crash user request */ }
};
// ─── Public: list & search published schemes ──────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status = 'published', search = '', schemeType, state, page = '1', limit = '50', } = req.query;
        if (!['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }
        const filter = { status };
        if (schemeType && ['central', 'state'].includes(schemeType)) {
            filter.schemeType = schemeType;
        }
        if (state && schemeType === 'state') {
            filter.state = { $regex: state, $options: 'i' };
        }
        if (search.trim()) {
            filter.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { summary: { $regex: search.trim(), $options: 'i' } },
                { department: { $regex: search.trim(), $options: 'i' } },
                { tags: { $regex: search.trim(), $options: 'i' } },
                { keywords: { $regex: search.trim(), $options: 'i' } },
                { state: { $regex: search.trim(), $options: 'i' } },
            ];
        }
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (pageNum - 1) * limitNum;
        const [schemes, total] = await Promise.all([
            GovtScheme_1.GovtScheme.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            GovtScheme_1.GovtScheme.countDocuments(filter),
        ]);
        // If no results in DB and a search / type was specified, fetch from API
        if (schemes.length === 0 && (schemeType || search.trim())) {
            const type = schemeType || 'central';
            void fetchAndStoreSchemesFromAPI(type, state).then(async () => {
                // re-fetch after API import so caller gets results on next request
            });
        }
        return res.json({ success: true, data: schemes, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch government schemes' });
    }
});
// ─── Public: scheme detail by slug ───────────────────────────────────────────
router.get('/:slug', async (req, res) => {
    try {
        const scheme = await GovtScheme_1.GovtScheme.findOne({ slug: req.params.slug, status: 'published' }).lean();
        if (!scheme)
            return res.status(404).json({ error: 'Government scheme not found' });
        return res.json({ success: true, data: scheme });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch government scheme' });
    }
});
// ─── Admin: list all (draft + published) ─────────────────────────────────────
router.get('/admin/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { search = '', schemeType, state } = req.query;
        const filter = {};
        if (schemeType && ['central', 'state'].includes(schemeType))
            filter.schemeType = schemeType;
        if (state && schemeType === 'state')
            filter.state = { $regex: state, $options: 'i' };
        if (search.trim()) {
            filter.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { state: { $regex: search.trim(), $options: 'i' } },
                { tags: { $regex: search.trim(), $options: 'i' } },
            ];
        }
        const schemes = await GovtScheme_1.GovtScheme.find(filter).sort({ updatedAt: -1 }).lean();
        return res.json({ success: true, data: schemes });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch admin schemes' });
    }
});
// ─── Admin: trigger API import ────────────────────────────────────────────────
router.post('/admin/fetch-from-api', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { schemeType = 'central', state } = req.body;
        await fetchAndStoreSchemesFromAPI(schemeType, state);
        const count = await GovtScheme_1.GovtScheme.countDocuments({ source: 'api', schemeType });
        return res.json({ success: true, message: `API import complete. Total ${schemeType} API schemes: ${count}` });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch schemes from API' });
    }
});
// ─── Admin: create scheme (JSON body) ────────────────────────────────────────
router.post('/admin', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { title, summary, description, department, audience, benefits, eligibility, requiredDocuments, applicationProcess, applicationLink, officialLink, coverImage, images, videos, tags, keywords, schemeType, state, status, } = req.body;
        if (!title || !summary || !description || !department || !audience) {
            return res.status(400).json({ error: 'Title, summary, description, department, and audience are required' });
        }
        if (schemeType === 'state' && !state?.trim()) {
            return res.status(400).json({ error: 'State is required for state-level schemes' });
        }
        const slug = await generateUniqueSlug(title);
        const now = new Date();
        const finalStatus = ['draft', 'published'].includes(status) ? status : 'draft';
        const created = await GovtScheme_1.GovtScheme.create({
            title: title.trim(),
            slug,
            summary: summary.trim(),
            description: description.trim(),
            department: department.trim(),
            audience: audience.trim(),
            benefits: sanitizeList(benefits),
            eligibility: eligibility?.trim(),
            requiredDocuments: sanitizeList(requiredDocuments),
            applicationProcess: applicationProcess?.trim(),
            applicationLink: applicationLink?.trim(),
            officialLink: officialLink?.trim(),
            coverImage: coverImage?.trim(),
            images: sanitizeList(images),
            videos: sanitizeList(videos),
            tags: sanitizeList(tags).map((t) => t.toLowerCase()),
            keywords: sanitizeList(keywords).map((k) => k.toLowerCase()),
            schemeType: ['central', 'state'].includes(schemeType) ? schemeType : 'central',
            state: state?.trim() || '',
            status: finalStatus,
            source: 'admin',
            createdBy: req.user?.userId || 'admin',
            publishedAt: finalStatus === 'published' ? now : undefined,
        });
        return res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create government scheme' });
    }
});
// ─── Admin: upload media for a scheme ────────────────────────────────────────
router.post('/admin/upload-media', auth_1.authenticate, auth_1.requireAdmin, schemeUpload_1.schemeUpload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 3 }]), async (req, res) => {
    try {
        const files = req.files;
        const imageUrls = (files?.images || []).map((f) => (0, schemeUpload_1.getSchemeFileUrl)(f.filename));
        const videoUrls = (files?.videos || []).map((f) => (0, schemeUpload_1.getSchemeFileUrl)(f.filename));
        return res.json({ success: true, data: { images: imageUrls, videos: videoUrls } });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to upload media' });
    }
});
// ─── Admin: update scheme ─────────────────────────────────────────────────────
router.patch('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const existing = await GovtScheme_1.GovtScheme.findById(req.params.id);
        if (!existing)
            return res.status(404).json({ error: 'Government scheme not found' });
        const { title, summary, description, department, audience, benefits, eligibility, requiredDocuments, applicationProcess, applicationLink, officialLink, coverImage, images, videos, tags, keywords, schemeType, state, status, } = req.body;
        if (title?.trim() && title.trim() !== existing.title) {
            existing.slug = await generateUniqueSlug(title.trim(), existing._id.toString());
            existing.title = title.trim();
        }
        if (summary?.trim())
            existing.summary = summary.trim();
        if (description?.trim())
            existing.description = description.trim();
        if (department?.trim())
            existing.department = department.trim();
        if (audience?.trim())
            existing.audience = audience.trim();
        if (Array.isArray(benefits))
            existing.benefits = sanitizeList(benefits);
        if (typeof eligibility === 'string')
            existing.eligibility = eligibility.trim() || undefined;
        if (Array.isArray(requiredDocuments))
            existing.requiredDocuments = sanitizeList(requiredDocuments);
        if (typeof applicationProcess === 'string')
            existing.applicationProcess = applicationProcess.trim() || undefined;
        if (typeof applicationLink === 'string')
            existing.applicationLink = applicationLink.trim() || undefined;
        if (typeof officialLink === 'string')
            existing.officialLink = officialLink.trim() || undefined;
        if (typeof coverImage === 'string')
            existing.coverImage = coverImage.trim() || undefined;
        if (Array.isArray(images))
            existing.images = sanitizeList(images);
        if (Array.isArray(videos))
            existing.videos = sanitizeList(videos);
        if (Array.isArray(tags))
            existing.tags = sanitizeList(tags).map((t) => t.toLowerCase());
        if (Array.isArray(keywords))
            existing.keywords = sanitizeList(keywords).map((k) => k.toLowerCase());
        if (schemeType && ['central', 'state'].includes(schemeType))
            existing.schemeType = schemeType;
        if (typeof state === 'string')
            existing.state = state.trim();
        if (status && ['draft', 'published'].includes(status)) {
            const wasDraft = existing.status === 'draft';
            existing.status = status;
            if (status === 'published' && wasDraft)
                existing.publishedAt = new Date();
            if (status === 'draft')
                existing.publishedAt = undefined;
        }
        await existing.save();
        return res.json({ success: true, data: existing });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update government scheme' });
    }
});
// ─── Admin: delete scheme ─────────────────────────────────────────────────────
router.delete('/admin/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const deleted = await GovtScheme_1.GovtScheme.findByIdAndDelete(req.params.id);
        if (!deleted)
            return res.status(404).json({ error: 'Government scheme not found' });
        // Clean up local media files
        [...(deleted.images || []), ...(deleted.videos || [])].forEach((url) => {
            if (url.startsWith('/uploads'))
                (0, schemeUpload_1.deleteSchemeFile)(url);
        });
        return res.json({ success: true, message: 'Government scheme deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to delete government scheme' });
    }
});
exports.default = router;
//# sourceMappingURL=schemes.js.map