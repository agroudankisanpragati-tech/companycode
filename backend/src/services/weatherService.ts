import axios from 'axios';

type CacheEntry = {
    ts: number;
    data: any;
};

const cache = new Map<string, CacheEntry>();
const TTL = 1000 * 60 * 10; // 10 minutes

const geoCache = new Map<string, CacheEntry>();

type LocationSuggestion = {
    name: string;
    displayName: string;
    lat: number;
    lon: number;
};

type WeatherApiCondition = {
    text?: string;
    icon?: string;
    code?: number;
};

type NormalizedWeather = {
    location?: LocationSuggestion | null;
    current: {
        temp?: number;
        humidity?: number;
        wind_speed?: number;
        wind_kph?: number;
        weather?: WeatherApiCondition | null;
    };
    daily?: Array<any>;
    hourly?: Array<any>;
    raw?: any;
};

class LocationNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LocationNotFoundError';
    }
}

function getWeatherApiKey() {
    return process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
}

function getWeatherApiBaseUrl() {
    return process.env.WEATHER_API_BASE_URL || 'https://api.weatherapi.com/v1';
}

function normalizeIcon(icon?: string) {
    if (!icon) return undefined;
    if (icon.startsWith('//')) return `https:${icon}`;
    return icon;
}

/**
 * Converts a UNIX timestamp to a human-readable date label.
 * Returns 'Today', 'Tomorrow', 'Day after tomorrow', or 'Monday 22 July'.
 */
function formatDateLabel(ts: number): string {
    if (!ts) return '';
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const now = new Date();
    const dt = new Date(ts * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dtStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.round((dtStart.getTime() - todayStart.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === 2) return 'Day after tomorrow';
    return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

function normalizeCondition(condition?: WeatherApiCondition | null): WeatherApiCondition | null {
    if (!condition) return null;

    return {
        text: condition.text,
        icon: normalizeIcon(condition.icon),
        code: condition.code,
    };
}

function buildMockWeatherData(): NormalizedWeather {
    const now = Math.floor(Date.now() / 1000);
    return {
        current: {
            temp: 24 + Math.random() * 8,
            humidity: 60 + Math.random() * 20,
            wind_speed: 10 + Math.random() * 20,
            wind_kph: 10 + Math.random() * 20,
            weather: {
                text: ['Sunny', 'Cloudy', 'Partly Cloudy', 'Clear'][Math.floor(Math.random() * 4)],
                description: 'pleasant weather',
                icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
            } as any,
        },
        daily: Array.from({ length: 7 }, (_, i) => ({
            dt: now + i * 86400,
            dateLabel: formatDateLabel(now + i * 86400),
            temp: {
                day: 25 + Math.random() * 8,
                min: 15 + Math.random() * 5,
                max: 30 + Math.random() * 5,
            },
            pop: Math.random() * 0.3,
            weather: {
                text: ['Clear', 'Clouds', 'Rain'][Math.floor(Math.random() * 3)],
                description: 'weather forecast',
                icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
            } as any,
        })),
        hourly: Array.from({ length: 24 }, (_, i) => ({
            dt: now + i * 3600,
            dateLabel: formatDateLabel(now + i * 3600),
            temp: 22 + Math.random() * 6,
            pop: Math.random() * 0.2,
            weather: {
                text: 'Clear',
                description: 'clear sky',
                icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
            } as any,
        })),
        raw: { provider: 'mock' },
    };
}

function normalizeWeatherPayload(payload: any): NormalizedWeather {
    const location = payload?.location
        ? {
            name: payload.location.name || '',
            displayName: [payload.location.name, payload.location.region, payload.location.country]
                .filter(Boolean)
                .join(', '),
            lat: Number(payload.location.lat),
            lon: Number(payload.location.lon),
        }
        : null;

    const forecastDays = (payload?.forecast?.forecastday || []).slice(0, 7).map((day: any) => ({
        dt: day.date_epoch,
        dateLabel: formatDateLabel(day.date_epoch),
        temp: {
            day: day.day?.avgtemp_c,
            min: day.day?.mintemp_c,
            max: day.day?.maxtemp_c,
        },
        pop: (day.day?.daily_chance_of_rain ?? 0) / 100,
        weather: normalizeCondition(day.day?.condition),
    }));

    const hourly = (payload?.forecast?.forecastday || [])
        .flatMap((day: any) => day.hour || [])
        .slice(0, 24)
        .map((hour: any) => ({
            dt: hour.time_epoch,
            dateLabel: formatDateLabel(hour.time_epoch),
            temp: hour.temp_c,
            pop: (hour.chance_of_rain ?? 0) / 100,
            weather: normalizeCondition(hour.condition),
        }));

    return {
        location,
        current: {
            temp: payload?.current?.temp_c,
            humidity: payload?.current?.humidity,
            wind_speed: payload?.current?.wind_kph,
            wind_kph: payload?.current?.wind_kph,
            weather: normalizeCondition({
                text: payload?.current?.condition?.text,
                icon: payload?.current?.condition?.icon,
                code: payload?.current?.condition?.code,
            }),
        },
        daily: forecastDays,
        hourly,
        raw: payload,
    };
}

function isLocationNotFoundError(error: any) {
    return error?.response?.status === 400 && String(error?.response?.data?.error?.message || error?.message || '')
        .toLowerCase()
        .includes('no matching location found');
}

async function requestWeather(query: string, cacheKey: string) {
    const apiKey = getWeatherApiKey();
    const baseUrl = getWeatherApiBaseUrl();

    const now = Date.now();
    const existing = cache.get(cacheKey);
    if (existing && now - existing.ts < TTL) {
        return existing.data;
    }

    let normalized: NormalizedWeather;

    try {
        if (!apiKey) throw new Error('WEATHER_API_KEY is not set');

        const url = `${baseUrl}/forecast.json`;
        const resp = await axios.get(url, {
            params: {
                key: apiKey,
                q: query,
                days: 7,
                aqi: 'no',
                alerts: 'no',
            },
            timeout: 8000,
        });

        normalized = normalizeWeatherPayload(resp.data);
    } catch (error: any) {
        if (isLocationNotFoundError(error)) {
            throw new LocationNotFoundError('No matching location found');
        }

        const msg = error?.response?.status === 401
            ? 'Invalid WeatherAPI.com API key (401)'
            : error?.response?.data?.error?.message || error?.message;
        console.warn('⚠️ WeatherAPI failed, using mock data:', msg);
        normalized = buildMockWeatherData();
    }

    cache.set(cacheKey, { ts: now, data: normalized });
    return normalized;
}

async function fetchWeather(lat: string | number, lon: string | number) {
    return requestWeather(`${lat},${lon}`, `${lat},${lon}`);
}

async function searchLocations(query: string): Promise<LocationSuggestion[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const now = Date.now();
    const cacheKey = `geo:${normalizedQuery}`;
    const cached = geoCache.get(cacheKey);
    if (cached && now - cached.ts < TTL) {
        return cached.data;
    }

    const apiKey = getWeatherApiKey();
    if (!apiKey) {
        throw new Error('WEATHER_API_KEY is not set');
    }

    const toSuggestion = (item: any): LocationSuggestion => {
        const rawDisplay = [item.name, item.region, item.country].filter(Boolean).join(', ') || query;
        const shortName = item.name || rawDisplay.split(',')[0] || query;
        return {
            name: shortName,
            displayName: rawDisplay,
            lat: Number(item.lat),
            lon: Number(item.lon),
        };
    };

    const unique = new Map<string, LocationSuggestion>();

    const addList = (items: any[]) => {
        for (const item of items || []) {
            const s = toSuggestion(item);
            if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
            const k = `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`;
            if (!unique.has(k)) unique.set(k, s);
        }
    };

    try {
        const response = await axios.get(`${getWeatherApiBaseUrl()}/search.json`, {
            params: {
                key: apiKey,
                q: query,
            },
            timeout: 8000,
        });
        addList(response.data || []);
    } catch {
        // Search is best-effort; weather lookup can still work directly with the text query.
    }

    const suggestions = Array.from(unique.values()).slice(0, 8);

    geoCache.set(cacheKey, { ts: now, data: suggestions });
    return suggestions;
}

async function fetchWeatherByLocationQuery(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        throw new LocationNotFoundError('No matching location found');
    }

    const suggestions = await searchLocations(trimmedQuery);
    if (suggestions.length) {
        const top = suggestions[0];
        const weather = await fetchWeather(top.lat, top.lon);

        return {
            location: top,
            data: weather,
        };
    }

    const weather = await requestWeather(trimmedQuery, `query:${trimmedQuery.toLowerCase()}`);

    return {
        location: weather.location || {
            name: trimmedQuery,
            displayName: trimmedQuery,
            lat: Number.NaN,
            lon: Number.NaN,
        },
        data: weather,
    };
}

export default { fetchWeather, searchLocations, fetchWeatherByLocationQuery, LocationNotFoundError };

