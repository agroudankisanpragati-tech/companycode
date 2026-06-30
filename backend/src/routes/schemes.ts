import express, { Response } from 'express';
import axios from 'axios';
import { GovtScheme, GovtSchemeStatus, SchemeType } from '../models/GovtScheme';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { schemeUpload, getSchemeFileUrl, deleteSchemeFile } from '../utils/schemeUpload';

const router = express.Router();

// ─── Slug helpers ──────────────────────────────────────────────────────────────

const buildSlug = (rawTitle: string) =>
    rawTitle
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

const generateUniqueSlug = async (baseTitle: string, currentId?: string) => {
    const baseSlug = buildSlug(baseTitle) || `scheme-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await GovtScheme.findOne({ slug });
        if (!existing || (currentId && existing._id.toString() === currentId)) return slug;
        slug = `${baseSlug}-${counter}`;
        counter += 1;
    }
};

const sanitizeList = (items: unknown): string[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((i): i is string => typeof i === 'string').map((i) => i.trim()).filter(Boolean).slice(0, 20);
};

// ─── External API fallback ────────────────────────────────────────────────────

const fetchAndStoreSchemesFromAPI = async (schemeType: SchemeType, state?: string): Promise<void> => {
    try {
        const apiKey = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001379cf89b87fe47dc41c8556259e4446b';
        const params: Record<string, string> = {
            'api-key': apiKey,
            format: 'json',
            limit: '20',
            filters: schemeType === 'central' ? 'Central' : 'State',
        };
        if (state && schemeType === 'state') params['state'] = state;

        const response = await axios.get('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070', {
            params,
            timeout: 10000,
        });

        const records: any[] = response.data?.records || [];

        for (const record of records) {
            const title = record['scheme_name'] || record['schemeName'] || record['name'];
            if (!title) continue;

            const slug = await generateUniqueSlug(title);
            const schemeState = record['state_name'] || record['state'] || state || '';

            // Skip duplicate by title
            const exists = await GovtScheme.findOne({ title: { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
            if (exists) continue;

            await GovtScheme.create({
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
    } catch { /* silent — fallback failure should not crash user request */ }
};

// ─── Public: list & search published schemes ──────────────────────────────────

router.get('/', async (req, res: Response) => {
    try {
        const {
            status = 'published',
            search = '',
            schemeType,
            state,
            page = '1',
            limit = '50',
        } = req.query as Record<string, string>;

        if (!['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }

        const filter: Record<string, any> = { status };

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
            GovtScheme.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            GovtScheme.countDocuments(filter),
        ]);

        // If no results in DB and a search / type was specified, fetch from API
        if (schemes.length === 0 && (schemeType || search.trim())) {
            const type: SchemeType = (schemeType as SchemeType) || 'central';
            void fetchAndStoreSchemesFromAPI(type, state).then(async () => {
                // re-fetch after API import so caller gets results on next request
            });
        }

        return res.json({ success: true, data: schemes, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch government schemes' });
    }
});

// ─── Public: scheme detail by slug ───────────────────────────────────────────

router.get('/:slug', async (req, res: Response) => {
    try {
        const scheme = await GovtScheme.findOne({ slug: req.params.slug, status: 'published' }).lean();
        if (!scheme) return res.status(404).json({ error: 'Government scheme not found' });
        return res.json({ success: true, data: scheme });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch government scheme' });
    }
});

// ─── Admin: list all (draft + published) ─────────────────────────────────────

router.get('/admin/all', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { search = '', schemeType, state } = req.query as Record<string, string>;

        const filter: Record<string, any> = {};
        if (schemeType && ['central', 'state'].includes(schemeType)) filter.schemeType = schemeType;
        if (state && schemeType === 'state') filter.state = { $regex: state, $options: 'i' };
        if (search.trim()) {
            filter.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { state: { $regex: search.trim(), $options: 'i' } },
                { tags: { $regex: search.trim(), $options: 'i' } },
            ];
        }

        const schemes = await GovtScheme.find(filter).sort({ updatedAt: -1 }).lean();
        return res.json({ success: true, data: schemes });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch admin schemes' });
    }
});

// ─── Admin: trigger API import ────────────────────────────────────────────────

router.post('/admin/fetch-from-api', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schemeType = 'central', state } = req.body as { schemeType?: SchemeType; state?: string };
        await fetchAndStoreSchemesFromAPI(schemeType, state);
        const count = await GovtScheme.countDocuments({ source: 'api', schemeType });
        return res.json({ success: true, message: `API import complete. Total ${schemeType} API schemes: ${count}` });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch schemes from API' });
    }
});

// ─── Admin: create scheme (JSON body) ────────────────────────────────────────

router.post('/admin', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            title, summary, description, department, audience,
            benefits, eligibility, requiredDocuments, applicationProcess,
            applicationLink, officialLink, coverImage, images, videos,
            tags, keywords, schemeType, state, status,
        } = req.body;

        if (!title || !summary || !description || !department || !audience) {
            return res.status(400).json({ error: 'Title, summary, description, department, and audience are required' });
        }

        if (schemeType === 'state' && !state?.trim()) {
            return res.status(400).json({ error: 'State is required for state-level schemes' });
        }

        const slug = await generateUniqueSlug(title);
        const now = new Date();
        const finalStatus: GovtSchemeStatus = ['draft', 'published'].includes(status) ? status : 'draft';

        const created = await GovtScheme.create({
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
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create government scheme' });
    }
});

// ─── Admin: upload media for a scheme ────────────────────────────────────────

router.post(
    '/admin/upload-media',
    authenticate,
    requireAdmin,
    schemeUpload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 3 }]),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
            const imageUrls = (files?.images || []).map((f) => getSchemeFileUrl(f.filename));
            const videoUrls = (files?.videos || []).map((f) => getSchemeFileUrl(f.filename));
            return res.json({ success: true, data: { images: imageUrls, videos: videoUrls } });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to upload media' });
        }
    }
);

// ─── Admin: update scheme ─────────────────────────────────────────────────────

router.patch('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const existing = await GovtScheme.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Government scheme not found' });

        const {
            title, summary, description, department, audience,
            benefits, eligibility, requiredDocuments, applicationProcess,
            applicationLink, officialLink, coverImage, images, videos,
            tags, keywords, schemeType, state, status,
        } = req.body;

        if (title?.trim() && title.trim() !== existing.title) {
            existing.slug = await generateUniqueSlug(title.trim(), existing._id.toString());
            existing.title = title.trim();
        }

        if (summary?.trim()) existing.summary = summary.trim();
        if (description?.trim()) existing.description = description.trim();
        if (department?.trim()) existing.department = department.trim();
        if (audience?.trim()) existing.audience = audience.trim();
        if (Array.isArray(benefits)) existing.benefits = sanitizeList(benefits);
        if (typeof eligibility === 'string') existing.eligibility = eligibility.trim() || undefined;
        if (Array.isArray(requiredDocuments)) existing.requiredDocuments = sanitizeList(requiredDocuments);
        if (typeof applicationProcess === 'string') existing.applicationProcess = applicationProcess.trim() || undefined;
        if (typeof applicationLink === 'string') existing.applicationLink = applicationLink.trim() || undefined;
        if (typeof officialLink === 'string') existing.officialLink = officialLink.trim() || undefined;
        if (typeof coverImage === 'string') existing.coverImage = coverImage.trim() || undefined;
        if (Array.isArray(images)) existing.images = sanitizeList(images);
        if (Array.isArray(videos)) existing.videos = sanitizeList(videos);
        if (Array.isArray(tags)) existing.tags = sanitizeList(tags).map((t) => t.toLowerCase());
        if (Array.isArray(keywords)) existing.keywords = sanitizeList(keywords).map((k) => k.toLowerCase());
        if (schemeType && ['central', 'state'].includes(schemeType)) existing.schemeType = schemeType;
        if (typeof state === 'string') existing.state = state.trim();

        if (status && ['draft', 'published'].includes(status)) {
            const wasDraft = existing.status === 'draft';
            existing.status = status;
            if (status === 'published' && wasDraft) existing.publishedAt = new Date();
            if (status === 'draft') existing.publishedAt = undefined;
        }

        await existing.save();
        return res.json({ success: true, data: existing });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update government scheme' });
    }
});

// ─── Admin: delete scheme ─────────────────────────────────────────────────────

router.delete('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const deleted = await GovtScheme.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Government scheme not found' });

        // Clean up local media files
        [...(deleted.images || []), ...(deleted.videos || [])].forEach((url) => {
            if (url.startsWith('/uploads')) deleteSchemeFile(url);
        });

        return res.json({ success: true, message: 'Government scheme deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete government scheme' });
    }
});

export default router;
