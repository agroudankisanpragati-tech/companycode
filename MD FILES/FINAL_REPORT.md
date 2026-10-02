# FINAL FORENSIC REPORT — AgroudanAi Companycode
**Date:** 2026-08-26  
**Analyst:** Kilo (Automated Forensic Audit)  
**Scope:** Read-only analysis of backend, frontend, AI microservices, database, and Android compatibility  
**Status:** Phase 1 Complete — No code modified, no builds executed  

---

## 1. EXECUTIVE SUMMARY

The AgroudanAI application is a multi-service agriculture platform comprising:
- **Frontend:** Next.js 14 + Tailwind CSS (port 3000 dev / static export)
- **Backend:** Node.js + Express + MongoDB (port 4000)
- **AI Microservices:** 3 FastAPI bridges (ports 8000, 8001, 8002)
- **Database:** MongoDB on localhost:27017

**System Status: CRITICALLY BROKEN** for production/Android deployment due to:
1. Missing backend environment configuration (`.env.local` absent)
2. All AI microservices offline by default
3. Self-referential weather API default (`localhost:4000`)
4. Hardcoded `localhost:4000` in frontend `.env.local`
5. Multiple API schema mismatches
6. Android WebView incompatibilities (cleartext HTTP, CORS, permissions)

---

## 2. ARCHITECTURE OVERVIEW

| Component | Technology | Port | Status |
|-----------|-----------|------|--------|
| MongoDB | WiredTiger | 27017 | Data files present, service must be running |
| Backend API | Node.js + Express | 4000 | Requires `.env.local` |
| Frontend | Next.js 14 | 3000 (dev) | Static export breaks `/api/*` |
| YOLO Disease Scan | FastAPI + YOLOv8s-cls | 8000 | Must be started manually |
| Pragati AI Bridge | FastAPI + TF-IDF + LLM | 8001 | Must be started manually |
| Voice Guide Bridge | FastAPI + TTS | 8002 | Must be started manually |

**Data Flow:**
```
Android WebView → Frontend (localhost:3000 or static) → Backend API (localhost:4000)
                                                    ↓
                              MongoDB (localhost:27017)
                                                    ↓
                              AI Microservices (localhost:8000/8001/8002)
```

---

## 3. DATABASE INVENTORY

**Connection:** `mongodb://localhost:27017/kisan-pragati`  
**Models:** 47 Mongoose models mapped to collections  

### Key Collections
- **User / FarmerProfileData** — Authentication and profile
- **DiseaseRecommendation / DiseasePestSolution** — Disease scan history
- **CropKnowledgeBase / SoilReport** — Crop and soil data
- **MyCrop / ActiveCrop / CropTask** — Farm management
- **AIConversation / FarmerMemory** — AI chat history
- **MarketPriceHistory / FarmerMarketPreference** — Mandi prices
- **AgroudAnKisanCard** — Kisan card data
- **UserSettings** — Preferences
- **GovtScheme** — Government schemes
- **+30 additional models** for notifications, logs, support, etc.

---

## 4. AUTHENTICATION FLOW

**Mechanism:** JWT + bcrypt  
**Storage:** `localStorage` (frontend)  
**No hardcoded users or bypass mechanisms found**

### Flow
1. **Register:** `POST /api/auth/register` → creates user, returns JWT
2. **Login:** `POST /api/auth/login` → validates bcrypt, returns JWT
3. **OTP:** `POST /api/auth/send-otp` / `verify-otp` → card OTP flow
4. **Session Restore:** Frontend reads `localStorage` token on load
5. **Protected Routes:** Backend middleware `auth.ts` validates JWT

---

## 5. FRONTEND API CONSUMERS

**Service Files:** 27  
**Endpoints Catalogued:** 80+

### Key Services
- `auth.ts` — Login, register, OTP
- `disease.ts` — Disease scan, history
- `mandibav.ts` — Market prices
- `weather.ts` — Weather data
- `soil.ts` — Soil reports
- `crop-recommendation.ts` — Crop suggestions
- `pragatiAI.ts` — AI chat
- `voiceGuide.ts` — Voice assistant
- `fertilizerCalculator.ts` — Fertilizer calc
- `farmerProfile.ts` — Profile management
- `kisanCard.ts` — Kisan card operations

**Base URL:** `NEXT_PUBLIC_API_URL` from `.env.local` (currently `http://localhost:4000/api`)

---

## 6. FEATURE DEEP TRACES

### 6.1 Disease Scan
- **Frontend:** `disease.ts` → `POST /api/disease/detect`
- **Backend:** `routes/disease.ts` → forwards to YOLO FastAPI
- **AI Service:** `Ai/fastapi_server.py` on port 8000
- **Model:** YOLOv8s-cls (`weights/best.pt`)
- **Failure:** If FastAPI offline → `ECONNREFUSED` → user sees *"FastAPI AI server is not running"*

### 6.2 Pragati AI
- **Frontend:** `pragatiAI.ts` → `POST /api/pragati-ai/chat`
- **Backend:** `routes/pragatiAI.ts` → forwards to bridge
- **AI Service:** `Ai/pragati_ai_controller/fastapi_bridge.py` on port 8001
- **Intent Engine:** TF-IDF + Logistic Regression
- **LLM Fallback:** OpenRouter API
- **Failure:** If bridge offline → *"AI सेवा अस्थायी रूप से अनुपलब्ध है"*

### 6.3 Voice Guide
- **Frontend:** `voiceGuide.ts` → `POST /api/voice-guide/generate`
- **Backend:** `routes/voiceGuide.ts` → forwards to bridge
- **AI Service:** `Ai/voice_guide_ai/api_bridge.py` on port 8002
- **TTS:** Web Speech API (frontend)
- **Failure:** If bridge offline → *"Voice Guide unavailable"*

### 6.4 Weather
- **Frontend:** `weather.ts` → `GET /api/weather/current`
- **Backend:** `routes/weather.ts` → proxies to `WEATHER_API_BASE_URL`
- **Provider:** WeatherAPI.com
- **Default URL:** `http://localhost:4000` (self-referential!)
- **Failure:** Calls itself recursively unless `WEATHER_API_BASE_URL` is overridden

### 6.5 Mandi Prices
- **Frontend:** `mandibav.ts` → `GET /api/mandi/prices`
- **Backend:** `routes/mandi.ts` → proxies to data.gov.in API
- **Fallback:** District → State → India levels
- **Dependency:** `MANDI_API_KEY` required

### 6.6 Other AI Features
- **Soil Analysis:** OpenRouter LLM + soil data
- **Fertilizer Calculator:** Rule-based backend service
- **Crop Recommendation:** OpenRouter LLM + crop knowledge base
- **My Crops / Active Crops:** Mongoose CRUD + task scheduling

---

## 7. CONFIRMED SCHEMA MISMATCHES

| Feature | Backend Returns | Frontend Expects | Impact |
|---------|----------------|------------------|--------|
| **Weather (location query)** | `{ location: {...}, data: {...} }` | `{ data: { location: {...}, ... } }` | Nested field missing |
| **Weather (coords query)** | `{ data: { location: {...}, ... } }` | `{ data: { location: {...}, ... } }` | Consistent |
| **Mandi** | `arrivalDate` | `date` | Field name mismatch |
| **Disease Scan Image** | `{ disease, confidence, treatment }` | N/A | Unique schema |
| **Pragati AI Image** | `{ intent, response, actions }` | N/A | Completely different from disease |

---

## 8. ROOT CAUSES OF FAILURES

### Profile Unavailable
- MongoDB not running or `MONGODB_URI` not configured
- Backend cannot connect to database

### Database Data Not Reaching Frontend
- Backend offline or `.env.local` missing
- Frontend hardcoded to `localhost:4000` (unreachable from Android device)
- CORS blocking WebView origin

### AI Services Failing
- All 3 FastAPI bridges offline by default
- No auto-start mechanism
- Ports 8000, 8001, 8002 must be manually started

### Weather / Mandi Failing
- Weather self-referential default URL
- Missing API keys (`WEATHER_API_KEY`, `MANDI_API_KEY`)
- Schema mismatches in response parsing

### Schema Mismatches
- Weather location query shape inconsistency
- Mandi `arrivalDate` vs `date`
- No shared TypeScript types between frontend and backend

---

## 9. ANDROID COMPATIBILITY ISSUES

### Critical
1. **localhost URLs** — `localhost:4000` unreachable from Android device
2. **Cleartext HTTP** — Android 9+ blocks `http://` by default
3. **CORS** — WebView origin blocked by backend CORS policy
4. **Static Export** — `next export` breaks `/api/*` proxy routes

### Permissions Missing
- `CAMERA` — Disease scan photo capture
- `RECORD_AUDIO` — Voice guide input
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — Image uploads
- `INTERNET` — Required but must be declared

### Browser/WebView Issues
- `AbortSignal.timeout` — Not supported in older Android WebViews
- Fixed viewport — Mobile layout issues
- Touch targets — May be < 44px on some elements

---

## 10. MOBILE CSS ISSUES

- **Fixed widths/heights** — Potential horizontal scrolling
- **Non-collapsible sidebar** — Takes screen space on mobile
- **Table overflow** — Mandi/weather tables may overflow
- **Touch targets** — Some buttons may be too small
- **Font sizes** — Not explicitly set for mobile

---

## 11. RECOMMENDED FIX ORDER

### Phase 1: Infrastructure (Immediate)
1. Create `backend/.env.local` with:
   - `MONGODB_URI=mongodb://localhost:27017/kisan-pragati`
   - `WEATHER_API_KEY=<actual_key>`
   - `WEATHER_API_BASE_URL=https://api.weatherapi.com/v1`
   - `MANDI_API_KEY=<actual_key>`
   - `PORT=4000`
   - `NODE_ENV=development`
2. Start MongoDB service
3. Start backend: `npm run dev` in `backend/`
4. Test backend health: `curl http://localhost:4000/api/health`

### Phase 2: AI Microservices (Immediate)
5. Start YOLO: `python Ai/fastapi_server.py` (port 8000)
6. Start Pragati AI: `python Ai/pragati_ai_controller/fastapi_bridge.py` (port 8001)
7. Start Voice Guide: `python Ai/voice_guide_ai/api_bridge.py` (port 8002)
8. Verify all bridges respond to health checks

### Phase 3: Frontend Configuration (Short-term)
9. Update `frontend/.env.local`:
   - Replace `http://localhost:4000/api` with actual backend URL
   - For Android testing: use LAN IP (e.g., `http://192.168.x.x:4000/api`)
10. Fix Weather schema mismatch in `backend/src/routes/weather.ts`
11. Fix Mandi `arrivalDate` → `date` in `frontend/src/services/mandibav.ts`

### Phase 4: Android Build (Short-term)
12. Add Android permissions to `AndroidManifest.xml`:
    - `INTERNET`
    - `CAMERA`
    - `RECORD_AUDIO`
    - `READ_EXTERNAL_STORAGE`
    - `WRITE_EXTERNAL_STORAGE`
13. Add `android:usesCleartextTraffic="true"` in `AndroidManifest.xml`
14. Replace `AbortSignal.timeout` with polyfill in `VoiceGuideContext.tsx`
15. Configure CORS to allow WebView origin
16. Test on physical Android device

### Phase 5: Polish (Medium-term)
17. Fix mobile CSS (sidebar, tables, touch targets)
18. Add shared TypeScript types for API responses
19. Add health check endpoints for all AI services
20. Implement auto-start for AI bridges in backend
21. Add error boundaries and offline fallbacks

---

## 12. REPORT FILES GENERATED

| File | Description |
|------|-------------|
| `00_ARCHITECTURE_MAP.md` | System architecture, server/port map, tech stack |
| `01_DATABASE_MAP.md` | MongoDB connection, 47 models, relationships |
| `02_AUTH_LOGIN_TRACE.md` | JWT auth flow, login/register/card OTP |
| `03_FRONTEND_API_TRACE.md` | 27 service files, 80+ endpoints |
| `04_DISEASE_SCAN_TRACE.md` | YOLOv8s-cls, FastAPI port 8000 |
| `05_PRAGATI_AI_TRACE.md` | Pragati AI Bridge port 8001 |
| `06_VOICE_GUIDE_TRACE.md` | Voice Guide Bridge port 8002 |
| `07_WEATHER_TRACE.md` | WeatherAPI.com proxy, self-referential default |
| `08_MANDI_TRACE.md` | data.gov.in API, schema mismatch |
| `09_AI_FEATURE_TRACE.md` | Soil, Fertilizer, Crop Recommendation traces |
| `10_API_SCHEMA_MISMATCH.md` | Confirmed schema mismatches |
| `11_ANDROID_COMPATIBILITY.md` | Android/WebView issues |
| `12_MOBILE_LAYOUT_AUDIT.md` | Mobile CSS issues |
| `MASTER_FORENSIC_REPORT.md` | Complete findings and recommendations |
| `MASTER_FORENSIC_REPORT.json` | Structured JSON with all findings |
| `FINAL_REPORT.md` | This consolidated report |

---

## 13. CONCLUSION

The AgroudanAI codebase is **functionally complete** but **environmentally broken**. The application will not work on Android without:
1. Proper environment configuration
2. All AI microservices running
3. Network accessibility from device to backend
4. Android permissions and cleartext traffic enabled

No source code changes were made during this analysis. All findings are based on static code inspection and file system analysis.

**Next Step:** Proceed with Phase 1 (Infrastructure) fixes.
