'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { requestJson, requestFormData, formatDate, updateGovtScheme, deleteGovtScheme, uploadSchemeMedia, fetchSchemesFromAPI } from '@/components/admin/admin-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import type { GovtScheme, SchemeType } from '@/components/admin/admin-types';
import { ASSET_BASE } from '@/components/admin/admin-api';

const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'trans', label: 'Transgender' },
    { value: 'any', label: 'Any' },
];

const OCCUPATION_OPTIONS = [
    { value: 'farmer', label: 'Farmer / Agriculture' },
    { value: 'agricultural-laborer', label: 'Agricultural Laborer' },
    { value: 'student', label: 'Student' },
    { value: 'self-employed', label: 'Self Employed / Business' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'housewife', label: 'Housewife / Homemaker' },
    { value: 'private-service', label: 'Private Service' },
    { value: 'govt-service', label: 'Government Service' },
    { value: 'artisan', label: 'Artisan / Craftsman' },
    { value: 'retired', label: 'Retired / Pensioner' },
    { value: 'other', label: 'Other' },
    { value: 'any', label: 'Any' },
];

const CATEGORY_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'obc', label: 'OBC' },
    { value: 'sc', label: 'SC' },
    { value: 'st', label: 'ST' },
    { value: 'ews', label: 'EWS' },
    { value: 'any', label: 'Any' },
];

const DOCUMENT_CHECKLIST = [
    { value: 'Aadhaar Card', label: 'आधार कार्ड (Aadhaar Card)', hi: 'आधार कार्ड' },
    { value: 'Jan Aadhaar Card', label: 'जन आधार कार्ड (Jan Aadhaar Card)', hi: 'जन आधार कार्ड' },
    { value: 'Jamabandi (Land Record)', label: 'जमाबंदी की नक़ल (Land Record)', hi: 'जमाबंदी की नक़ल (६ महीने से पुरानी न हो)' },
    { value: 'Bank Passbook', label: 'बैंक पासबुक (Bank Passbook)', hi: 'बैंक पासबुक की कॉपी' },
    { value: 'Income Certificate', label: 'आय प्रमाण पत्र (Income Certificate)', hi: 'आय प्रमाण पत्र' },
    { value: 'Caste Certificate', label: 'जाति प्रमाण पत्र (Caste Certificate)', hi: 'जाति प्रमाण पत्र' },
    { value: 'Ration Card', label: 'राशन कार्ड (Ration Card)', hi: 'राशन कार्ड' },
    { value: 'Self Declaration', label: 'स्व-घोषणा पत्र (Self Declaration)', hi: 'स्व-घोषणा पत्र' },
];

const empty = () => ({
    title: '', summary: '', description: '', department: '', audience: '',
    benefits: '', eligibility: '', requiredDocuments: '', requiredDocumentsList: '',
    estimatedProcessingDays: '', popularityScore: '50',
    minAge: '', maxAge: '', maxIncome: '', maxLandHectares: '',
    genders: [] as string[], occupations: [] as string[], categories: [] as string[],
    states: 'any',
    applicationProcess: '', applicationLink: '', officialLink: '', coverImage: '',
    tags: '', keywords: '', schemeType: 'central' as SchemeType, state: '',
    status: 'published' as 'draft' | 'published', images: [] as string[], videos: [] as string[],
});

export default function CreateSchemePage() {
    const { token } = useAdmin();
    const [form, setForm] = useState(empty());
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [fetchingApi, setFetchingApi] = useState(false);
    const [schemes, setSchemes] = useState<GovtScheme[]>([]);
    const [loadingSchemes, setLoadingSchemes] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
    const [filterType, setFilterType] = useState<'' | SchemeType>('');
    const [filterState, setFilterState] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

    // Simulator State
    const [simAge, setSimAge] = useState('25');
    const [simIncome, setSimIncome] = useState('150000');
    const [simGender, setSimGender] = useState('male');
    const [simOccupation, setSimOccupation] = useState('farmer');
    const [simCategory, setSimCategory] = useState('obc');
    const [simState, setSimState] = useState('Rajasthan');
    const [simLand, setSimLand] = useState('1.5');
    const [simResult, setSimResult] = useState<{ eligible: boolean; reasons: string[] } | null>(null);

    const loadSchemes = async () => {
        if (!token) return;
        setLoadingSchemes(true);
        try {
            const qs = new URLSearchParams();
            if (filterType) qs.set('schemeType', filterType);
            if (filterState && filterType === 'state') qs.set('state', filterState);
            if (filterSearch) qs.set('search', filterSearch);
            const res = await requestJson<{ success: boolean; data: GovtScheme[] }>(
                `/schemes/admin/all${qs.toString() ? '?' + qs.toString() : ''}`, token
            );
            setSchemes(res.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load schemes');
        } finally {
            setLoadingSchemes(false);
        }
    };

    useEffect(() => { void loadSchemes(); }, [token, filterType, filterState, filterSearch]);

    const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value }));

    const handleUploadMedia = async (e: ChangeEvent<HTMLInputElement>, type: 'images' | 'videos') => {
        if (!token || !e.target.files?.length) return;
        setUploadingMedia(true);
        try {
            const fd = new FormData();
            Array.from(e.target.files).forEach((f) => fd.append(type, f));
            const res = await uploadSchemeMedia(token, fd);
            setForm((p) => ({ ...p, [type]: [...p[type], ...res.data[type]] }));
            setMessage(`${type === 'images' ? 'Images' : 'Videos'} uploaded successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploadingMedia(false);
            e.target.value = '';
        }
    };

    const removeMedia = (type: 'images' | 'videos', url: string) => {
        setForm((p) => ({ ...p, [type]: p[type].filter((u) => u !== url) }));
    };

    const handleFetchFromApi = async () => {
        if (!token) return;
        setFetchingApi(true);
        setError('');
        setMessage('');
        try {
            const res = await fetchSchemesFromAPI(token, form.schemeType, form.state || undefined);
            setMessage(res.message);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'API fetch failed');
        } finally {
            setFetchingApi(false);
        }
    };

    const toggleArrayItem = (key: 'genders' | 'occupations' | 'categories', val: string) => {
        setForm((prev) => {
            const arr = prev[key] as string[];
            const exists = arr.includes(val);
            const nextArr = exists ? arr.filter((x) => x !== val) : [...arr, val];
            return { ...prev, [key]: nextArr };
        });
    };

    const toggleDocument = (value: string, hiLabel: string) => {
        setForm((prev) => {
            const docsEng = prev.requiredDocuments.split(',').map(s => s.trim()).filter(Boolean);
            const docsHi = prev.requiredDocumentsList.split(',').map(s => s.trim()).filter(Boolean);

            const hasEng = docsEng.includes(value);
            const nextEng = hasEng ? docsEng.filter(x => x !== value) : [...docsEng, value];

            const hasHi = docsHi.includes(hiLabel);
            const nextHi = hasHi ? docsHi.filter(x => x !== hiLabel) : [...docsHi, hiLabel];

            return {
                ...prev,
                requiredDocuments: nextEng.join(', '),
                requiredDocumentsList: nextHi.join(', ')
            };
        });
    };

    const applyPreset = (preset: string) => {
        if (preset === 'farmer') {
            setForm(prev => ({
                ...prev,
                minAge: '18',
                maxAge: '75',
                maxIncome: '500000',
                genders: ['male', 'female', 'trans', 'any'],
                occupations: ['farmer'],
                categories: ['general', 'obc', 'sc', 'st', 'ews', 'any'],
                states: 'Rajasthan',
                requiredDocuments: 'Aadhaar Card, Jan Aadhaar Card, Jamabandi (Land Record), Bank Passbook',
                requiredDocumentsList: 'आधार कार्ड, जन आधार कार्ड, जमाबंदी की नक़ल (६ महीने से पुरानी न हो), बैंक पासबुक की कॉपी',
                tags: prev.tags ? prev.tags + ', farmer, subsidy' : 'farmer, subsidy',
                keywords: prev.keywords ? prev.keywords + ', pm kisan, rajasthan farmer' : 'pm kisan, rajasthan farmer'
            }));
            setMessage('Applied preset: Rajasthan Farmers Scheme');
        } else if (preset === 'women') {
            setForm(prev => ({
                ...prev,
                minAge: '18',
                maxAge: '65',
                maxIncome: '300000',
                genders: ['female'],
                occupations: ['farmer', 'self-employed', 'unemployed', 'housewife', 'any'],
                categories: ['general', 'obc', 'sc', 'st', 'ews', 'any'],
                states: 'Rajasthan',
                requiredDocuments: 'Aadhaar Card, Jan Aadhaar Card, Bank Passbook',
                requiredDocumentsList: 'आधार कार्ड, जन आधार कार्ड, बैंक पासबुक की कॉपी',
                tags: prev.tags ? prev.tags + ', women, self help' : 'women, self help',
                keywords: prev.keywords ? prev.keywords + ', mahila nidhi, rajivika' : 'mahila nidhi, rajivika'
            }));
            setMessage('Applied preset: Women Welfare / SHG Scheme');
        } else if (preset === 'labor') {
            setForm(prev => ({
                ...prev,
                minAge: '18',
                maxAge: '60',
                maxIncome: '250000',
                genders: ['male', 'female', 'trans', 'any'],
                occupations: ['agricultural-laborer'],
                categories: ['sc', 'st', 'obc', 'any'],
                states: 'Rajasthan',
                requiredDocuments: 'Aadhaar Card, Jan Aadhaar Card, Bank Passbook',
                requiredDocumentsList: 'आधार कार्ड, जन आधार कार्ड, बैंक पासबुक की कॉपी',
                tags: prev.tags ? prev.tags + ', labor, shramik' : 'labor, shramik',
                keywords: prev.keywords ? prev.keywords + ', krishak sathi, welfare' : 'krishak sathi, welfare'
            }));
            setMessage('Applied preset: Laborer / Workers Welfare');
        } else if (preset === 'student') {
            setForm(prev => ({
                ...prev,
                minAge: '15',
                maxAge: '28',
                maxIncome: '200000',
                genders: ['male', 'female', 'trans', 'any'],
                occupations: ['student'],
                categories: ['sc', 'st', 'obc', 'ews', 'any'],
                states: 'any',
                requiredDocuments: 'Aadhaar Card, Jan Aadhaar Card, Income Certificate',
                requiredDocumentsList: 'आधार कार्ड, जन आधार कार्ड, आय प्रमाण पत्र',
                tags: prev.tags ? prev.tags + ', student, scholarship' : 'student, scholarship',
                keywords: prev.keywords ? prev.keywords + ', scholarship, education' : 'scholarship, education'
            }));
            setMessage('Applied preset: Student Scholarship');
        }
    };

    const runSimulation = () => {
        const ageVal = form.minAge ? Number(form.minAge) : 0;
        const maxAgeVal = form.maxAge ? Number(form.maxAge) : 999;
        const incomeVal = form.maxIncome ? Number(form.maxIncome) : Infinity;
        const landVal = form.maxLandHectares ? Number(form.maxLandHectares) : Infinity;
        
        const userAge = Number(simAge);
        const userIncome = Number(simIncome);
        const userLand = Number(simLand);
        
        const reasons: string[] = [];
        let eligible = true;
        
        if (form.schemeType === 'state' && form.state) {
            if (form.state.toLowerCase() !== simState.toLowerCase() && simState.toLowerCase() !== 'any') {
                eligible = false;
                reasons.push(`State Mismatch: Scheme is specific to ${form.state} (Simulated User: ${simState}).`);
            }
        }
        
        if (userAge < ageVal) {
            eligible = false;
            reasons.push(`Underage: Requires minimum ${ageVal} years (Simulated User: ${userAge} years).`);
        }
        if (userAge > maxAgeVal) {
            eligible = false;
            reasons.push(`Overage: Maximum allowed is ${maxAgeVal} years (Simulated User: ${userAge} years).`);
        }
        
        if (userIncome > incomeVal) {
            eligible = false;
            reasons.push(`Income Limit Exceeded: Cap is ₹${incomeVal.toLocaleString()} (Simulated User: ₹${userIncome.toLocaleString()}).`);
        }

        if (userLand > landVal) {
            eligible = false;
            reasons.push(`Land Limit Exceeded: Cap is ${landVal} Hectares (Simulated User: ${userLand} Hectares).`);
        }
        
        if (form.genders.length > 0 && !form.genders.includes('any')) {
            if (!form.genders.includes(simGender) && simGender !== 'any') {
                eligible = false;
                reasons.push(`Gender Mismatch: Allowed is ${form.genders.join('/')} (Simulated User: ${simGender}).`);
            }
        }
        
        if (form.occupations.length > 0 && !form.occupations.includes('any')) {
            if (!form.occupations.includes(simOccupation) && simOccupation !== 'any') {
                eligible = false;
                reasons.push(`Occupation Mismatch: Allowed is ${form.occupations.join('/')} (Simulated User: ${simOccupation}).`);
            }
        }
        
        if (form.categories.length > 0 && !form.categories.includes('any')) {
            if (!form.categories.includes(simCategory) && simCategory !== 'any') {
                eligible = false;
                reasons.push(`Caste Category Mismatch: Allowed is ${form.categories.join(', ')} (Simulated User: ${simCategory}).`);
            }
        }
        
        setSimResult({ eligible, reasons });
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!token) { setError('Admin token missing. Please re-login.'); return; }
        setSubmitting(true);
        setError('');
        setMessage('');
        const payload = {
            title: form.title,
            summary: form.summary,
            description: form.description,
            department: form.department,
            audience: form.audience,
            benefits: form.benefits.split(',').map((s) => s.trim()).filter(Boolean),
            eligibility: form.eligibility,
            requiredDocuments: form.requiredDocuments.split(',').map((s) => s.trim()).filter(Boolean),
            requiredDocumentsList: form.requiredDocumentsList.split(',').map((s) => s.trim()).filter(Boolean),
            estimatedProcessingDays: form.estimatedProcessingDays ? Number(form.estimatedProcessingDays) : undefined,
            popularityScore: form.popularityScore ? Number(form.popularityScore) : undefined,
            eligibilityRules: {
                minAge: form.minAge ? Number(form.minAge) : undefined,
                maxAge: form.maxAge ? Number(form.maxAge) : undefined,
                maxIncome: form.maxIncome ? Number(form.maxIncome) : undefined,
                maxLandHectares: form.maxLandHectares ? Number(form.maxLandHectares) : undefined,
                genders: form.genders,
                occupations: form.occupations,
                categories: form.categories,
                states: form.states.split(',').map((s) => s.trim()).filter(Boolean),
            },
            applicationProcess: form.applicationProcess,
            applicationLink: form.applicationLink,
            officialLink: form.officialLink,
            coverImage: form.coverImage,
            images: form.images,
            videos: form.videos,
            tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
            keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
            schemeType: form.schemeType,
            state: form.schemeType === 'state' ? form.state : '',
            status: form.status,
        };
        try {
            if (editingId) {
                await updateGovtScheme(token, editingId, payload);
                setMessage('Scheme updated successfully.');
            } else {
                await requestJson('/schemes/admin', token, { method: 'POST', body: JSON.stringify(payload) });
                setMessage(form.status === 'published' ? 'Scheme published successfully.' : 'Draft saved successfully.');
            }
            setForm(empty());
            setEditingId(null);
            setSimResult(null);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save scheme');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (s: GovtScheme) => {
        setForm({
            title: s.title,
            summary: s.summary,
            description: s.description,
            department: s.department,
            audience: s.audience,
            benefits: s.benefits.join(', '),
            eligibility: s.eligibility || '',
            requiredDocuments: (s.requiredDocuments || []).join(', '),
            requiredDocumentsList: (s.requiredDocumentsList || []).join(', '),
            estimatedProcessingDays: s.estimatedProcessingDays !== undefined ? String(s.estimatedProcessingDays) : '',
            popularityScore: s.popularityScore !== undefined ? String(s.popularityScore) : '50',
            minAge: s.eligibilityRules?.minAge !== undefined ? String(s.eligibilityRules.minAge) : '',
            maxAge: s.eligibilityRules?.maxAge !== undefined ? String(s.eligibilityRules.maxAge) : '',
            maxIncome: s.eligibilityRules?.maxIncome !== undefined ? String(s.eligibilityRules.maxIncome) : '',
            maxLandHectares: s.eligibilityRules?.maxLandHectares !== undefined ? String(s.eligibilityRules.maxLandHectares) : '',
            genders: s.eligibilityRules?.genders || [],
            occupations: s.eligibilityRules?.occupations || [],
            categories: s.eligibilityRules?.categories || [],
            states: (s.eligibilityRules?.states || []).join(', ') || 'any',
            applicationProcess: s.applicationProcess || '',
            applicationLink: s.applicationLink || '',
            officialLink: s.officialLink || '',
            coverImage: s.coverImage || '',
            tags: s.tags.join(', '),
            keywords: (s.keywords || []).join(', '),
            schemeType: s.schemeType || 'central',
            state: s.state || '',
            status: s.status,
            images: s.images || [],
            videos: s.videos || [],
        });
        setEditingId(s._id);
        setMessage('');
        setError('');
        setSimResult(null);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        try {
            await deleteGovtScheme(token, id);
            setMessage('Scheme deleted.');
            setDeleteConfirm(null);
            await loadSchemes();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const handleCancel = () => { setForm(empty()); setEditingId(null); setSimResult(null); setMessage(''); setError(''); };

    const mediaBase = ASSET_BASE;

    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">{editingId ? 'Edit Government Scheme' : 'Create Government Scheme'}</h2>
                    <p className="mt-2 text-sm text-slate-400">Manage Central and State government schemes visible on the farmer portal.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => applyPreset('farmer')} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">🌾 Farmer Preset</button>
                    <button type="button" onClick={() => applyPreset('women')} className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3.5 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition">👩‍💼 Women Preset</button>
                    <button type="button" onClick={() => applyPreset('labor')} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition">🚜 Laborer Preset</button>
                    <button type="button" onClick={() => applyPreset('student')} className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition">🎓 Student Preset</button>
                </div>
            </div>

            {message ? <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
            {error ? <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

            <div ref={formRef}>
            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-6">
                {/* Scheme Type */}
                <div className="grid gap-4 lg:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Scheme Type *</span>
                        <select className="admin-input w-full" value={form.schemeType} onChange={set('schemeType')}>
                            <option value="central">Central Government</option>
                            <option value="state">State Government</option>
                        </select>
                    </label>

                    {form.schemeType === 'state' && (
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>State *</span>
                            <select className="admin-input w-full" value={form.state} onChange={set('state')} required>
                                <option value="">Select State</option>
                                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                    )}

                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Status</span>
                        <select className="admin-input w-full" value={form.status} onChange={set('status')}>
                            <option value="published">Publish now</option>
                            <option value="draft">Save as draft</option>
                        </select>
                    </label>
                </div>

                {/* Basic Info */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Scheme Title *</span>
                        <input className="admin-input w-full" value={form.title} onChange={set('title')} placeholder="Enter scheme title" required />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Department *</span>
                        <input className="admin-input w-full" value={form.department} onChange={set('department')} placeholder="Ministry of Agriculture" required />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Summary *</span>
                        <input className="admin-input w-full" value={form.summary} onChange={set('summary')} placeholder="Short scheme summary" required />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Target Audience *</span>
                        <input className="admin-input w-full" value={form.audience} onChange={set('audience')} placeholder="Small farmers, women SHGs" required />
                    </label>
                </div>

                <label className="space-y-2 text-sm text-slate-300">
                    <span>Detailed Description *</span>
                    <textarea className="admin-input min-h-[120px] w-full resize-none" value={form.description} onChange={set('description')} placeholder="Explain the scheme in detail..." required />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Eligibility Overview</span>
                        <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.eligibility} onChange={set('eligibility')} placeholder="Brief textual description of eligibility..." />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Application Process</span>
                        <textarea className="admin-input min-h-[80px] w-full resize-none" value={form.applicationProcess} onChange={set('applicationProcess')} placeholder="How to apply step by step..." />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Benefits (comma separated)</span>
                        <input className="admin-input w-full" value={form.benefits} onChange={set('benefits')} placeholder="Subsidy, training, loan support" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Cover Image URL</span>
                        <input className="admin-input w-full" value={form.coverImage} onChange={set('coverImage')} placeholder="https://example.com/scheme.jpg" />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Application Link</span>
                        <input className="admin-input w-full" value={form.applicationLink} onChange={set('applicationLink')} placeholder="https://..." />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Official Link</span>
                        <input className="admin-input w-full" value={form.officialLink} onChange={set('officialLink')} placeholder="https://official-site.gov.in" />
                    </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Tags (comma separated)</span>
                        <input className="admin-input w-full" value={form.tags} onChange={set('tags')} placeholder="subsidy, loan, welfare" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                        <span>Keywords (comma separated — used for search)</span>
                        <input className="admin-input w-full" value={form.keywords} onChange={set('keywords')} placeholder="pm kisan, drip irrigation, crop insurance" />
                    </label>
                </div>

                {/* Document Picker Checkbox Section */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white">Required Documents Checklist</h4>
                    <p className="text-xs text-slate-400">Select documents to automatically fill English and Hindi arrays, or edit details manually below.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {DOCUMENT_CHECKLIST.map((doc) => {
                            const activeDocs = form.requiredDocuments.split(',').map(s => s.trim()).filter(Boolean);
                            const checked = activeDocs.includes(doc.value);
                            return (
                                <label key={doc.value} className="flex items-start gap-2.5 cursor-pointer text-slate-300 hover:text-white transition">
                                    <input type="checkbox" checked={checked} onChange={() => toggleDocument(doc.value, doc.hi)} className="mt-1 rounded border-white/10 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20" />
                                    <div className="text-sm">
                                        <p className="font-medium text-slate-200">{doc.label}</p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2 mt-4 pt-3 border-t border-white/5">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Required Documents (English names, comma separated)</span>
                            <input className="admin-input w-full" value={form.requiredDocuments} onChange={set('requiredDocuments')} placeholder="Aadhaar Card, Jan Aadhaar Card" />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Required Documents List (Hindi labels, comma separated)</span>
                            <input className="admin-input w-full" value={form.requiredDocumentsList} onChange={set('requiredDocumentsList')} placeholder="आधार कार्ड, जन आधार कार्ड" />
                        </label>
                    </div>
                </div>

                {/* Scheme Details (Advanced) */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white font-medium">Advanced Performance Settings</h4>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Estimated Processing Days</span>
                            <input type="number" className="admin-input w-full" value={form.estimatedProcessingDays} onChange={set('estimatedProcessingDays')} placeholder="e.g. 30" />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Popularity Score (1-100 — used for ranking in matching)</span>
                            <input type="number" className="admin-input w-full" value={form.popularityScore} onChange={set('popularityScore')} placeholder="e.g. 95" />
                        </label>
                    </div>
                </div>

                {/* AI Seva Mitra Eligibility Rules */}
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-emerald-400 font-medium">AI Seva Mitra: Eligibility Matching Rules</h4>
                    
                    <div className="grid gap-4 lg:grid-cols-4">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Minimum Age Constraint</span>
                            <input type="number" className="admin-input w-full" value={form.minAge} onChange={set('minAge')} placeholder="e.g. 18" />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Maximum Age Constraint</span>
                            <input type="number" className="admin-input w-full" value={form.maxAge} onChange={set('maxAge')} placeholder="e.g. 65" />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Maximum Annual Income Constraint (₹)</span>
                            <input type="number" className="admin-input w-full" value={form.maxIncome} onChange={set('maxIncome')} placeholder="e.g. 500000" />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Maximum Land Constraint (Hectares)</span>
                            <input type="number" step="0.1" className="admin-input w-full" value={form.maxLandHectares} onChange={set('maxLandHectares')} placeholder="e.g. 2.0" />
                        </label>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span>Allowed States (comma separated)</span>
                            <input className="admin-input w-full" value={form.states} onChange={set('states')} placeholder="Rajasthan, Haryana or any" />
                        </label>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-slate-300 block font-medium">Allowed Genders</span>
                        <div className="flex flex-wrap gap-4">
                            {GENDER_OPTIONS.map((opt) => {
                                const checked = form.genders.includes(opt.value);
                                return (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input type="checkbox" checked={checked} onChange={() => toggleArrayItem('genders', opt.value)} className="rounded border-white/10 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20" />
                                        <span>{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-slate-300 block font-medium">Allowed Occupations</span>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                            {OCCUPATION_OPTIONS.map((opt) => {
                                const checked = form.occupations.includes(opt.value);
                                return (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input type="checkbox" checked={checked} onChange={() => toggleArrayItem('occupations', opt.value)} className="rounded border-white/10 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20" />
                                        <span className="truncate text-xs">{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-slate-300 block font-medium">Allowed Caste Categories</span>
                        <div className="flex flex-wrap gap-4">
                            {CATEGORY_OPTIONS.map((opt) => {
                                const checked = form.categories.includes(opt.value);
                                return (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input type="checkbox" checked={checked} onChange={() => toggleArrayItem('categories', opt.value)} className="rounded border-white/10 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20" />
                                        <span>{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Simulator Section */}
                <div className="space-y-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
                    <div>
                        <h4 className="text-sm font-semibold text-cyan-400">🔍 AI Seva Mitra Matching Simulator</h4>
                        <p className="text-xs text-slate-400 mt-1">Test your eligibility parameters against a simulated user profile before saving/publishing.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Age (Years)</span>
                            <input type="number" className="admin-input text-xs py-1.5" value={simAge} onChange={(e) => setSimAge(e.target.value)} />
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Annual Income (₹)</span>
                            <input type="number" className="admin-input text-xs py-1.5" value={simIncome} onChange={(e) => setSimIncome(e.target.value)} />
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Land (Hectares)</span>
                            <input type="number" step="0.1" className="admin-input text-xs py-1.5" value={simLand} onChange={(e) => setSimLand(e.target.value)} />
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Gender</span>
                            <select className="admin-input text-xs py-1.5" value={simGender} onChange={(e) => setSimGender(e.target.value)}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="trans">Transgender</option>
                            </select>
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Occupation</span>
                            <select className="admin-input text-xs py-1.5 font-sans" value={simOccupation} onChange={(e) => setSimOccupation(e.target.value)}>
                                {OCCUPATION_OPTIONS.filter(o => o.value !== 'any').map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Category</span>
                            <select className="admin-input text-xs py-1.5" value={simCategory} onChange={(e) => setSimCategory(e.target.value)}>
                                {CATEGORY_OPTIONS.filter(c => c.value !== 'any').map(c => (
                                    <option key={c.value} value={c.value}>{c.label.toUpperCase()}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5 text-xs text-slate-300">
                            <span>Residency State</span>
                            <select className="admin-input text-xs py-1.5" value={simState} onChange={(e) => setSimState(e.target.value)}>
                                <option value="Rajasthan">Rajasthan</option>
                                <option value="Haryana">Haryana</option>
                                <option value="Madhya Pradesh">Madhya Pradesh</option>
                                <option value="Uttar Pradesh">Uttar Pradesh</option>
                                <option value="Delhi">Delhi</option>
                                <option value="Gujarat">Gujarat</option>
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-white/5">
                        <button type="button" onClick={runSimulation} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-950/20 transition duration-200">
                            Run Match Verification
                        </button>
                        
                        {simResult && (
                            <div className={`flex-1 rounded-xl px-4 py-2 border text-xs flex items-center justify-between gap-4 ${simResult.eligible ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    {simResult.eligible ? '✔️ User Eligible' : '❌ User Ineligible'}
                                </span>
                                <span className="italic truncate text-slate-400">
                                    {simResult.eligible ? 'All eligibility criteria satisfied.' : simResult.reasons.join(' | ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Media Upload */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white">Media Upload</h4>
                    <div className="flex flex-wrap gap-3">
                        <div>
                            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadMedia(e, 'images')} />
                            <button type="button" disabled={uploadingMedia} onClick={() => imageInputRef.current?.click()} className="admin-button-secondary text-sm px-4 py-2">
                                {uploadingMedia ? 'Uploading...' : '+ Upload Images'}
                            </button>
                        </div>
                        <div>
                            <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleUploadMedia(e, 'videos')} />
                            <button type="button" disabled={uploadingMedia} onClick={() => videoInputRef.current?.click()} className="admin-button-secondary text-sm px-4 py-2">
                                {uploadingMedia ? 'Uploading...' : '+ Upload Videos'}
                            </button>
                        </div>
                    </div>

                    {form.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.images.map((url) => (
                                <div key={url} className="relative group">
                                    <img src={url.startsWith('/') ? `${mediaBase}${url}` : url} alt="" className="h-20 w-20 rounded-lg object-cover border border-white/10" />
                                    <button type="button" onClick={() => removeMedia('images', url)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {form.videos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {form.videos.map((url) => (
                                <div key={url} className="relative group">
                                    <video src={url.startsWith('/') ? `${mediaBase}${url}` : url} className="h-20 w-32 rounded-lg object-cover border border-white/10" muted />
                                    <button type="button" onClick={() => removeMedia('videos', url)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end pt-4 border-t border-white/5">
                    {editingId && (
                        <button type="button" onClick={handleCancel} className="admin-button-secondary px-6 py-3">Cancel</button>
                    )}
                    <button type="submit" disabled={submitting} className="admin-button-primary px-6 py-3 disabled:opacity-60">
                        {submitting ? 'Saving...' : editingId ? 'Update Scheme' : form.status === 'published' ? 'Publish Scheme' : 'Save Draft'}
                    </button>
                </div>
            </form>
            </div>

            {/* ── Schemes List ── */}
            <section className="glass-panel rounded-3xl p-6">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white">All Government Schemes</h3>
                        <p className="mt-1 text-sm text-slate-400">Admin-created and API-imported schemes from the same database.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button type="button" onClick={handleFetchFromApi} disabled={fetchingApi} className="admin-button-secondary text-sm px-4 py-2 disabled:opacity-60">
                            {fetchingApi ? 'Fetching...' : 'Fetch from API'}
                        </button>
                        <button type="button" onClick={loadSchemes} className="admin-button-secondary text-sm px-4 py-2">Refresh</button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-3">
                    <select className="admin-input text-sm py-1.5" value={filterType} onChange={(e) => setFilterType(e.target.value as '' | SchemeType)}>
                        <option value="">All Types</option>
                        <option value="central">Central</option>
                        <option value="state">State</option>
                    </select>
                    {filterType === 'state' && (
                        <select className="admin-input text-sm py-1.5" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                            <option value="">All States</option>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                    <input
                        className="admin-input text-sm py-1.5 flex-1 min-w-[200px]"
                        placeholder="Search by name, state, tag..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                    />
                </div>

                {loadingSchemes && <p className="text-sm text-slate-400">Loading schemes...</p>}
                {!loadingSchemes && schemes.length === 0 && <p className="text-sm text-slate-400">No schemes found.</p>}

                <div className="grid gap-4 md:grid-cols-2">
                    {schemes.map((s) => (
                        <article key={s._id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-semibold text-white truncate">{s.title}</h4>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === 'published' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>{s.status}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.schemeType === 'central' ? 'bg-sky-400/20 text-sky-200' : 'bg-violet-400/20 text-violet-200'}`}>{s.schemeType}</span>
                                            {s.state && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{s.state}</span>}
                                            {s.source === 'api' && <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-xs text-orange-200">API</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button type="button" onClick={() => handleEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-blue-400" title="Edit">✏️</button>
                                        <button type="button" onClick={() => setDeleteConfirm({ id: s._id, title: s.title })} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-red-400" title="Delete">🗑️</button>
                                    </div>
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs text-slate-400">{s.summary}</p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                                <span>Updated: {formatDate(s.updatedAt)}</span>
                                {s.eligibilityRules && (
                                    <span className="text-emerald-400 font-semibold font-sans">Rules Configured</span>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6">
                        <h3 className="text-lg font-bold text-white">Delete Scheme?</h3>
                        <p className="mt-3 text-sm text-slate-300">Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>? This cannot be undone.</p>
                        <div className="mt-6 flex gap-3">
                            <button type="button" onClick={() => setDeleteConfirm(null)} className="admin-button-secondary flex-1 rounded-lg px-4 py-2">Cancel</button>
                            <button type="button" onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-red-200 hover:bg-red-500/30">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
