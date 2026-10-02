# COMPANYCODE — MASTER FORENSIC REPORT
## Phase 1 Only — No Code Modification, No Build, No Android Rebuild

**Date**: 2026-08-26
**Analyst**: Kilo (Automated Forensic Analysis)
**Scope**: Complete source code analysis of companycode repository

---

## SYSTEM STATUS: CRITICALLY BROKEN

The application has multiple critical failure points that prevent reliable operation, especially in Android WebView. The system depends on 5 local services (MongoDB, Node.js backend, YOLO FastAPI, Pragati AI Bridge, Voice Guide Bridge) all running simultaneously, and several are either not configured or have architectural issues.

---

## A. ARCHITECTURE

### Confirmed Architecture
- **Frontend**: Next.js 14 (App Router) on port 3000
- **Backend**: Express.js/TypeScript on port 4000
- **Admin**: Next.js on port 3001
- **Database**: MongoDB on port 27017 (local data files exist)
- **YOLO**: FastAPI/PyTorch on port 8000
- **Pragati AI**: FastAPI bridge on port 8001
- **Voice Guide**: FastAPI bridge on port 8002

### Key Finding
The system uses a **multi-service architecture** where the Node.js backend acts as a proxy/orchestrator between the frontend and 3 Python AI microservices. ALL services must be running for full functionality.

---

## B. DATABASES

### Confirmed Databases
1. **MongoDB** (primary)
   - URI: `mongodb://localhost:27017/kisan-pragati`
   - Location: `data/mongo/` (actual WiredTiger files present)
   - 47 models/collections
   - Status: Data files exist, but connection depends on MongoDB service running

### Potential Issues
1. **No `.env.local` in backend**: If `MONGODB_URI` is not set, backend crashes on startup
2. **MongoDB service dependency**: If MongoDB is not running, entire backend fails

---

## C. MODELS

### Confirmed Models (47)
Key models identified:
- User, FarmerProfileData, AgroudAnKisanCard, UserSettings
- DiseaseRecommendation, DiseasePestSolution
- CropKnowledgeBase, FarmerCropRequest, MyCrop, ActiveCrop, CropTask
- SoilReport, SoilStandard, SoilMoisture
- FarmerMarketPreference, MarketPriceHistory
- AIConversation, FarmerMemory
- GovtScheme, BlogPost, GalleryItem, KVK
- Shop, ShopProduct, ShopReview, ShopkeeperProfile
- IrrigationSchedule, FertilizerProduct
- LanguageDictionary, TranslationCache, SpeechCacheEntry
- And 15+ others

### Relationships Confirmed
- User → FarmerProfileData (1:1)
- User → DiseaseRecommendation (1:N)
- User → MyCrop (1:N)
- User → SoilReport (1:N)
- MyCrop → ActiveCrop (1:N)
- ActiveCrop → CropTask (1:N)
- DiseasePestSolution → DiseaseRecommendation (1:N)

---

## D. AUTHENTICATION

### Confirmed Auth Flow
1. **JWT-based** with bcrypt password hashing
2. **Three login methods**: Email/password, Google OAuth, Kisan Card OTP
3. **Token storage**: localStorage (`authToken`)
4. **Session restore**: Background call to `/api/auth/me`

### Security Findings
1. **No hardcoded users**: Login requires valid database match
2. **No mock/fallback users**: Confirmed from code
3. **OTP exposure**: When SMTP/SMS fails, OTP is returned in API response (`devOtp`)
4. **30-day JWT**: No refresh token mechanism
5. **localStorage XSS risk**: Token vulnerable to XSS attacks

### Confirmed Working
- Email/password login with bcrypt validation
- JWT creation and verification
- Role-based access (farmer, vendor, admin)

---

## E. API MAP

### Confirmed Routes (38 route files, 80+ endpoints)
All routes documented in `03_FRONTEND_API_TRACE.md`.

### Key Findings
1. **Most frontend services use relative URLs** (`/api/...`)
2. **Next.js rewrite required** for relative URLs to work
3. **No API versioning**: All routes under `/api/*`

---

## F. AI SERVICES

### Confirmed AI Services

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| YOLO FastAPI | 8000 | REQUIRES START | Disease detection |
| Pragati AI Bridge | 8001 | REQUIRES START | Root agent, intent, chat |
| Voice Guide Bridge | 8002 | REQUIRES START | Avatar dialogues |
| OpenAI/OpenRouter | 443 | REQUIRES KEY | LLM fallback, soil analysis, crop recs |

### Key Findings
1. **OpenRouter as OpenAI**: `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
2. **Multiple Python services required**: All must be running for AI features
3. **Intent engine**: TF-IDF + LogReg model via Python bridge
4. **LLM only for general intent**: Not used for disease, crop, soil, weather, market

---

## G. DISEASE SCAN

### Root Cause: CRITICAL — YOLO Service Dependency

**CONFIRMED FROM CODE**:
1. **YOLO FastAPI must be running** on port 8000
2. **Model file must exist**: `Ai/weights/yolov8s-cls.pt`
3. **Crop selection is mandatory**: Frontend must send `cropName`
4. **Backend calls Python service**: `http://localhost:8000/predict`

**Error Messages (Exact from code)**:
- `"FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again."`
- `"FastAPI AI server timed out. The model may still be loading. Please try again in a moment."`
- `"Unable to identify the disease in this image. Please upload a clear leaf image."`

**Root Causes of Failure**:
1. `fastapi_server.py` not running → ECONNREFUSED
2. Model `best.pt` not loaded → health check shows `model_loaded: false`
3. Crop not in training data → 422 error
4. Low confidence (<30%) → returns `lowConfidence: true`
5. No advisory in knowledge base → `hasAdvisory: false`

---

## H. PRAGATI AI

### Root Cause: CRITICAL — Bridge Dependency

**CONFIRMED FROM CODE**:
1. **Pragati AI Bridge must be running** on port 8001
2. **Backend proxies all requests** to Python bridge
3. **60-second timeout** on backend
4. **Auto-spawn**: Backend tries to start bridge automatically via `bridgeManager`

**Error Messages (Exact from code)**:
- `"AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।"` (AI service temporarily unavailable)
- Bridge 503 → Backend 503 → Frontend error

**Root Causes of Failure**:
1. `fastapi_bridge.py` not running → ECONNREFUSED
2. Bridge startup failed → 503 after 20s wait
3. Controller initialization failed → 503
4. Model not current → auto-rebuild may fail

**Schema Mismatch**: NONE — Backend normalizes snake_case to camelCase correctly.

---

## I. VOICE GUIDE

### Root Cause: BRIDGE DEPENDENCY + SELF-REFERENTIAL ISSUES

**CONFIRMED FROM CODE**:
1. **Voice Guide Bridge must be running** on port 8002
2. **Backend auto-spawns bridge** via `voiceGuideBridgeManager.ts`
3. **Frontend uses Web Speech API** for TTS, not bridge audio
4. **Bridge provides dialogue text only**

**Error Messages (Exact from code)**:
- `"Voice Guide unavailable"` — Generic fallback
- `"Voice Guide bridge is not running"` — ECONNREFUSED
- `"Voice Guide bridge timeout after Xms"` — Timeout

**Root Causes of Failure**:
1. `api_bridge.py` not running → ECONNREFUSED
2. RuntimeManager startup failed → 503
3. pygame/serial worker issues → Runtime errors
4. Bridge crashes after startup → Subsequent requests fail

**"Server returned an invalid response" Analysis**: NOT caused by JSON mismatch. Frontend handles non-JSON gracefully. Caused by bridge down or network error.

---

## J. WEATHER

### Root Cause: SELF-REFERENTIAL API URL + SCHEMA MISMATCH

**CONFIRMED FROM CODE**:
1. **Self-referential default**: `WEATHER_API_BASE_URL=http://localhost:4000` (backend itself)
2. **If not overridden**, weather service calls itself → returns HTML error or infinite loop
3. **Mock data fallback**: On ANY error, returns random fake weather data

**Error Messages (Exact from code)**:
- `"No matching location found"` — LocationNotFoundError
- `"WEATHER_API_KEY is not set"` — Missing API key
- `"Failed to fetch weather"` — Generic error

**Root Causes of Failure**:
1. `WEATHER_API_KEY` not set → mock data returned silently
2. `WEATHER_API_BASE_URL=http://localhost:4000` → self-reference
3. Location not found in WeatherAPI.com → LocationNotFoundError
4. Network timeout → mock data returned

**Schema Mismatch**:
- Coordinates query: `res.json({ success: true, data: {...} })`
- Location query: `res.json({ success: true, ...payload })` — spreads `location` and `data` at top level
- Frontend accesses `payload.current` which is undefined for location queries

---

## K. MANDI

### Root Cause: API KEY DEPENDENCY + SCHEMA MISMATCH

**CONFIRMED FROM CODE**:
1. **External API**: `https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24`
2. **API Key Required**: `DATA_GOV_API_KEY` or `MANDI_API_KEY`
3. **District → State → India fallback**: If no data at district level, falls back to state, then India

**Error Messages (Exact from code)**:
- `"Mandi API key not configured on server. Set DATA_GOV_API_KEY in backend .env"`
- `"No mandi data found for Wheat anywhere in India."`
- `"Mandi API error: <detail>"`

**Root Causes of Failure**:
1. API key not set → 500 error
2. No data for commodity → empty result
3. API timeout/network error → 502 error

**Schema Mismatch**:
- Backend returns `arrivalDate`
- Frontend expects `date`

---

## L. SOIL/FERTILIZER/CROP FEATURES

### Confirmed Working (if dependencies met)
1. **Soil Health**: Uses OpenAI Vision for OCR + GPT for analysis
2. **Fertilizer Calculator**: Rule-based + OpenAI recommendation
3. **Crop Recommendation**: Database similarity search → local engine → OpenAI fallback
4. **My Crops**: Simple CRUD with MongoDB
5. **AI-FOS**: Lifecycle generation + task management

### Dependencies
- All depend on MongoDB being available
- Soil/Fertilizer/Crop Recommendation depend on `OPENAI_API_KEY`
- AI-FOS depends on backend + MongoDB only

---

## M. RESPONSE SCHEMA MISMATCHES

### Confirmed Mismatches

| # | Feature | Backend | Frontend | Severity |
|---|---------|---------|----------|----------|
| 1 | Weather (location) | `{ success: true, location, data: {...} }` | `payload.current` | HIGH |
| 2 | Mandi current | `{ success: true, data: { ..., arrivalDate } }` | `data.date` | MEDIUM |
| 3 | Disease scan | `{ success: true, predictionSource, source, engine, hasAdvisory, data: {...} }` | Depends on component | MEDIUM |

### Potential Mismatches
1. **HTML vs JSON**: Most frontend services don't check for HTML responses
2. **Empty responses**: Some services don't handle empty response bodies
3. **Success field**: Some routes return `{ ok: true }` instead of `{ success: true }`

---

## N. FRONTEND ISSUES

### Confirmed Issues
1. **No request timeouts**: `fetch()` calls have no explicit timeout
2. **No retry logic**: Failed requests are not retried
3. **No HTML detection**: Most services assume JSON response
4. **localStorage session**: Session lost if localStorage is cleared
5. **No offline handling**: Network errors show generic messages

### Confirmed Working
1. **Session restore**: Reads from localStorage, validates with `/api/auth/me`
2. **Auth header injection**: Bearer token added to all authenticated requests
3. **Error propagation**: Errors thrown with meaningful messages

---

## O. ANDROID COMPATIBILITY ISSUES

### CRITICAL Issues

| # | Issue | Impact | Fix Required |
|---|-------|--------|--------------|
| 1 | `localhost:4000` hardcoded | ALL API calls fail | Use LAN IP or Capacitor proxy |
| 2 | CORS blocks WebView origin | All API calls fail | Add WebView origin to CORS |
| 3 | Cleartext HTTP blocked | API calls blocked on Android 9+ | Use HTTPS or `usesCleartextTraffic` |
| 4 | Static export breaks API | `/api/*` returns 404/HTML | Use SSR or proxy |
| 5 | No Android permissions | Camera/mic/file upload fail | Add to `AndroidManifest.xml` |
| 6 | `AbortSignal.timeout` unsupported | Voice guide timeouts fail | Use polyfill or alternative |
| 7 | localStorage unreliable | Session lost | Use Capacitor Preferences or SQLite |
| 8 | WebView `speechSynthesis` limited | Voice output may fail | Test on device |

---

## P. MOBILE CSS ISSUES

### Potential Issues (files not fully audited)
1. **Fixed widths**: Tailwind classes like `w-64`, `w-96` may not adapt
2. **Fixed heights**: `h-screen` may not account for WebView chrome
3. **Sidebar**: May not collapse on mobile
4. **Tables**: May cause horizontal scrolling
5. **Modals**: Fixed dimensions may overflow small screens
6. **Touch targets**: Buttons may be < 44px

---

## Q. EXACT ROOT CAUSES

### Q.1 Profile Unavailable
**Root Cause**: MongoDB not running OR `MONGODB_URI` not configured
**Evidence**: `database.ts:8-9` throws if `MONGODB_URI` is missing

### Q.2 Database Data Not Reaching Frontend
**Root Causes**:
1. Backend not running → no API responses
2. MongoDB not running → backend crashes on startup
3. Frontend calls wrong endpoint or expects wrong schema
4. CORS blocks requests from WebView

### Q.3 API Responses Sometimes Invalid
**Root Causes**:
1. Weather API self-reference returns HTML
2. Backend not running → Next.js returns HTML
3. Python bridge down → backend returns 503 with error JSON
4. No HTML detection in frontend → `res.json()` throws

### Q.4 Disease Scan Says AI Service Unavailable
**Root Cause**: `fastapi_server.py` not running on port 8000
**Evidence**: `yoloService.ts:164-166` logs ECONNREFUSED

### Q.5 Voice Guide Returns Invalid Server Response
**Root Cause**: `api_bridge.py` not running on port 8002
**Evidence**: `voiceGuideBridgeManager.ts` logs bridge startup failure

### Q.6 Weather Fails
**Root Causes**:
1. `WEATHER_API_KEY` not set → mock data or error
2. `WEATHER_API_BASE_URL=http://localhost:4000` → self-reference
3. Location not found in WeatherAPI.com
4. Frontend schema mismatch for location queries

### Q.7 Mandi Fails
**Root Causes**:
1. `DATA_GOV_API_KEY` not set → 500 error
2. No data for selected commodity → empty result
3. API timeout/network error → 502 error

### Q.8 Frontend Screens Behave Differently in Android
**Root Causes**:
1. `localhost` URLs unreachable from device
2. CORS blocks WebView requests
3. `speechSynthesis` behavior differs
4. `AbortSignal.timeout` unsupported
5. localStorage unreliable

### Q.9 Response Schemas Mismatched
**Root Causes**:
1. Weather: Two endpoints return different shapes
2. Mandi: `arrivalDate` vs `date`
3. Some routes use `ok` instead of `success`

### Q.10 Some Endpoints Return HTML
**Root Causes**:
1. Self-referential weather API
2. Backend down → Next.js serves HTML
3. Express error handler in some cases

---

## R. RECOMMENDED FIX ORDER

### Phase 1: CRITICAL Infrastructure
1. **Fix backend `.env.local`**: Add `MONGODB_URI`, `JWT_SECRET`, and all required API keys
2. **Fix `WEATHER_API_BASE_URL`**: Change from `http://localhost:4000` to actual WeatherAPI.com URL
3. **Ensure MongoDB is running**: Start MongoDB service
4. **Start all Python services**: YOLO (8000), Pragati AI (8001), Voice Guide (8002)

### Phase 2: API & Schema Fixes
5. **Fix weather schema mismatch**: Standardize response shape
6. **Fix Mandi field name**: Change `arrivalDate` to `date` or update frontend
7. **Add HTML detection to frontend**: Use safe fetch pattern everywhere
8. **Add request timeouts**: All frontend fetch calls

### Phase 3: Android Compatibility
9. **Replace localhost URLs**: Use LAN IP or Capacitor proxy
10. **Configure CORS for WebView**: Add Android origins
11. **Enable cleartext or use HTTPS**: Fix network security config
12. **Add Android permissions**: CAMERA, RECORD_AUDIO, etc.
13. **Use Capacitor HTTP plugin**: Bypass CORS restrictions

### Phase 4: Mobile & UX
14. **Audit mobile CSS**: Fix fixed widths, sidebar, touch targets
15. **Add offline handling**: Graceful degradation when services are down
16. **Add retry logic**: Exponential backoff for failed requests

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
