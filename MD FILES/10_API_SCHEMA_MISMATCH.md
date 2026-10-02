# COMPANYCODE — API RESPONSE SCHEMA AUDIT
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. SCHEMA MISMATCH SUMMARY

| Feature | Backend Returns | Frontend Expects | Mismatch? |
|---------|----------------|------------------|-----------|
| Weather (coords) | `{ success: true, data: { current, daily, hourly } }` | `payload.data.current` | NO |
| Weather (location) | `{ success: true, location, data: { current, daily, hourly } }` | `payload.current` | **YES** — `location` spread at top level |
| Mandi current | `{ success: true, data: { commodity, market, arrivalDate, searchLevel } }` | `MandiPrice` interface with `date` | **YES** — `arrivalDate` vs `date` |
| Mandi history | `{ success: true, data: [{ cropName, district, state, market, modalPrice, date }] }` | Matches | NO |
| Disease scan | `{ success: true, data: { ...DiseaseRecommendation fields... } }` | Depends on frontend component | POSSIBLE |
| Pragati AI text | `{ success, sessionId, pipeline, intent, responseText, suggestions, metrics, error }` | `PragatiAIResponse` interface | NO (after normalize) |
| Pragati AI image | `{ success, sessionId, pipeline, imageAnalysis, knowledge, responseText }` | `PragatiAIResponse` interface | NO (after normalize) |
| Farmer profile | `{ success: true, data: { user, ext } }` | `FullProfile` interface | NO |
| Kisan Card | `{ success: true, data: { ...card fields... } }` | Depends on frontend | POSSIBLE |
| Soil report | `{ success: true, data: SoilReport }` | `SoilReport` interface | NO |
| Crop recommendation | `{ success: true, source, requestId, recommendations, message }` | `RecommendationResponse` interface | NO |
| My Crops | `{ success: true, data: MyCrop[] }` | `MyCropEntry[]` | NO |

---

## 2. DETAILED MISMATCHES

### 2.1 Weather Location Query Schema Mismatch

**Backend** (`weather.ts:12-14`):
```typescript
res.json({ success: true, ...payload });
// payload = { location: {...}, data: {...} }
// Result: { success: true, location: {...}, data: {...} }
```

**Frontend** (`weather.ts:23-27`):
```typescript
const payload = await parseJsonSafe(res);
if (!res.ok) throw new Error(payload?.error || 'Failed');
return payload;  // Expects payload.current, payload.data?
```

**Issue**: For location queries, `current`, `daily`, `hourly` are at `payload.data.current`, but for coordinate queries they are at `payload.current`. Frontend code may access `payload.current` directly, which would be `undefined` for location queries.

### 2.2 Mandi arrivalDate vs date

**Backend** (`mandi.ts:252`):
```typescript
arrivalDate: normalizeDate(best.Arrival_Date),
```

**Frontend** (`mandibav.ts`):
```typescript
export interface MandiPrice {
  date: string;  // Frontend expects 'date'
  // ...
}
```

**Issue**: Backend returns `arrivalDate`, frontend expects `date`. If frontend accesses `data.date`, it will be `undefined`.

### 2.3 Disease Scan vs Pragati AI Image Schema

**Disease Scan** (`/api/disease/scan`) returns:
```json
{
  "success": true,
  "predictionSource": "YOLOv8 Classification Model",
  "source": "yolo",
  "engine": "yolo",
  "hasAdvisory": true,
  "data": { ... }
}
```

**Pragati AI Image** (`/api/pragati-ai/image`) returns:
```json
{
  "success": true,
  "sessionId": "...",
  "pipeline": "image",
  "intent": "...",
  "responseText": "...",
  "imageAnalysis": { ... },
  "knowledge": { ... }
}
```

**Issue**: These are completely different schemas. If frontend uses the same component for both, it must handle both response shapes.

---

## 3. JSON vs HTML vs TEXT RESPONSE ISSUES

### 3.1 Potential HTML Response Sources
1. **Self-referential weather API**: If `WEATHER_API_BASE_URL=http://localhost:4000`, backend calls itself and may return HTML error page
2. **Backend not running**: Next.js may return HTML for `/api/*` routes if backend is down
3. **Express error handler**: May return HTML in some error cases

### 3.2 Frontend JSON Parsing
```typescript
const data = await res.json();
```
If response is HTML, this throws `SyntaxError: Unexpected token '<'`.

**Safe pattern** (from `myCrops.ts`):
```typescript
const text = await res.text();
if (text.trimStart().startsWith('<')) throw new Error('Backend not reachable');
const json = JSON.parse(text);
```

**Most frontend services do NOT use this safe pattern**. They directly call `res.json()`.

---

## 4. ARRAY vs OBJECT EXPECTATIONS

### 4.1 Crop Recommendations
**Backend returns**: `{ success: true, recommendations: RecommendationItem[] }`
**Frontend expects**: `RecommendationResponse` with `recommendations: RecommendationItem[]`
**Match**: YES

### 4.2 Mandi History
**Backend returns**: `{ success: true, data: MarketPriceHistory[] }`
**Frontend expects**: `{ data: MandiPrice[] }`
**Match**: YES (field names match)

---

## 5. SUCCESS FIELD CONVENTIONS

### 5.1 Consistent Patterns
Most backend routes return:
```json
{ "success": true, "data": ... }
// or
{ "success": true, "message": "..." }
// or
{ "success": false, "error": "..." }
```

### 5.2 Inconsistent Patterns
Some routes return:
```json
{ "message": "OTP sent successfully", "delivered": true, "devOtp": "123456" }
// No 'success' field

{ "ok": true, "delivered": false, "message": "..." }
// Uses 'ok' instead of 'success'
```

### 5.3 Frontend Handling
Frontend generally checks `res.ok` (HTTP status) rather than `data.success`. This is correct but means HTTP 200 with `{ success: false }` is treated as success by fetch.

---

## 6. NESTED DATA MISMATCHES

### 6.1 Farmer Profile
**Backend** (`farmerProfile.ts:46`):
```typescript
res.json({ success: true, data: { user, ext } });
```

**Frontend** (`farmerProfile.ts:108`):
```typescript
return json.data;  // Expects { user, ext }
```

**Match**: YES

### 6.2 Kisan Card
**Backend** (`kisanCard.ts:194`):
```typescript
res.json({ success: true, data: sanitizeCard(card) });
```

**Frontend**: Reads `json.data`
**Match**: YES

---

## 7. FIELD NAME MISMATCHES

| Backend Field | Frontend Expects | Impact |
|---------------|------------------|--------|
| `arrivalDate` | `date` | Mandi price display shows undefined |
| `searchLevel` | (not defined) | Ignored by frontend |
| `predictionSource` | (not defined) | Ignored by frontend |
| `hasAdvisory` | (not defined) | Ignored by frontend |
| `engine` | (not defined) | Ignored by frontend |
| `responseAudio` | `responseAudio` | Match (after normalize) |

---

## 8. FIELD TYPE MISMATCHES

| Field | Backend Type | Frontend Type | Issue |
|-------|-------------|---------------|-------|
| `confidenceScore` | `number` (rounded) | `number` | NO |
| `modalPrice` | `number` (parsed) | `number` | NO |
| `soilHealthScore` | `number` | `number` | NO |
| `location` | `{ country, state, district, village, coordinates }` | Same | NO |
| `farmDetails` | `IFarmDetail[]` | `FarmDetail[]` | NO |
| `landParcels` | `ILandParcel[]` | `LandParcel[]` | NO |
| `cropHistory` | `ICropRecord[]` | `CropRecord[]` | NO |

---

## 9. RECOMMENDATIONS

1. **Standardize response envelope**: All routes should return `{ success: boolean, data?: any, error?: string, message?: string }`
2. **Fix weather schema inconsistency**: Both coordinate and location queries should return same shape
3. **Fix Mandi field name**: Change `arrivalDate` to `date` or update frontend
4. **Add HTML detection to all frontend fetch calls**: Use the `safeFetch` pattern from `myCrops.ts`
5. **Add request timeouts**: All frontend fetch calls should have explicit timeouts
6. **Add retry logic**: Failed requests should be retried with exponential backoff

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
