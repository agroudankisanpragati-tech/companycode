# COMPANYCODE — MANDI / MARKET PRICE TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. COMPLETE REQUEST CHAIN

### 1.1 Frontend Service
**File**: `frontend/src/services/mandibav.ts`

```typescript
const useBackendProxy = process.env.NEXT_PUBLIC_USE_BACKEND_PROXY !== 'false';
const externalBase = process.env.NEXT_PUBLIC_MANDI_API_URL;
const backendApi = axios.create({ baseURL: '/api/mandi', headers: { 'Content-Type': 'application/json' } });
const externalApi = axios.create({ baseURL: externalBase, headers: { 'Content-Type': 'application/json' } });

export const mandiApi = {
  getPrices: async (params) => {
    if (useBackendProxy) {
      const response = await backendApi.get<{ success: boolean; data: MandiPrice[] }>('/prices', { params });
      return response.data;
    }
    if (!externalBase) throw new Error('No external mandi API configured...');
    const response = await externalApi.get<{ success: boolean; data: MandiPrice[] }>('/prices', { params });
    return response.data;
  },
  getPriceById: async (id) => { ... }
};
```

### 1.2 Frontend Service
**File**: `frontend/src/services/marketPrice.ts`
**File**: `frontend/src/components/MandiPrices/` (directory not read, but referenced)

### 1.3 Backend Route
**File**: `backend/src/routes/mandi.ts`
**Line**: 1-339

---

## 2. EXTERNAL MANDI API

### 2.1 API Endpoint
```
https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24
```

### 2.2 API Key
**Environment Variable**: `DATA_GOV_API_KEY` or `MANDI_API_KEY`
**Read at request time**: `process.env.DATA_GOV_API_KEY || process.env.MANDI_API_KEY || ''`

### 2.3 Request Parameters
```
api-key: <DATA_GOV_API_KEY>
format: json
limit: 50
filters[Commodity]: <crop_name>
filters[State]: <state_name> (optional)
filters[District]: <district_name> (optional)
sort[Arrival_Date]: desc
```

---

## 3. BACKEND ROUTES

### 3.1 GET /api/mandi/preference
**File**: `mandi.ts:136-160`
- Returns farmer's mandi preference (crop, state, district)
- Auto-creates preference with default crop "Wheat" if not exists
- Syncs location from User document

### 3.2 PUT /api/mandi/preference
**File**: `mandi.ts:163-192`
- Updates farmer's mandi preference
- Also updates User location if state/district provided

### 3.3 GET /api/mandi/current
**File**: `mandi.ts:195-278`
- Gets current mandi price for farmer's preferred crop
- District → State → India fallback search
- Stores result in MarketPriceHistory
- Returns price data with search level

### 3.4 GET /api/mandi/history
**File**: `mandi.ts:281-301`
- Returns farmer's price history (last 20 records per crop)

### 3.5 GET /api/mandi/prices (legacy)
**File**: `mandi.ts:304-337`
- Public endpoint, no auth required
- Returns array of prices for commodity

---

## 4. RESPONSE SCHEMA

### 4.1 Backend Response (current)
```json
{
  "success": true,
  "data": {
    "commodity": "Wheat",
    "market": "Jaipur",
    "district": "Jaipur",
    "state": "Rajasthan",
    "modalPrice": 2150,
    "minPrice": 2100,
    "maxPrice": 2200,
    "arrivalDate": "2024-01-15",
    "searchLevel": "district"
  }
}
```

### 4.2 Backend Response (history)
```json
{
  "success": true,
  "data": [
    {
      "cropName": "Wheat",
      "district": "Jaipur",
      "state": "Rajasthan",
      "market": "Jaipur",
      "modalPrice": 2150,
      "minPrice": 2100,
      "maxPrice": 2200,
      "date": "2024-01-15"
    }
  ]
}
```

### 4.3 Frontend Expected Response
```typescript
interface MandiPrice {
  commodity: string;
  market: string;
  state: string;
  minPrice?: number;
  maxPrice?: number;
  modalPrice?: number;
  date: string;
}
```

### 4.4 Schema Mismatch
**Backend returns**: `arrivalDate`
**Frontend expects**: `date`

**Backend returns**: `searchLevel`
**Frontend expects**: Not defined in interface

**Backend returns**: `district`
**Frontend expects**: `district`

**MISMATCH**: Backend uses `arrivalDate`, frontend interface uses `date`.

---

## 5. FALLBACK SEARCH LOGIC

```typescript
async function searchMandiWithFallback(commodity, district, state) {
  // Level 1: District search
  if (district && state) {
    const records = await fetchMandiData(commodity, { State: state, District: district });
    if (records.length > 0) return { records, level: 'district' };
  }

  // Level 2: State search
  if (state) {
    const records = await fetchMandiData(commodity, { State: state });
    if (records.length > 0) return { records, level: 'state' };
  }

  // Level 3: India-wide search
  const records = await fetchMandiData(commodity);
  return { records, level: 'india' };
}
```

---

## 6. ERROR HANDLING

### 6.1 Backend Errors
```json
// API key missing
{ "success": false, "error": "DATA_GOV_API_KEY not configured" }

// No data found
{ "success": true, "data": null, "message": "No mandi data found for Wheat anywhere in India." }

// API error
{ "success": false, "error": "Mandi API error: <detail>", "code": "ECONNREFUSED", "httpStatus": 502 }
```

### 6.2 Frontend Error Handling
```typescript
if (useBackendProxy) {
  const response = await backendApi.get('/prices', { params });
  return response.data;
}
if (!externalBase) {
  throw new Error('No external mandi API configured...');
}
```

**Issue**: If backend proxy is enabled but backend is down, `backendApi` will fail with network error. No explicit error handling.

---

## 7. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/services/mandibav.ts` | Frontend Mandi API service |
| `frontend/src/services/marketPrice.ts` | Frontend market price hook |
| `backend/src/routes/mandi.ts` | Backend mandi route handler |
| `backend/src/models/FarmerMarketPreference.ts` | Preference model |
| `backend/src/models/MarketPriceHistory.ts` | History model |
| `backend/.env.example:53-54` | API key configuration |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
