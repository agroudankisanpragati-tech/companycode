'use client';

import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { useAIAssistant } from '@/context/AIAssistantContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import FarmerFooter from '@/components/FarmerFooter';
import FarmerSidebar from '@/components/FarmerSidebar';
import AiFarmSection from '@/components/AiFarmSection';
import SuccessStoriesSection from '@/components/SuccessStoriesSection';
import MarketSnapshotCard from '@/components/dashboard/MarketSnapshotCard';
import LocationModal from '@/components/LocationModal';
import {
    FaBell, FaMapMarkerAlt, FaMicrophone, FaCloudSun, FaTint,
    FaMicroscope, FaArrowRight, FaWind, FaLeaf, FaSpinner,
} from 'react-icons/fa';
import { fetchWeather, fetchWeatherByLocation } from '@/services/weather';
import { getSoilMoisture, SoilMoistureData } from '@/services/soilMoisture';

export default function FarmerDashboard() {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const { location, isReady, onLocationChange } = useLocation();
    const { toggleAssistant } = useAIAssistant();
    const router = useRouter();

    const [locationModalOpen, setLocationModalOpen] = useState(false);

    const [weather, setWeather] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    const [moisture, setMoisture] = useState<SoilMoistureData | null>(null);
    const [moistureLoading, setMoistureLoading] = useState(false);
    const [moistureError, setMoistureError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; body: React.ReactNode } | null>(null);

    // ── Auth guard ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/auth/login');
        } else if (!isLoading && user?.role !== 'farmer') {
            router.replace('/auth/role-select');
        }
    }, [isAuthenticated, isLoading, user, router]);

    // ── Weather fetch — uses lat/lng if available, fallback to state name ────
    const loadWeather = useCallback(async () => {
        if (!location.state) return;
        setWeatherLoading(true);
        try {
            let w: any;
            if (location.latitude && location.longitude) {
                w = await fetchWeather(location.latitude, location.longitude);
            } else {
                const query = location.district
                    ? `${location.district}, ${location.state}, India`
                    : location.state;
                w = await fetchWeatherByLocation(query);
            }
            setWeather(w);
        } catch { /* silent */ } finally {
            setWeatherLoading(false);
        }
    }, [location]);

    // ── Soil moisture fetch ──────────────────────────────────────────────────
    const loadMoisture = useCallback(async () => {
        if (!isAuthenticated) return;
        setMoistureLoading(true);
        setMoistureError(null);
        try {
            const res = await getSoilMoisture();
            setMoisture(res.data);
        } catch (err: any) {
            setMoistureError(err?.status === 422 ? 'location_missing' : 'fetch_error');
        } finally {
            setMoistureLoading(false);
        }
    }, [isAuthenticated]);

    // ── Initial load once location is ready ─────────────────────────────────
    useEffect(() => {
        if (!isReady || !isAuthenticated) return;
        loadWeather();
        loadMoisture();
    }, [isReady, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Re-fetch all cards when location changes ─────────────────────────────
    useEffect(() => {
        return onLocationChange(() => {
            loadWeather();
            loadMoisture();
        });
    }, [onLocationChange, loadWeather, loadMoisture]);

    // ── Derived weather values ───────────────────────────────────────────────
    const currentWeather = weather?.data?.current ?? weather?.current ?? {};
    const weatherLabel = currentWeather?.weather?.text || currentWeather?.weather?.main || 'Partly cloudy';
    const weatherTemp = currentWeather?.temp ?? 32;
    const weatherHumidity = currentWeather?.humidity ?? 68;
    const weatherWind = currentWeather?.wind_kph ?? currentWeather?.wind_speed ?? 12;

    // ── Modal helpers ────────────────────────────────────────────────────────
    function showMoistureModal() {
        if (!moisture) return;
        setModalContent({
            title: 'Soil Moisture Details',
            body: (
                <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-cyan-50 p-3"><div className="text-xs text-slate-500">Moisture</div><div className="text-xl font-bold text-slate-800">{moisture.moisturePercentage}%</div></div>
                        <div className="rounded-xl bg-cyan-50 p-3"><div className="text-xs text-slate-500">Status</div><div className="font-bold text-slate-800">{moisture.moistureStatus}</div></div>
                        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">State</div><div className="font-semibold text-slate-700">{moisture.state}</div></div>
                        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">District</div><div className="font-semibold text-slate-700">{moisture.district}</div></div>
                        {moisture.humidity != null && <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Humidity</div><div className="font-semibold text-slate-700">{moisture.humidity}%</div></div>}
                        {moisture.rainfallMm != null && <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Rainfall</div><div className="font-semibold text-slate-700">{moisture.rainfallMm} mm</div></div>}
                    </div>
                    <div className="text-xs text-slate-400">Updated: {new Date(moisture.lastUpdated).toLocaleString('en-IN')}</div>
                    <button onClick={() => { setModalOpen(false); loadMoisture(); }} className="text-xs font-semibold text-emerald-600 underline">Refresh</button>
                </div>
            ),
        });
        setModalOpen(true);
    }

    if (isLoading || !isAuthenticated) return null;

    const hasLocation = !!(location.state && location.district);

    return (
        <>
            <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
                <FarmerSidebar open={true} onClose={() => undefined} />

                <div className="flex-1 flex flex-col">
                    {/* ── Header ── */}
                    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-transparent">
                        <div className="text-2xl md:text-3xl font-extrabold font-sans text-slate-800">
                            <span className="mr-2">Good morning,</span>
                            {user?.name
                                ? <><span className="text-emerald-700">{user.name}</span><span className="ml-2">! 👋</span></>
                                : <span className="text-emerald-700">Farmer</span>
                            }
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Location button — shows current location or prompt */}
                            <button
                                onClick={() => setLocationModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm rounded-md text-sm hover:bg-emerald-50 transition"
                            >
                                <FaMapMarkerAlt className="text-emerald-600" />
                                <span className="max-w-[140px] truncate">
                                    {hasLocation
                                        ? `${location.district}, ${location.state}`
                                        : 'Select location'
                                    }
                                </span>
                            </button>

                            <button aria-label="Notifications" className="p-2 rounded-md hover:bg-gray-100 border border-emerald-500">
                                <FaBell className="text-xl text-slate-700" />
                            </button>

                            <button onClick={toggleAssistant} aria-label="AI Assistant" className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                                <FaMicrophone className="text-xl text-white" />
                                <span className="text-sm font-medium text-white">AI Assistant</span>
                            </button>

                            <button
                                onClick={() => { logout(); router.push('/auth/role-select'); }}
                                className="ml-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-slate-700 hover:bg-gray-50"
                            >
                                Logout
                            </button>
                        </div>
                    </header>

                    {/* ── Location missing banner ── */}
                    {isReady && !hasLocation && (
                        <div className="mx-6 mt-4 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                            <span>📍 Set your location to get live weather, soil moisture & mandi prices.</span>
                            <button
                                onClick={() => setLocationModalOpen(true)}
                                className="ml-4 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                            >
                                Set Location
                            </button>
                        </div>
                    )}

                    <main className="flex-1 p-6">
                        <section className="mb-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                                {/* ── Weather Card ── */}
                                <div
                                    onClick={() => {
                                        if (!hasLocation) { setLocationModalOpen(true); return; }
                                        setModalContent({ title: 'Weather Details', body: <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(currentWeather, null, 2)}</pre> });
                                        setModalOpen(true);
                                    }}
                                    className="cursor-pointer h-[17.58rem] rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50 to-amber-50 p-4 shadow-sm hover:shadow-md transition overflow-hidden"
                                >
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Weather Today</div>
                                            <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur">Live</div>
                                        </div>

                                        <div className="relative mt-3 flex flex-1 items-center justify-center rounded-3xl bg-white/55 px-4 py-4 shadow-inner backdrop-blur-sm">
                                            <div className="absolute -left-5 top-3 h-20 w-20 rounded-full bg-sky-300/30 blur-2xl" />
                                            <div className="absolute -right-3 bottom-0 h-24 w-24 rounded-full bg-amber-300/30 blur-2xl" />
                                            {!hasLocation ? (
                                                <div className="text-center text-xs text-slate-400">Set location to view weather</div>
                                            ) : (
                                                <div className="relative flex flex-col items-center text-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-400 to-amber-300 text-white shadow-lg">
                                                            <FaCloudSun className="text-4xl" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                                                                {weatherLoading ? '—' : `${Math.round(weatherTemp)}°C`}
                                                            </div>
                                                            <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">{weatherLabel}</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 grid w-full grid-cols-2 gap-3">
                                                        <div className="rounded-2xl bg-sky-50 px-3 py-2 text-left shadow-sm">
                                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700"><FaTint />Humidity</div>
                                                            <div className="mt-1 text-base font-bold text-slate-800">{weatherLoading ? '—' : `${Math.round(weatherHumidity)}%`}</div>
                                                        </div>
                                                        <div className="rounded-2xl bg-cyan-50 px-3 py-2 text-left shadow-sm">
                                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-700"><FaWind />Wind</div>
                                                            <div className="mt-1 text-base font-bold text-slate-800">{weatherLoading ? '—' : `${Math.round(weatherWind)} km/h`}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full mt-3">
                                            <button className="w-full -mx-4 flex items-center justify-between gap-2 border-t border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 rounded-b-2xl">
                                                <span>View forecast</span>
                                                <FaArrowRight className="text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Soil Moisture Card ── */}
                                <div className="cursor-pointer h-[17.58rem] rounded-2xl bg-cyan-50 p-4 shadow-sm hover:shadow-md transition">
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="flex items-center gap-3 rounded-2xl bg-cyan-100 px-4 py-3 shadow-sm w-full">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-200 text-cyan-700 flex-shrink-0">
                                                {moistureLoading ? <FaSpinner className="text-lg animate-spin" /> : <FaTint className="text-xl" />}
                                            </div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Soil Moisture</div>
                                        </div>

                                        <div className="flex flex-1 flex-col items-center justify-center text-center gap-2 mt-2">
                                            {moistureLoading && <div className="text-sm text-slate-400">Fetching live data…</div>}

                                            {!moistureLoading && moistureError === 'location_missing' && (
                                                <div className="space-y-2 w-full text-center">
                                                    <p className="text-xs text-slate-500">Set location to view soil moisture.</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setLocationModalOpen(true); }}
                                                        className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600"
                                                    >
                                                        Set Location
                                                    </button>
                                                </div>
                                            )}

                                            {!moistureLoading && moistureError === 'fetch_error' && (
                                                <div className="space-y-2 text-left w-full">
                                                    <p className="text-xs text-red-500">Unable to fetch soil moisture.</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); loadMoisture(); }}
                                                        className="rounded-lg bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            )}

                                            {!moistureLoading && !moistureError && moisture && (() => {
                                                const pct = moisture.moisturePercentage;
                                                const barColor = pct <= 20 ? 'bg-red-400' : pct <= 40 ? 'bg-orange-400' : pct <= 60 ? 'bg-yellow-400' : pct <= 80 ? 'bg-emerald-500' : 'bg-blue-500';
                                                return (
                                                    <div className="w-full" onClick={showMoistureModal}>
                                                        <div className="text-left text-4xl font-extrabold tracking-tight text-slate-800">{pct}%</div>
                                                        <div className="text-left text-sm font-semibold text-slate-600">{moisture.moistureStatus}</div>
                                                        <div className="mt-2 w-full rounded-full bg-slate-200 p-0.5">
                                                            <div className={`h-3 rounded-full shadow-sm transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <div className="mt-1 text-left text-xs text-slate-400 truncate">{moisture.district}, {moisture.state}</div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="w-full mt-auto">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moisture ? showMoistureModal() : loadMoisture(); }}
                                                className="w-full -mx-4 flex items-center justify-between gap-2 border-t border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 rounded-b-2xl"
                                            >
                                                <span>{moisture ? 'Details' : 'Refresh'}</span>
                                                <FaArrowRight className="text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── AI Crop Advisor Card ── */}
                                <div
                                    onClick={() => router.push('/crop-recommendation')}
                                    className="cursor-pointer h-[17.58rem] rounded-2xl bg-emerald-50 p-4 shadow-sm hover:shadow-md transition overflow-hidden"
                                >
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">AI Crop Advisor</div>
                                            <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">AI</div>
                                        </div>
                                        <div className="flex flex-1 flex-col justify-center gap-2 mt-2">
                                            <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                                                <FaLeaf className="text-emerald-600" />
                                                Smart Crop Picks
                                            </div>
                                            {hasLocation && (
                                                <p className="text-xs text-emerald-600 font-medium">📍 {location.district}, {location.state}</p>
                                            )}
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                Get AI-powered recommendations based on your soil, season, water &amp; budget.
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {['Wheat', 'Rice', 'Maize', 'Cotton'].map((c) => (
                                                    <span key={c} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-full mt-auto">
                                            <button className="w-full -mx-4 flex items-center justify-between gap-2 text-sm font-medium text-emerald-600 border-t border-emerald-600 px-4 py-2 rounded-b-2xl">
                                                <span>Get Recommendations</span>
                                                <FaArrowRight className="text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Market Price Card ── */}
                                <div className="cursor-pointer h-[17.58rem] rounded-2xl bg-rose-50 p-4 shadow-sm hover:shadow-md transition overflow-hidden">
                                    <MarketSnapshotCard onViewPrices={() => router.push('/dashboard/farmer/market')} />
                                </div>

                                {/* ── Disease Scan Card ── */}
                                <div
                                    onClick={() => {
                                        setModalContent({ title: 'Disease Scan', body: <div>No disease detected. Upload leaf images to run a detailed check.</div> });
                                        setModalOpen(true);
                                    }}
                                    className="cursor-pointer h-[17.58rem] rounded-2xl bg-violet-50 p-4 shadow-sm hover:shadow-md transition"
                                >
                                    <div className="flex items-center gap-3 flex-col h-full justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-violet-200 text-violet-700 flex items-center justify-center">
                                                <FaMicroscope className="text-2xl" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Disease Scan</div>
                                                <div className="text-lg font-bold text-slate-800">No alerts</div>
                                            </div>
                                        </div>
                                        <div className="w-full mt-auto">
                                            <button className="w-full -mx-4 flex items-center justify-between gap-2 text-sm font-medium text-emerald-600 border-t border-emerald-600 px-4 py-2 rounded-b-2xl">
                                                <span>Go now</span>
                                                <FaArrowRight className="text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </section>

                        <AiFarmSection />

                        <SuccessStoriesSection />

                        {/* Generic modal */}
                        {modalOpen && modalContent && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center">
                                <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
                                <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl p-6 shadow-xl">
                                    <div className="flex items-start justify-between">
                                        <h3 className="text-lg font-semibold">{modalContent.title}</h3>
                                        <button onClick={() => setModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
                                    </div>
                                    <div className="mt-4 text-sm text-slate-700">{modalContent.body}</div>
                                </div>
                            </div>
                        )}
                    </main>

                    <FarmerFooter />
                </div>
            </div>

            {/* Global Location Modal */}
            <LocationModal open={locationModalOpen} onClose={() => setLocationModalOpen(false)} />
        </>
    );
}
