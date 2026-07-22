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

// ─── Public / Admin: Force Seed 10 Real Government Schemes ──────────────────

router.post('/seed-force', async (req, res: Response) => {
    try {
        const { ensureSeededSchemes } = await import('../utils/seedSchemes');
        await ensureSeededSchemes(true);
        const count = await GovtScheme.countDocuments();
        return res.json({ success: true, message: `Successfully seeded ${count} real government schemes in MongoDB!`, count });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Admin: create scheme (JSON body) ────────────────────────────────────────

router.post('/admin', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            title, summary, description, department, audience,
            benefits, eligibility, requiredDocuments, requiredDocumentsList,
            estimatedProcessingDays, popularityScore, eligibilityRules, applicationProcess,
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
            requiredDocumentsList: sanitizeList(requiredDocumentsList),
            estimatedProcessingDays: estimatedProcessingDays !== undefined && estimatedProcessingDays !== '' ? Number(estimatedProcessingDays) : undefined,
            popularityScore: popularityScore !== undefined && popularityScore !== '' ? Number(popularityScore) : 50,
            eligibilityRules: eligibilityRules ? {
                minAge: eligibilityRules.minAge !== undefined && eligibilityRules.minAge !== '' ? Number(eligibilityRules.minAge) : undefined,
                maxAge: eligibilityRules.maxAge !== undefined && eligibilityRules.maxAge !== '' ? Number(eligibilityRules.maxAge) : undefined,
                maxIncome: eligibilityRules.maxIncome !== undefined && eligibilityRules.maxIncome !== '' ? Number(eligibilityRules.maxIncome) : undefined,
                genders: sanitizeList(eligibilityRules.genders),
                occupations: sanitizeList(eligibilityRules.occupations),
                categories: sanitizeList(eligibilityRules.categories),
                states: sanitizeList(eligibilityRules.states),
            } : undefined,
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
            benefits, eligibility, requiredDocuments, requiredDocumentsList,
            estimatedProcessingDays, popularityScore, eligibilityRules, applicationProcess,
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
        if (Array.isArray(requiredDocumentsList)) existing.requiredDocumentsList = sanitizeList(requiredDocumentsList);
        if (estimatedProcessingDays !== undefined) existing.estimatedProcessingDays = estimatedProcessingDays === '' ? undefined : Number(estimatedProcessingDays);
        if (popularityScore !== undefined) existing.popularityScore = popularityScore === '' ? undefined : Number(popularityScore);

        if (eligibilityRules) {
            existing.eligibilityRules = {
                minAge: eligibilityRules.minAge !== undefined && eligibilityRules.minAge !== '' ? Number(eligibilityRules.minAge) : undefined,
                maxAge: eligibilityRules.maxAge !== undefined && eligibilityRules.maxAge !== '' ? Number(eligibilityRules.maxAge) : undefined,
                maxIncome: eligibilityRules.maxIncome !== undefined && eligibilityRules.maxIncome !== '' ? Number(eligibilityRules.maxIncome) : undefined,
                genders: Array.isArray(eligibilityRules.genders) ? sanitizeList(eligibilityRules.genders) : existing.eligibilityRules?.genders || [],
                occupations: Array.isArray(eligibilityRules.occupations) ? sanitizeList(eligibilityRules.occupations) : existing.eligibilityRules?.occupations || [],
                categories: Array.isArray(eligibilityRules.categories) ? sanitizeList(eligibilityRules.categories) : existing.eligibilityRules?.categories || [],
                states: Array.isArray(eligibilityRules.states) ? sanitizeList(eligibilityRules.states) : existing.eligibilityRules?.states || [],
            };
        }

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

// ─── AI Seva Mitra: Eligibility Matching Engine ───────────────────────────────

router.post('/match', async (req, res) => {
    try {
        const { age, income, occupation, gender, category, state, land } = req.body;

        const userAge = parseInt(age, 10) || 0;
        const userIncome = parseFloat(income) || 0;
        const userLand = parseFloat(land) || 0;
        const userState = (state || '').trim().toLowerCase();
        const userGender = (gender || '').trim().toLowerCase();
        const userCategory = (category || '').trim().toLowerCase();
        const rawOccupation = (occupation || '').trim().toLowerCase();

        // Hybrid Occupation Normalization
        let userOccupation = 'any';
        if (/kisan|farm|crop|agri|खेती|किसान|कृषक/i.test(rawOccupation)) {
            userOccupation = 'farmer';
        } else if (/labor|work|mazdoor|मजदूर|मजदूरी|श्रमिक/i.test(rawOccupation)) {
            userOccupation = 'agricultural-laborer';
        } else if (/business|self|dokan|shop|दुकान|उद्यमी/i.test(rawOccupation)) {
            userOccupation = 'self-employed';
        } else if (/student|padh|छात्र|पढ़ाई/i.test(rawOccupation)) {
            userOccupation = 'student';
        } else if (/unemployed|bero|बेरोजगार/i.test(rawOccupation)) {
            userOccupation = 'unemployed';
        }

        const query: Record<string, any> = { status: 'published' };

        const allSchemes = await GovtScheme.find(query).lean();
        const matched = allSchemes.map((scheme) => {
            const rules = scheme.eligibilityRules;
            let eligible = true;
            const reasons: string[] = [];

            if (rules) {
                // Type / State Match
                if (scheme.schemeType === 'state' && scheme.state) {
                    if (scheme.state.toLowerCase() !== userState && userState !== 'any') {
                        eligible = false;
                        reasons.push(`यह केवल ${scheme.state} राज्य के निवासियों के लिए है।`);
                    }
                }

                // Age Match
                if (rules.minAge !== undefined && userAge < rules.minAge) {
                    eligible = false;
                    reasons.push(`न्यूनतम आयु सीमा ${rules.minAge} वर्ष है (आपकी आयु: ${userAge} वर्ष)।`);
                }
                if (rules.maxAge !== undefined && userAge > rules.maxAge) {
                    eligible = false;
                    reasons.push(`अधिकतम आयु सीमा ${rules.maxAge} वर्ष है (आपकी आयु: ${userAge} वर्ष)।`);
                }

                // Income Match
                if (rules.maxIncome !== undefined && userIncome > rules.maxIncome) {
                    eligible = false;
                    reasons.push(`पारिवारिक वार्षिक आय सीमा ₹${rules.maxIncome} है (आपकी आय: ₹${userIncome})।`);
                }

                // Land Holdings Match
                if (rules.maxLandHectares !== undefined && userLand > rules.maxLandHectares) {
                    eligible = false;
                    reasons.push(`कृषि भूमि सीमा अधिकतम ${rules.maxLandHectares} हेक्टेयर है (आपकी भूमि: ${userLand} हेक्टेयर)।`);
                }

                // Gender Match
                if (userGender && rules.genders && rules.genders.length > 0 && !rules.genders.includes('any')) {
                    const normalizedGenders = rules.genders.map(g => g.toLowerCase());
                    if (!normalizedGenders.includes(userGender) && userGender !== 'any') {
                        eligible = false;
                        reasons.push(`यह योजना केवल ${rules.genders.join('/')} के लिए है।`);
                    }
                }

                // Occupation Match
                if (rules.occupations && rules.occupations.length > 0 && !rules.occupations.includes('any')) {
                    const normalizedOccupations = rules.occupations.map(o => o.toLowerCase());
                    if (!normalizedOccupations.includes(userOccupation) && userOccupation !== 'any') {
                        eligible = false;
                        reasons.push(`यह योजना ${rules.occupations.join('/')} व्यवसाय के लिए है।`);
                    }
                }

                // Category Match
                if (rules.categories && rules.categories.length > 0 && !rules.categories.includes('any')) {
                    const normalizedCategories = rules.categories.map(c => c.toLowerCase());
                    if (!normalizedCategories.includes(userCategory) && userCategory !== 'any') {
                        eligible = false;
                        reasons.push(`यह योजना केवल ${rules.categories.join(', ')} वर्गों के लिए है।`);
                    }
                }
            }

            let confidence = 100;
            if (!eligible) {
                confidence = Math.max(10, 100 - (reasons.length * 30));
            }

            return {
                ...scheme,
                eligible,
                confidence,
                reasons,
                normalizedOccupation: userOccupation
            };
        });

        const sortedMatched = matched.sort((a, b) => {
            if (a.eligible && !b.eligible) return -1;
            if (!a.eligible && b.eligible) return 1;
            const scoreA = (a.confidence * 0.6) + ((a.popularityScore || 50) * 0.4);
            const scoreB = (b.confidence * 0.6) + ((b.popularityScore || 50) * 0.4);
            return scoreB - scoreA;
        });

        res.json({ success: true, data: sortedMatched });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── AI Seva Mitra: Jan Aadhaar Profile Mock ──────────────────────────────────

router.post('/janaadhaar-mock', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'Jan Aadhaar or SSO ID is required' });

        let profile = {
            name: 'रोहित कुमार (Rohit Kumar)',
            age: 38,
            gender: 'male',
            income: 120000,
            occupation: 'किसान (Farmer)',
            category: 'OBC',
            district: 'Jaipur',
            state: 'Rajasthan',
            familyMembersCount: 4,
            landOwnedHectares: 1.2,
            disability: false
        };

        if (id.startsWith('2') || id.toLowerCase().includes('kamla')) {
            profile = {
                name: 'कमला देवी (Kamla Devi)',
                age: 45,
                gender: 'female',
                income: 8000,
                occupation: 'कोई नहीं / बेरोजगार (Unemployed)',
                category: 'SC',
                district: 'Bhilwara',
                state: 'Rajasthan',
                familyMembersCount: 5,
                landOwnedHectares: 0,
                disability: false
            };
        } else if (id.startsWith('3') || id.toLowerCase().includes('ram')) {
            profile = {
                name: 'रामलाल गुर्जर (Ramlal Gurjar)',
                age: 62,
                gender: 'male',
                income: 45000,
                occupation: 'मजदूर (Agricultural Labourer)',
                category: 'ST',
                district: 'Jodhpur',
                state: 'Rajasthan',
                familyMembersCount: 3,
                landOwnedHectares: 0.2,
                disability: true
            };
        }

        res.json({ success: true, profile });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── AI Seva Mitra: Document OCR Mock ─────────────────────────────────────────

router.post('/ocr-mock', schemeUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const filename = req.file.originalname.toLowerCase();

        await new Promise((resolve) => setTimeout(resolve, 1500));

        let extracted = {
            docType: 'Aadhaar Card',
            name: 'कमला देवी (Kamla Devi)',
            uniqueId: 'XXXX-XXXX-8940',
            dob: '15/08/1981',
            gender: 'female',
            address: 'ग्राम पो. मांडलगढ़, जिला भीलवाड़ा, राजस्थान',
            state: 'Rajasthan',
            valid: true
        };

        if (filename.includes('janaadhaar') || filename.includes('jan')) {
            extracted = {
                docType: 'Jan Aadhaar Card',
                name: 'कमला देवी (Kamla Devi)',
                uniqueId: 'XXXX-XXXX-9023-A',
                dob: '15/08/1981',
                gender: 'female',
                address: 'भीलवाड़ा, राजस्थान',
                state: 'Rajasthan',
                valid: true
            };
        } else if (filename.includes('income') || filename.includes('aay')) {
            extracted = {
                docType: 'Income Certificate',
                name: 'कमला देवी (Kamla Devi)',
                uniqueId: 'INC-2026-897',
                dob: 'N/A',
                gender: 'female',
                address: 'भीलवाड़ा, राजस्थान',
                state: 'Rajasthan',
                valid: true
            };
        }

        res.json({ success: true, extracted });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── AI Seva Mitra: Proactive Campaign Mock ───────────────────────────────────

router.post('/proactive-campaign', async (req, res) => {
    try {
        const { schemeTitle } = req.body;
        if (!schemeTitle) return res.status(400).json({ success: false, error: 'Scheme Title is required' });

        const users = [
            { name: 'रामलाल गुर्जर', phone: '982XXXXX12', district: 'Jodhpur' },
            { name: 'रोहित कुमार', phone: '941XXXXX67', district: 'Jaipur' },
            { name: 'मदन लाल यादव', phone: '810XXXXX40', district: 'Bikaner' }
        ];

        const logs = users.map(u => ({
            recipientName: u.name,
            phone: u.phone,
            message: `राम राम ${u.name} जी! राजस्थान सरकार द्वारा नई योजना '${schemeTitle}' शुरू की गई है। आपके प्रोफ़ाइल के अनुसार आप इसके पात्र हो सकते हैं। आवेदन करने के लिए रिप्लाई करें या ई-मित्र पर जाएं।`,
            status: 'sent',
            timestamp: new Date().toISOString()
        }));

        res.json({ success: true, matchedCount: users.length, logs });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── AI Seva Mitra: Govt AI Insights Chatbot Mock ──────────────────────────────

router.post('/ai-insights', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ success: false, error: 'Query is required' });

        let responseText = `आपकी खोज: "${query}"। हमारे AI एनालिटिक्स के अनुसार, जोधपुर और बीकानेर जिलों में कृषि योजनाओं की जागरूकता सबसे कम (४२%) दर्ज की गई है। इन जिलों में विशेष प्रचार शिविर (e-Mitra awareness drives) आयोजित करने की आवश्यकता है।`;

        if (query.includes('least') || query.includes('कम')) {
            responseText = `विश्लेषण रिपोर्ट: राजस्थान महिला निधि योजना के आवेदन जोधपुर मंडल में सबसे कम पाए गए हैं। इसका कारण जागरूकता का अभाव और स्वयं सहायता समूहों (SHGs) के बीच कम संपर्क दर है। विभाग को आगामी महीने में २० विशेष शिविर लगाने की सलाह दी जाती है।`;
        } else if (query.includes('popular') || query.includes('ज्यादा')) {
            responseText = `योजना रिपोर्ट: वर्तमान में राजस्थान फसल तारबंदी योजना (Crop Fencing Subsidy) ९५% लोकप्रियता स्कोर के साथ सबसे अधिक उपयोग की जाने वाली योजना है। जयपुर और भीलवाड़ा जिलों में कुल ७८% बजट वितरित किया जा चुका है।`;
        }

        res.json({ success: true, reply: responseText });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
