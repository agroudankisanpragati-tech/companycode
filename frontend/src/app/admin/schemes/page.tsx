'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
    FaPlus,
    FaTrash,
    FaEdit,
    FaSync,
    FaSeedling,
    FaCheckCircle,
    FaSpinner,
    FaShieldAlt,
    FaBuilding,
    FaUserGraduate,
    FaUsers,
    FaCheck,
    FaTimes,
    FaSearch
} from 'react-icons/fa';

export default function AdminSchemesPage() {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

    const [schemes, setSchemes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'central' | 'state'>('all');
    const [seedingLoading, setSeedingLoading] = useState(false);

    // Modal state for Add/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingScheme, setEditingScheme] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        description: '',
        department: '',
        audience: '',
        schemeType: 'state' as 'state' | 'central',
        state: 'Rajasthan',
        minAge: 18,
        maxAge: 70,
        maxIncome: 300000,
        occupation: 'farmer',
        category: 'obc',
        benefitsText: '',
        documentsText: '',
        officialLink: ''
    });

    // Fetch Schemes from MongoDB
    const fetchSchemes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/schemes?limit=100`);
            const data = await res.json();
            if (data.success) {
                setSchemes(data.data || []);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        fetchSchemes();
    }, [fetchSchemes]);

    // Re-seed 10 Real Government Schemes
    const handleSeedRealSchemes = async () => {
        if (!confirm('क्या आप डेटाबेस में 10 असली सरकारी योजनाएं लोड/अपडेट करना चाहते हैं?')) return;

        setSeedingLoading(true);
        try {
            const res = await fetch(`${API_BASE}/schemes/seed-force`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`सफलता! ${data.count} असली सरकारी योजनाएं डेटाबेस में लोड कर दी गई हैं।`);
                fetchSchemes();
            }
        } catch (err) {
            alert('सीडिंग में त्रुटि आई।');
        } finally {
            setSeedingLoading(false);
        }
    };

    // Open Modal for New Scheme
    const handleOpenCreateModal = () => {
        setEditingScheme(null);
        setFormData({
            title: '',
            summary: '',
            description: '',
            department: 'कृषि विभाग, राजस्थान सरकार',
            audience: 'राजस्थान के नागरिक एवं किसान',
            schemeType: 'state',
            state: 'Rajasthan',
            minAge: 18,
            maxAge: 70,
            maxIncome: 300000,
            occupation: 'farmer',
            category: 'obc',
            benefitsText: 'सब्सिडी अनुदान\nसीधे बैंक खाते में सहायता',
            documentsText: 'आधार कार्ड\nजन आधार कार्ड\nबैंक पासबुक',
            officialLink: 'https://rajasthan.gov.in'
        });
        setIsModalOpen(true);
    };

    // Save Scheme (Create or Update)
    const handleSaveScheme = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            title: formData.title,
            summary: formData.summary,
            description: formData.description,
            department: formData.department,
            audience: formData.audience,
            schemeType: formData.schemeType,
            state: formData.schemeType === 'state' ? formData.state : '',
            benefits: formData.benefitsText.split('\n').filter(Boolean),
            requiredDocumentsList: formData.documentsText.split('\n').filter(Boolean),
            officialLink: formData.officialLink,
            status: 'published',
            eligibilityRules: {
                minAge: Number(formData.minAge),
                maxAge: Number(formData.maxAge),
                maxIncome: Number(formData.maxIncome),
                occupations: [formData.occupation],
                categories: [formData.category],
                genders: ['any'],
                states: formData.schemeType === 'state' ? [formData.state] : ['any']
            }
        };

        try {
            const url = editingScheme ? `${API_BASE}/schemes/admin/${editingScheme._id}` : `${API_BASE}/schemes/admin`;
            const method = editingScheme ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                alert(editingScheme ? 'योजना सफलतापूर्वक अपडेट हो गई!' : 'नई सरकारी योजना डेटाबेस में जोड़ दी गई!');
                setIsModalOpen(false);
                fetchSchemes();
            } else {
                alert(data.error || 'सहेजने में त्रुटि।');
            }
        } catch (err) {
            console.error(err);
            alert('सहेजने में त्रुटि आई।');
        } finally {
            setLoading(false);
        }
    };

    // Delete Scheme
    const handleDeleteScheme = async (id: string, title: string) => {
        if (!confirm(`क्या आप '${title}' योजना को हटाना चाहते हैं?`)) return;

        try {
            const res = await fetch(`${API_BASE}/schemes/admin/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert('योजना हटा दी गई।');
                fetchSchemes();
            }
        } catch (err) {
            alert('हटाने में त्रुटि।');
        }
    };

    // Filtered Schemes List
    const filteredSchemes = schemes.filter(s => {
        const matchesSearch = s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || s.department?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || s.schemeType === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 font-sans">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Top Banner & Management Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                Admin Portal
                            </span>
                            <span className="text-xs text-slate-400">Government Schemes Manager</span>
                        </div>
                        <h1 className="text-2xl font-black text-white mt-1">सरकारी योजना प्रबंधन (Real Schemes Admin)</h1>
                        <p className="text-xs text-slate-400 mt-0.5">यहाँ से डेटाबेस में असली योजनाएं जोड़ें, अपडेट करें या लाइव री-सीड करें।</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleSeedRealSchemes}
                            disabled={seedingLoading}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-2"
                        >
                            {seedingLoading ? <FaSpinner className="animate-spin" /> : <FaSeedling />}
                            <span>🌱 10 रियल योजनाएं री-सीड करें</span>
                        </button>

                        <button
                            onClick={handleOpenCreateModal}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-2"
                        >
                            <FaPlus /> नई योजना जोड़ें
                        </button>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">कुल योजनाएं (Total)</span>
                        <p className="text-2xl font-black text-white mt-1">{schemes.length}</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">राजस्थान योजनाएं</span>
                        <p className="text-2xl font-black text-emerald-400 mt-1">{schemes.filter(s => s.schemeType === 'state').length}</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-[10px] text-sky-400 font-bold uppercase">केन्द्रीय योजनाएं</span>
                        <p className="text-2xl font-black text-sky-400 mt-1">{schemes.filter(s => s.schemeType === 'central').length}</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-[10px] text-purple-400 font-bold uppercase">औसत लोकप्रियता स्कोर</span>
                        <p className="text-2xl font-black text-purple-400 mt-1">93.5%</p>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                    <div className="relative flex-1 w-full">
                        <FaSearch className="absolute left-3 top-3 text-slate-500 text-xs" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="योजना का नाम या विभाग खोजें..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setTypeFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${typeFilter === 'all' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                        >
                            सभी ({schemes.length})
                        </button>
                        <button
                            onClick={() => setTypeFilter('state')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${typeFilter === 'state' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                        >
                            राज्य
                        </button>
                        <button
                            onClick={() => setTypeFilter('central')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${typeFilter === 'central' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                        >
                            केन्द्रीय
                        </button>
                    </div>
                </div>

                {/* Schemes Table / List */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500">
                            <FaSpinner className="animate-spin text-emerald-400 text-3xl mx-auto mb-2" />
                            <p className="text-xs">योजनाएं लोड हो रही हैं...</p>
                        </div>
                    ) : filteredSchemes.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <p className="text-xs">कोई योजना नहीं मिली। ऊपर '🌱 10 रियल योजनाएं री-सीड करें' बटन दबाएं।</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                                    <tr>
                                        <th className="py-3.5 px-4">योजना का शीर्षक</th>
                                        <th className="py-3.5 px-4">प्रकार / राज्य</th>
                                        <th className="py-3.5 px-4">विभाग</th>
                                        <th className="py-3.5 px-4">पात्रता नियम</th>
                                        <th className="py-3.5 px-4 text-right">कार्रवाई</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredSchemes.map((s) => (
                                        <tr key={s._id} className="hover:bg-slate-800/40 transition">
                                            <td className="py-3.5 px-4 font-bold text-white max-w-xs">
                                                <div className="space-y-0.5">
                                                    <span className="line-clamp-1">{s.title}</span>
                                                    <p className="text-[10px] text-slate-400 line-clamp-1 font-normal">{s.summary}</p>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.schemeType === 'state' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}`}>
                                                    {s.schemeType === 'state' ? `राज्य (${s.state || 'Rajasthan'})` : 'केन्द्रीय'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">{s.department}</td>
                                            <td className="py-3.5 px-4">
                                                <div className="text-[10px] space-y-0.5">
                                                    <p>आय: &lt; ₹{((s.eligibilityRules?.maxIncome || 500000) / 100000).toFixed(1)} लाख</p>
                                                    <p className="text-emerald-400">काम: {(s.eligibilityRules?.occupations || ['farmer']).join(', ')}</p>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleDeleteScheme(s._id, s.title)}
                                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/30 transition"
                                                    title="हटाएं"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            {/* ADD / EDIT SCHEME MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full my-8 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-white text-base">नई योजना जोड़ें (Add Real Scheme)</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSaveScheme} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-300 block mb-1">योजना का शीर्षक (Title):</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="उदा: राजस्थान फसल तारबंदी योजना"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="font-bold text-slate-300 block mb-1">विभाग (Department):</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="उदा: कृषि विभाग, राजस्थान सरकार"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-300 block mb-1">संक्षिप्त विवरण (Summary):</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.summary}
                                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                    placeholder="एक लाइन में मुख्य लाभ..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-300 block mb-1">विस्तृत विवरण (Description):</label>
                                <textarea
                                    rows={3}
                                    required
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="योजना का पूरा विवरण..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* Eligibility Rules Grid */}
                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                                <h4 className="font-bold text-emerald-400 text-xs">AI पात्रता नियम (Eligibility Rules)</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-400 block">न्यूनतम उम्र:</label>
                                        <input
                                            type="number"
                                            value={formData.minAge}
                                            onChange={(e) => setFormData({ ...formData, minAge: Number(e.target.value) })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 block">अधिकतम आय (₹):</label>
                                        <input
                                            type="number"
                                            value={formData.maxIncome}
                                            onChange={(e) => setFormData({ ...formData, maxIncome: Number(e.target.value) })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 block">व्यवसाय (Occupation):</label>
                                        <select
                                            value={formData.occupation}
                                            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white"
                                        >
                                            <option value="farmer">किसान (Farmer)</option>
                                            <option value="agricultural-laborer">मजदूर (Laborer)</option>
                                            <option value="student">छात्र (Student)</option>
                                            <option value="self-employed">स्वरोजगार (Self-Employed)</option>
                                            <option value="unemployed">बेरोजगार (Unemployed)</option>
                                            <option value="housewife">गृहिणी (Housewife)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 block">प्रकार (Type):</label>
                                        <select
                                            value={formData.schemeType}
                                            onChange={(e) => setFormData({ ...formData, schemeType: e.target.value as any })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white"
                                        >
                                            <option value="state">राज्य (State)</option>
                                            <option value="central">केन्द्रीय (Central)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold">
                                    रद्द करें
                                </button>
                                <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow">
                                    योजना सहेजें
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </main>
    );
}
