"use client";
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaSearch, FaThermometerHalf, FaClock, FaTint, FaWind, FaRegCalendarAlt, FaRedoAlt } from 'react-icons/fa';
import { fetchWeather, fetchWeatherByLocation, searchLocations } from '../../services/weather';
import WeatherCard from '../../components/WeatherCard';

const VoiceButton = lazy(() => import('@/components/VoiceButton'));

type LocationSuggestion = {
    name: string;
    displayName: string;
    lat: number;
    lon: number;
};

export default function WeatherWidget() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCelsius, setIsCelsius] = useState(true);
    const [location, setLocation] = useState('Your Location');
    const [lastCoords, setLastCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const current = data?.current || {};
    const summaryRain = data?.daily?.[0]?.pop ?? 0;
    const summaryWind = current?.wind_kph ?? current?.wind_speed ?? 0;
    const summaryHumidity = current?.humidity ?? 0;
    const summaryLabel = current?.weather?.text || current?.weather?.main || 'Live conditions';

    useEffect(() => {
        const getGeolocation = () => {
            if (!navigator.geolocation) return fetchByCoords(26.8467, 80.9462, 'Lucknow');

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    fetchByCoords(pos.coords.latitude, pos.coords.longitude, 'Your Location');
                },
                () => {
                    fetchByCoords(26.8467, 80.9462, 'Lucknow');
                },
                { timeout: 8000 }
            );
        };

        getGeolocation();
    }, []);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            if (lastCoords) {
                await fetchByCoords(lastCoords.lat, lastCoords.lon, location);
                return;
            }

            if (navigator.geolocation) {
                await new Promise<void>((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            void fetchByCoords(pos.coords.latitude, pos.coords.longitude, location).finally(resolve);
                        },
                        () => {
                            void fetchByCoords(26.8467, 80.9462, 'Lucknow').finally(resolve);
                        },
                        { timeout: 8000 }
                    );
                });
                return;
            }

            await fetchByCoords(26.8467, 80.9462, 'Lucknow');
        } finally {
            setRefreshing(false);
        }
    };

    async function fetchByCoords(lat: number, lon: number, locName: string) {
        try {
            setLoading(true);
            setError(null);
            setLastCoords({ lat, lon });
            const resp = await fetchWeather(lat, lon);
            if (!resp.success) throw new Error(resp.error || 'No data');
            setData(resp.data);
            setLocation(locName);
        } catch (err: any) {
            setError(err.message || 'Failed to load weather');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!searchOpen || searchTerm.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearchLoading(true);
                const resp = await searchLocations(searchTerm.trim());
                setSuggestions(resp?.results || []);
            } catch {
                setSuggestions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, searchOpen]);

    const handleLocationSelect = async (item: LocationSuggestion) => {
        try {
            setLoading(true);
            setError(null);
            const resp = await fetchWeatherByLocation(item.displayName || item.name);
            if (!resp.success) throw new Error(resp.error || 'No data');
            setData(resp.data);
            setLocation(resp?.location?.displayName || item.displayName || item.name);
        } catch (err: any) {
            setError(err.message || 'Failed to load weather');
        } finally {
            setLoading(false);
            setSearchOpen(false);
            setSearchTerm('');
            setSuggestions([]);
        }
    };

    return (
        <div className="w-full space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-emerald-600 to-lime-600 p-4 text-white shadow-[0_20px_50px_rgba(16,185,129,0.18)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Current location</p>
                            <div className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight">
                                <FaMapMarkerAlt />
                                <span className="truncate">{location}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur">
                            <FaClock />
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-white/85">{summaryLabel}</p>
                </div>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600"><FaTint /> Humidity</div>
                    <div className="mt-2 text-3xl font-black text-emerald-950">{loading ? '—' : `${Math.round(summaryHumidity)}%`}</div>
                </div>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600"><FaWind /> Wind</div>
                    <div className="mt-2 text-3xl font-black text-emerald-950">{loading ? '—' : `${Math.round(summaryWind)} km/h`}</div>
                </div>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600"><FaRegCalendarAlt /> Rain chance</div>
                    <div className="mt-2 text-3xl font-black text-emerald-950">{loading ? '—' : `${Math.round(summaryRain * 100)}%`}</div>
                </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[2rem] border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-lime-50 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-emerald-950">
                    <div className="rounded-full bg-emerald-100 p-2.5">
                        <FaMapMarkerAlt className="text-emerald-700 text-base" />
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-600">Live weather controls</p>
                        <span className="block font-semibold text-lg leading-tight">Search, switch units, refresh</span>
                    </div>
                    {!loading && data && (
                        <Suspense fallback={null}>
                            <VoiceButton
                                mode="speak"
                                speakText={`${location} mein abhi ${summaryLabel}. Humidity ${Math.round(summaryHumidity)} percent, wind ${Math.round(summaryWind)} km per hour.`}
                                pageContext="weather"
                                showLabel
                            />
                        </Suspense>
                    )}
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FaRedoAlt className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    <button
                        onClick={() => setIsCelsius(!isCelsius)}
                        className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                    >
                        <FaThermometerHalf className="text-lg" />
                        {isCelsius ? '°C' : '°F'}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setSearchOpen(!searchOpen)}
                            className="flex min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold whitespace-nowrap text-emerald-900 transition hover:bg-emerald-50 md:min-w-[180px]"
                        >
                            <FaSearch className="text-lg" />
                            Search place
                        </button>

                        {searchOpen && (
                            <div className="absolute right-0 z-50 mt-3 w-[min(92vw,28rem)] overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
                                <div className="border-b border-emerald-100 bg-emerald-50 p-3">
                                    <input
                                        type="text"
                                        placeholder="Search village, town, or city in India..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-950 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                    {searchLoading && (
                                        <div className="px-4 py-5 text-center text-sm text-emerald-600">Searching locations...</div>
                                    )}
                                    {!searchLoading && suggestions.length > 0 ? (
                                        suggestions.map((item) => (
                                            <button
                                                key={`${item.lat},${item.lon}`}
                                                onClick={() => handleLocationSelect(item)}
                                                className="flex w-full items-center gap-3 border-b border-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-50 last:border-b-0"
                                            >
                                                <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                                                    <FaMapMarkerAlt className="text-sm" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-emerald-950">{item.displayName}</span>
                                                    <span className="block text-xs text-slate-500">Tap to load forecast</span>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        !searchLoading && (
                                            <div className="px-4 py-5 text-center text-sm text-emerald-600">
                                                {searchTerm.trim().length < 2 ? 'Type at least 2 letters' : 'No location found'}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Loading Skeleton */}
            {loading && (
                <div className="space-y-4 animate-pulse">
                    <div className="h-28 rounded-[2rem] bg-gradient-to-br from-emerald-100 to-lime-100" />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="h-24 rounded-[1.5rem] bg-white/90" />
                        <div className="h-24 rounded-[1.5rem] bg-white/90" />
                        <div className="h-24 rounded-[1.5rem] bg-white/90" />
                        <div className="h-24 rounded-[1.5rem] bg-white/90" />
                    </div>
                    <div className="h-72 rounded-[2rem] bg-white/90" />
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 shadow-sm">
                    <p className="text-red-800 font-semibold">Weather load failed</p>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                    <p className="mt-3 text-sm text-red-700/90">Try another place name or reload once the backend responds again.</p>
                </div>
            )}

            {/* Weather Card */}
            {!loading && !error && (
                <div className="animate-fadeIn space-y-4">
                    <WeatherCard
                        data={data}
                        isCelsius={isCelsius}
                        location={location}
                    />
                </div>
            )}

            {/* Click outside to close search */}
            {searchOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSearchOpen(false)}
                />
            )}
        </div>
    );
}
