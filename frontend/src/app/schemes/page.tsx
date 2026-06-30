'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fetchPublishedSchemes, GovtScheme, SchemeType } from '@/services/schemes';

const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const formatDate = (value?: string) => {
    if (!value) return 'Recently published';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
};

export default function SchemesPage() {
    const [schemes, setSchemes] = useState<GovtScheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeType, setActiveType] = useState<'' | SchemeType>('');
    const [selectedState, setSelectedState] = useState('');

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchPublishedSchemes({
                search: debouncedSearch || undefined,
                schemeType: activeType || undefined,
                state: activeType === 'state' ? selectedState || undefined : undefined,
            });
            setSchemes(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load schemes');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, activeType, selectedState]);

    useEffect(() => { void load(); }, [load]);

    // Reset state when switching away from state tab
    useEffect(() => { if (activeType !== 'state') setSelectedState(''); }, [activeType]);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

    return (
        <main className="min-h-screen bg-gradient-to-b from-lime-50 via-white to-amber-50">
            <Navbar />

            {/* Hero */}
            <section className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.22),transparent_45%),radial-gradient(circle_at_80%_15%,rgba(245,158,11,0.2),transparent_40%)] py-14">
                <div className="section-container">
                    <span className="inline-flex rounded-full bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-green-700">Government Schemes</span>
                    <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">Find Subsidies, Support &amp; Welfare Schemes</h1>
                    <p className="mt-4 max-w-2xl text-base text-gray-700">Browse Central and State government schemes with eligibility details, benefits, and application links.</p>
                </div>
            </section>

            {/* Filters */}
            <section className="section-container pt-8 pb-4">
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-5">
                    {([['', 'All Schemes'], ['central', 'Central Government'], ['state', 'State Government']] as ['' | SchemeType, string][]).map(([type, label]) => (
                        <button
                            key={type}
                            onClick={() => setActiveType(type)}
                            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeType === type ? 'bg-green-700 text-white shadow-md' : 'bg-white border border-green-200 text-green-800 hover:bg-green-50'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by scheme name, state, keyword..."
                            className="w-full rounded-xl border border-green-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                        )}
                    </div>

                    {/* State dropdown (only for state tab) */}
                    {activeType === 'state' && (
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm focus:border-green-500 focus:outline-none"
                        >
                            <option value="">All States</option>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                </div>
            </section>

            {/* Results */}
            <section className="section-container py-8">
                {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">{error}</div>}

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                    </div>
                )}

                {!loading && !error && schemes.length === 0 && (
                    <div className="rounded-2xl border border-green-200 bg-white p-10 text-center text-gray-600 shadow-sm">
                        <p className="text-lg font-semibold mb-2">No schemes found</p>
                        <p className="text-sm text-gray-500">
                            {debouncedSearch || activeType ? 'Try adjusting your search or filters. Schemes may be fetched from external API automatically.' : 'No government schemes published yet. Please check back soon.'}
                        </p>
                    </div>
                )}

                {!loading && schemes.length > 0 && (
                    <>
                        <p className="mb-4 text-sm text-gray-500">{schemes.length} scheme{schemes.length !== 1 ? 's' : ''} found</p>
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {schemes.map((scheme) => (
                                <article key={scheme._id} className="group overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col">
                                    <div className="relative h-44 bg-gradient-to-br from-lime-200 via-emerald-100 to-amber-100 overflow-hidden flex-shrink-0">
                                        {scheme.coverImage || scheme.images?.[0] ? (
                                            <img
                                                src={(scheme.coverImage || scheme.images[0]).startsWith('/') ? `${API_BASE}${scheme.coverImage || scheme.images[0]}` : (scheme.coverImage || scheme.images[0])}
                                                alt={scheme.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center px-6 text-center text-lg font-bold text-green-800">{scheme.title}</div>
                                        )}
                                        <div className="absolute top-3 left-3 flex gap-1.5">
                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scheme.schemeType === 'central' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>
                                                {scheme.schemeType === 'central' ? 'Central' : 'State'}
                                            </span>
                                            {scheme.state && <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{scheme.state}</span>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col flex-1 p-5">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-700">{formatDate(scheme.publishedAt || scheme.createdAt)}</p>
                                        <h2 className="mt-2 text-lg font-bold leading-snug text-gray-900 line-clamp-2">{scheme.title}</h2>
                                        <p className="mt-1 text-sm font-medium text-emerald-700">{scheme.department}</p>
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 flex-1">{scheme.summary}</p>

                                        {scheme.benefits?.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {scheme.benefits.slice(0, 3).map((b) => (
                                                    <span key={b} className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">{b}</span>
                                                ))}
                                            </div>
                                        )}

                                        {scheme.tags?.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {scheme.tags.slice(0, 4).map((tag) => (
                                                    <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                                                ))}
                                            </div>
                                        )}

                                        <Link href={`/schemes/${scheme.slug}`} className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 self-start">
                                            View Details
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <Footer />
        </main>
    );
}
