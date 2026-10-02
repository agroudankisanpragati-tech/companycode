# COMPANYCODE — WEATHER TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. COMPLETE REQUEST CHAIN

### 1.1 Frontend Service
**File**: `frontend/src/services/weather.ts`

```typescript
export async function fetchWeather(lat, lon) {
  const res = await fetch(`/api/weather?latitude=${lat}&longitude=${lon}`);
  const payload = await parseJsonSafe(res);
  if (!res.ok) throw new Error(payload?.error || 'Failed to fetch weather');
  return payload;
}

export async function searchLocations(query) {
  const res = await fetch(`/api/weather/search?query=${encodeURIComponent(query)}`);
  const payload = await parseJsonSafe(res);
  if (!res.ok) throw new Error(payload?.error || 'Failed to search locations');
  return payload;
}

export async function fetchWeatherByLocation(location) {
  const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
  const payload = await parseJsonSafe(res);
  if (!res.ok) throw new Error(payload?.error || 'Failed to fetch weather by location');
  return payload;
}
```

### 1.2 Backend Route
**File**: `backend/src/routes/weather.ts`
**Line**: 7-30

```typescript
router.get('/', async (req, res) => {
  const { latitude, longitude, location } = req.query;

  if (location) {
    const payload = await weatherService.fetchWeatherByLocationQuery(location as string);
    return res.json({ success: true, ...payload });
  }

  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, error: 'latitude and longitude or location are required' });
  }

  const data = await weatherService.fetchWeather(latitude as string, longitude as string);
  res.json({ success: true, data });
});
```

---

## 2. WEATHER SERVICE CONFIGURATION

**File**: `backend/src/services/weatherService.ts`

### 2.1 API Configuration
```typescript
function getWeatherApiKey() {
  return process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
}

function getWeatherApiBaseUrl() {
  return process.env.WEATHER_API_BASE_URL || 'https://api.weatherapi.com/v1';
}
```

**Environment Variables**:
- `WEATHER_API_KEY` — Primary
- `OPENWEATHER_API_KEY` — Fallback
- `WEATHER_API_BASE_URL` — Base URL (defaults to `https://api.weatherapi.com/v1`)

### 2.2 SELF-REFERENTIAL DEFAULT
**File**: `backend/.env.example:60`
```env
WEATHER_API_BASE_URL=http://localhost:4000
```

**CRITICAL**: If `WEATHER_API_BASE_URL` is set to `http://localhost:4000`, the weather service will call ITSELF instead of the external weather API. This creates an infinite loop or returns HTML error pages.

---

## 3. EXTERNAL WEATHER API

**Provider**: WeatherAPI.com (based on default URL `https://api.weatherapi.com/v1`)
**Endpoint**: `/forecast.json`
**Parameters**:
- `key`: API key
- `q`: location query (lat,lon or city name)
- `days`: 7
- `aqi`: no
- `alerts`: no

### 3.1 Alternative Provider
If `OPENWEATHER_API_KEY` is used instead, the service would call OpenWeatherMap API (not explicitly implemented in the code, but the fallback variable name suggests it).

---

## 4. RESPONSE SCHEMA

### 4.1 Backend Response (coordinates)
```json
{
  "success": true,
  "data": {
    "location": {
      "name": "Jaipur",
      "displayName": "Jaipur, Rajasthan, India",
      "lat": 26.9124,
      "lon": 75.7873
    },
    "current": {
      "temp": 32,
      "humidity": 45,
      "wind_speed": 12,
      "wind_kph": 12,
      "weather": {
        "text": "Sunny",
        "icon": "https://cdn.weatherapi.com/...",
        "code": 1000
      }
    },
    "daily": [
      {
        "dt": 1690000000,
        "dateLabel": "Today",
        "temp": { "day": 32, "min": 25, "max": 35 },
        "pop": 0.1,
        "weather": { "text": "Sunny", "icon": "...", "code": 1000 }
      }
    ],
    "hourly": [
      {
        "dt": 1690000000,
        "dateLabel": "Today",
        "temp": 32,
        "pop": 0.1,
        "weather": { "text": "Clear", "icon": "...", "code": 1000 }
      }
    ],
    "raw": { "provider": "weatherapi.com" }
  }
}
```

### 4.2 Backend Response (location query)
```json
{
  "success": true,
  "location": { "name": "...", "displayName": "...", "lat": ..., "lon": ... },
  "data": { ...same as above... }
}
```

### 4.3 Error Responses
```json
// Missing coordinates
{ "success": false, "error": "latitude and longitude or location are required" }

// Location not found
{ "success": false, "error": "No matching location found" }

// API key missing
{ "success": false, "error": "WEATHER_API_KEY is not set" }

// API error
{ "success": false, "error": "Failed to fetch weather" }
```

---

## 5. MOCK DATA FALLBACK

**File**: `backend/src/services/weatherService.ts:93-135`

If the external API fails (401, network error, etc.), the service returns MOCK data:
```typescript
function buildMockWeatherData(): NormalizedWeather {
  return {
    current: {
      temp: 24 + Math.random() * 8,
      humidity: 60 + Math.random() * 20,
      wind_speed: 10 + Math.random() * 20,
      weather: { text: 'Sunny', icon: '...' }
    },
    daily: [...],  // 7 days of random data
    hourly: [...], // 24 hours of random data
    raw: { provider: 'mock' }
  };
}
```

**Triggered when**: External API returns 401 or any error
**Impact**: Users see fake weather data without knowing it

---

## 6. WEATHER SEARCH

**Endpoint**: `/api/weather/search?query=...`
**Service**: `weatherService.ts:searchLocations()`
**External API**: `https://api.weatherapi.com/v1/search.json`

---

## 7. FRONTEND ISSUES

### 7.1 parseJsonSafe Helper
**File**: `frontend/src/services/weather.ts:1-7`
```typescript
async function parseJsonSafe(res: Response) {
  try { return await res.json(); }
  catch { return null; }
}
```

**Issue**: If backend returns HTML (e.g., error page from self-referential call), `parseJsonSafe` returns `null`. Then `payload?.error` is `undefined`, and the frontend throws `'Failed to fetch weather'`.

### 7.2 No Timeout
Frontend `fetch` calls have no explicit timeout. If backend hangs, frontend hangs.

### 7.3 No Retry
Failed requests are not retried.

---

## 8. "CANNOT READ PROPERTIES OF NULL" ERROR

**Possible Cause**: If backend returns `{ success: true, data: null }` or `{ success: true }` without `data`, frontend code that tries to access `payload.data.current.temp` will throw "Cannot read properties of null".

**File**: `weatherService.ts` returns `data` field for coordinates, but for location query returns `{ success: true, ...payload }` which spreads `location` and `data` at top level.

**Mismatch**:
- Coordinates: `res.json({ success: true, data })` → frontend accesses `payload.data.current`
- Location: `res.json({ success: true, ...payload })` → frontend accesses `payload.current` directly

**This is a SCHEMA MISMATCH**: The two weather endpoints return different shapes for the weather data.

---

## 9. "READING 'SUCCESS'" ERROR

**Possible Cause**: If backend returns HTML (from self-referential `WEATHER_API_BASE_URL=http://localhost:4000`), `parseJsonSafe` returns `null`, and frontend throws `TypeError: Cannot read properties of null (reading 'success')` when trying to access `payload.success`.

---

## 10. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/services/weather.ts` | Frontend weather API service |
| `backend/src/routes/weather.ts` | Backend weather route |
| `backend/src/services/weatherService.ts` | Weather business logic |
| `backend/.env.example:60` | WEATHER_API_BASE_URL default (SELF-REFERENTIAL) |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
