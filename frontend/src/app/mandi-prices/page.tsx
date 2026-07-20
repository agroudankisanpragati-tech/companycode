"use client";

import { useState } from 'react';
import { mandiApi, MandiPrice } from '@/services/mandibav';
import { usePageContext } from '@/hooks/usePageContext';

export default function MandiPricesPage() {
    const [commodity, setCommodity] = useState('');
    const [stateName, setStateName] = useState('');
    const [market, setMarket] = useState('');
    const [results, setResults] = useState<MandiPrice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Register top market result with Root AI
    const topResult = results[0];
    usePageContext({
        pageContext: 'market',
        marketData: topResult ? {
            commodity: topResult.commodity,
            market: topResult.market,
            state: topResult.state,
            modalPrice: topResult.modalPrice,
            minPrice: topResult.minPrice,
            maxPrice: topResult.maxPrice,
        } : undefined,
    });

    const search = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await mandiApi.getPrices({ commodity, state: stateName, market });
            setResults(res.data || []);
        } catch (err) {
            setError('Mandi API call failed. Configure NEXT_PUBLIC_MANDI_API_URL.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-white">
            <section className="section-container py-8 md:py-12">
                <h1 className="text-2xl md:text-3xl font-bold px-4">Mandi Bhav (Market Prices)</h1>
                <p className="mt-2 text-slate-600 text-sm md:text-base px-4">Search commodity prices from configured mandi API.</p>

                <form onSubmit={search} className="mt-6 grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3 px-4">
                    <input
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                        placeholder="Commodity (e.g., Tomato)"
                        className="rounded-lg border px-3 py-2 md:py-3 text-sm md:text-base min-h-10"
                    />
                    <input
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="State"
                        className="rounded-lg border px-3 py-2 md:py-3 text-sm md:text-base min-h-10"
                    />
                    <input
                        value={market}
                        onChange={(e) => setMarket(e.target.value)}
                        placeholder="Market"
                        className="rounded-lg border px-3 py-2 md:py-3 text-sm md:text-base min-h-10"
                    />
                    <div className="sm:col-span-3">
                        <button
                            className="btn-primary mt-2 md:mt-0 w-full md:w-auto py-2 md:py-3 text-sm md:text-base min-h-10"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 px-4">
                    {error ? <div className="text-red-600 text-sm md:text-base">{error}</div> : null}

                    {results.length ? (
                        <div className="mt-4 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
                            {results.map((r, idx) => (
                                <div key={idx} className="rounded-lg border p-4 md:p-5">
                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-xs md:text-sm text-slate-500 truncate">{r.market}, {r.state}</div>
                                            <div className="text-base md:text-lg font-semibold truncate">{r.commodity}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs md:text-sm text-slate-500">Modal Price</div>
                                            <div className="text-xl md:text-2xl font-bold">{r.modalPrice ?? '—'}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs md:text-sm text-slate-600">Date: {r.date}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 text-slate-500 text-sm md:text-base">No results yet.</div>
                    )}
                </div>
            </section>
            
        </main>
    );
}
