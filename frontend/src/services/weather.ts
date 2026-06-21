async function parseJsonSafe(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

export async function fetchWeather(lat: number | string, lon: number | string) {
    const res = await fetch(`/api/weather?latitude=${lat}&longitude=${lon}`);
    const payload = await parseJsonSafe(res);
    if (!res.ok) throw new Error(payload?.error || 'Failed to fetch weather');
    return payload;
}

export async function searchLocations(query: string) {
    const res = await fetch(`/api/weather/search?query=${encodeURIComponent(query)}`);
    const payload = await parseJsonSafe(res);
    if (!res.ok) throw new Error(payload?.error || 'Failed to search locations');
    return payload;
}

export async function fetchWeatherByLocation(location: string) {
    const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    const payload = await parseJsonSafe(res);
    if (!res.ok) throw new Error(payload?.error || 'Failed to fetch weather by location');
    return payload;
}
