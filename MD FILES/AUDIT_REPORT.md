# AgroDhan Kisan Pragati — Codebase Audit Report

> Generated from read-only inspection of `appcode-main`. Pure audit — no edits, no route listing. Under 8000 words.

---

## Area 1 — Shopkeeper / Fertilizer / Nursery / Organic / Shop Flows

### Frontend Pages

| Page | Status | Notes |
|---|---|---|
| `frontend/src/app/dashboard/shopkeeper/page.tsx` | Exists | Dashboard shows products from all 3 types based on `shopType`. Profile views, quick actions, verification banner. `productRoute` at line 61 routes to `/dashboard/shopkeeper/products/organic` when `shopType === 'organic'`. |
| `frontend/src/app/dashboard/shopkeeper/products/fertilizer/` | Exists | Read in prior phase. |
| `frontend/src/app/dashboard/shopkeeper/products/nursery/` | Exists | Read in prior phase. Includes create page. |
| `frontend/src/app/dashboard/shopkeeper/products/organic/page.tsx` | **MISSING** | Line 61 of `shopkeeper/page.tsx` navigates here, but no page file exists. This is a hard redirect target with no UI. |
| `frontend/src/app/shop/id/page.tsx` | Exists (stub) | Line 1–22: empty component, no data loading, no API call. Public shop page is non-functional. |
| `frontend/src/app/dashboard/shopkeeper/complete-profile/page.tsx` | Exists | Profile completion with type selection (fertilizer/nursery/organic). |
| `frontend/src/app/dashboard/shopkeeper/edit-profile/page.tsx` | Exists | Edit profile page. |
| `frontend/src/app/dashboard/shopkeeper/profile/page.tsx` | Exists | Profile view page. |
| `frontend/src/app/dashboard/shopkeeper/analytics/` | Exists | Read in prior phase. |
| `frontend/src/app/marketplace/shops/page.tsx` | Exists | Public shop listing. |
| `frontend/src/app/marketplace/shop/id/page.tsx` | Read in prior phase. |

### Shopkeeper API Service

- `frontend/src/services/shopkeeperApi.ts` (lines 1–134): CRUD for fertilizer, nursery, organic products. All organic endpoints are called (lines 49, 52, 55, 58) even though the organic page is missing.

### Backend Routes

- `backend/src/routes/shopkeeper.ts` (816 lines, fully read):
  - Profile CRUD, shop type selection (`POST /select-type`), verification submission.
  - Fertilizer products: full CRUD with image upload (lines 165–280).
  - Nursery products: full CRUD with image upload, `organicCertified` field (lines 286–389).
  - Organic products: full CRUD with image upload (lines 686–780). Backend is complete — `OrganicProduct` model, `OrganicProduct` route, multer upload with 5-image limit.
  - Marketplace: public discovery with Haversine distance + 6-level scoring (village=8000, tehsil=4000, district=2000, state=500, verified=10000, distance penalty) (lines 395–465).
  - Crop products: AI Crop Advisory enrichment (lines 499–589).
  - Seed search: multi-pattern matching (lines 595–680).
  - **Gap**: Marketplace only supports `fertilizer`/`nursery` type filter (line 401). Organic shops cannot be filtered in marketplace. The `marketplace/:id` route (line 468) returns nursery products for non-fertilizer shops but organic shops would show nursery products incorrectly (line 482: `else` branch fetches NurseryProduct for any non-fertilizer shop).

### Model Dependencies

- `ShopkeeperProfile`, `FertilizerProduct`, `NurseryProduct`, `OrganicProduct`, `ShopMatcher` (service).

### Hardcoded/Mock Data

- None found in this area — all data flows through API.

### Severity

| Finding | Severity | File:Line |
|---|---|---|
| Organic products page missing but fully routed to | **High** | `frontend/src/app/dashboard/shopkeeper/page.tsx:61` |
| Public shop page is empty stub (no data loading) | **High** | `frontend/src/app/shop/id/page.tsx:1-22` |
| Marketplace `marketplace/:id` shows nursery products for organic shops | **Medium** | `backend/src/routes/shopkeeper.ts:482` |
| Marketplace type filter excludes organic | **Medium** | `backend/src/routes/shopkeeper.ts:401` |

---

## Area 2 — AI / Smart Agriculture

### AI Models & Datasets

- `Ai/intent_engine/models/model_metadata.json`: Logistic regression model, 14 intent classes (crop, disease, emergency, fertilizer, general, government, greeting, irrigation, machinery, market, pest, seed, soil, weather). Trained 2026-08-11. Validation accuracy **0.8263**, macro F1 **0.7879**. Training time 4.27s.
- `Ai/intent_engine/outputs/dataset_statistics.json`: 10,655 raw → 8,864 clean (1,791 duplicates removed). Train/val/test split 70/15/15.
- **Under-represented classes**: emergency (100), irrigation (99), machinery (100), seed (101), pest (197) — all <200 samples.

### AI Frontend Components & Services

- `frontend/src/app/dashboard/farmer/page.tsx` (398 lines): Farmer dashboard integrates weather, soil moisture, KVK widget, AI assistant, location. Uses `useLocation`, `useVoiceGuide`, `useAIAssistant`, `usePageContext`.
- `frontend/src/app/dashboard/farmer/soil-health/page.tsx`: Soil health report with organic carbon, benchmark comparison, organic/fertilizer recommendations.
- `frontend/src/app/disease-detection/page.tsx`: Disease detection with AI analysis, organic/chemical treatment, severity assessment. Uses `FarmerSidebar`.
- `frontend/src/app/dashboard/farmer/recommendations/page.tsx`: Redirects to `/crop-recommendation`.
- `frontend/src/app/dashboard/farmer/ai-suggestions/page.tsx` (lines 8–11): **Hardcoded** AI suggestions array — not from any API/model:
  ```ts
  organicTreatment: 'Neem spray.', organicTreatmentHindi: 'नीम का छिड़काव।'
  ```
- `frontend/src/components/AIAssistantWidget.tsx`: AI widget with bilingual (EN/HI) messages.
- `frontend/src/context/AIAssistantContext.tsx` (line 19): Type defines `severity`, `causes`, `organicSolution` fields.

### AI Backend Services

- `backend/src/services/soilAIService.ts` (376 lines): OpenAI-based soil analysis. Weighted scoring (pH=20, N=20, P=15, K=15, organicCarbon=20, EC=10). Returns soil health score, deficiencies, benchmark comparison, organic/fertilizer recommendations, crop recommendations, AI analysis in EN+HI.
- `backend/src/services/recommendationEngine.ts` (149 lines): Weighted crop recommendation (soil=0.30, pH=0.20, water=0.15, season=0.15, climate=0.10, budget=0.10). Min suitability threshold 70%. Uses `CropKnowledgeBase` model.
- `backend/src/services/aiFosEngine.ts` (269 lines): AI Farm Operating System — crop lifecycle/task generation using OpenAI, with built-in fallback templates for wheat (120 days), rice (130 days), mustard (110 days). Task types: irrigation, fertilizer, pesticide, weeding, monitoring, harvest, general.
- `backend/src/services/pragatiAIService.ts` (327 lines): Python Pragati AI Bridge client (port 8001). Handles text, voice (multipart), image (multipart). All failures return structured errors, never throw.
- `backend/src/services/kvkService.ts`: Geocoding (Google Maps, graceful fallback), Haversine nearest-KVK search.
- `backend/src/services/responseGenerator.ts` (referenced): Generates bilingual disease response with organic/chemical treatment sections.

### AI API Routes (backend)

- `backend/src/routes/cropRecommendation.ts`, `backend/src/routes/aiFos.ts`, `backend/src/routes/aiAssistant.ts`, `backend/src/routes/disease.ts`, `backend/src/routes/diseasePestSolutions.ts`, `backend/src/routes/soil.ts`, `backend/src/routes/soilMoisture.ts`, `backend/src/routes/weather.ts`, `backend/src/routes/crops.ts`.

### Backend Entry Point

- `backend/src/index.ts` (214 lines): Express app on port 5000. 55+ route modules registered. Uses `dotenv`, `cors`, `rate-limit`, `express-session`. Bootstraps admin user and seeds schemes on startup.

### Hardcoded/Mock Data

- `frontend/src/app/dashboard/farmer/ai-suggestions/page.tsx:8-11`: Hardcoded treatment suggestions.

### Severity

| Finding | Severity | File:Line |
|---|---|---|
| AI suggestions page uses hardcoded data, no API integration | **Medium** | `frontend/src/app/dashboard/farmer/ai-suggestions/page.tsx:8-11` |
| Emergency class has lowest training samples (100) — model may underperform | **Medium** | `Ai/intent_engine/outputs/dataset_statistics.json:105-110` |
| Recommendation engine uses static weights, no online learning | **Low** | `backend/src/services/recommendationEngine.ts:34-41` |

---

## Area 3 — Language / Localization / Voice

### Language Context & Engine

- `frontend/src/context/LanguageContext.tsx` (214 lines): Full i18n system. Server > localStorage > default resolution. Popup on first visit. RTL support via `dir` attribute. Dynamic translation imports per language. Persistent to server via `PUT /settings`.
- `frontend/src/i18n/languages.ts` (referenced): Defines LANGUAGES array with 13+ languages/dialects.
- `frontend/src/services/languageEngine.ts` (referenced): Client-side term lookup against `GET /api/language-engine/lookup`.
- `backend/src/routes/languageEngine.ts` (294 lines, fully read):
  - Public: language detection, single/batch speech translation pipeline, output translation, term lookup.
  - Admin: dictionary CRUD, review queue (pending/approve/reject/merge), cache stats/clear.
  - Dictionary review queue: admin approves → creates `LanguageDictionary` entry with upsert. Rejects. Merges as alias.

### Speech/Voice Pipeline

- `frontend/src/context/VoiceGuideContext.tsx` (referenced): Voice guide context with 13 supported pages.
- `frontend/src/hooks/useVoiceGuide.ts`: Per-page voice narration hook.
- `frontend/src/hooks/useVoice.ts`: Voice playback hook.
- `frontend/src/services/speechPipeline.ts`: Frontend speech pipeline.
- `backend/src/services/speechTranslationPipeline.ts` (251 lines): Full backend pipeline — Unicode-based language detection (Devanagari→hi, Bengali→bn, Punjabi→pa, etc.), dictionary normalization, English internal representation, Hindi display, dialect voice. In-process translation cache (Map).
- `backend/src/services/voiceGuideBridgeManager.ts`: Manages Pragati AI voice bridge (port 8001).
- `backend/src/services/voiceProviderAdapter.ts`, `voiceEngineHelpers.ts`, `voiceDatasetRegistry.ts`: Voice infrastructure.
- `backend/src/routes/voiceGuide.ts`, `voiceEngine.ts`: Voice API routes.

### AI Config

- `Ai/voice_guide_ai/config/app_config.json`: Voice guide AI config.
- `Ai/voice_guide_ai/config/voice_config.json`: All dialects map to `hi-IN-SwaraNeural` (single voice for all dialects).
- `Ai/voice_guide_ai/config/language_config.json`: Language configuration.
- `Ai/voice_guide_ai/config/offline_config.json`: Offline fallback config.

### Intent Engine Datasets

- `Ai/intent_engine/models/crop.json`, `fertilizer.json`, `general.json` (referenced in prior phase): Training datasets.

### Severity

| Finding | Severity | File:Line |
|---|---|---|
| Voice config uses single voice (hi-IN-SwaraNeural) for all Rajasthan dialects — no dialect-specific TTS | **Medium** | `Ai/voice_guide_ai/config/voice_config.json` |
| Translation cache is in-memory only — lost on server restart, no TTL | **Low** | `backend/src/services/speechTranslationPipeline.ts:27` |
| Language detection falls back to 'hi' for non-ASCII text — may misclassify | **Low** | `backend/src/services/speechTranslationPipeline.ts:55` |

---

## Area 4 — Contact / Location / KVK / Support

### KVK

- `frontend/src/components/kvk/NearestKVKWidget.tsx` (225 lines, fully read): KVK finder widget. Features: nearest KVK card, map view, change address, view more modal, refresh, loading/error states. Listens to `farmer-address-changed` event. Uses `fetchNearestKVK` service, `KVKCard`, `MapCard` components.
- `backend/src/routes/kvk.ts` (325 lines, fully read):
  - Farmer: `POST /api/kvk/nearest` (multi-tier coordinate resolution: body → Google geocode → profile coords → profile address geocode → User.location geocode). `POST /api/kvk/geocode`.
  - Admin: full KVK CRUD with photo upload, search/filter/pagination, toggle, delete (with photo cleanup).
  - Haversine distance calculation. 10-nearest limit.
- `backend/src/services/kvkService.ts` (76 lines): Geocoding (Google Maps, null on failure), `findNearestKVKs`, `haversineKm`.

### Location Service

- `frontend/src/context/LocationContext.tsx` (148 lines): Farmer location context. GPS detection via browser geolocation + OpenStreetMap Nominatim reverse geocoding. On mount: load from profile → try GPS if empty. `saveLocation` → `PUT /users/location`. Subscribers notified on change.
- `frontend/src/services/locationService.ts` (91 lines): `geocodeAddress` (backend via `POST /api/kvk/geocode`), `reverseGeocode` (Nominatim, no key required).
- `frontend/src/services/addressService.ts` (83 lines): Shared address service. `getAddressFromCache`, `cacheAddress` (fires `farmer-address-changed` event), `saveAddress` (to backend).

### Contact/Support

- `frontend/src/app/contact/page.tsx` (Read in prior phase): Contact form.
- `backend/src/routes/support.ts` (49 lines, fully read): `POST /api/support` — creates `SupportRequest` with user ID, name, email, phone, category, subject, message, attachments (3-file multer upload, 10MB limit). **No admin retrieval route** — support tickets have no backend read/list endpoint for admins.

### Farmer Sidebar (Navigation)

- `frontend/src/components/FarmerSidebar.tsx` (301 lines): Full sidebar with 18 nav items, mobile/desktop responsive, language selector, avatar, AI assistant button. Nav items: dashboard, my-crops, aiAdvisor, diseaseScan, kvK, weather, marketPrice, marketplace, soilHealth, fertilizerCalc, govtSchemes, community, learning, rewards, notifications, profile, settings.

### Severity

| Finding | Severity | File:Line |
|---|---|---|
| Support tickets have no admin retrieval endpoint | **High** | `backend/src/routes/support.ts:20-47` |
| KVK geocoding fails silently (returns null) when Google API key missing — farmer may get no results | **Medium** | `backend/src/services/kvkService.ts:29-47` |
| LocationContext falls back to GPS on empty profile — if GPS denied, farmer gets empty location | **Medium** | `frontend/src/context/LocationContext.tsx:107-135` |
| `community` nav item links to `/schemes` (duplicate of govtSchemes) | **Low** | `frontend/src/components/FarmerSidebar.tsx:45-46` |

---

## Area 5 — Admin Functionality

### Admin Pages (all under `admin/src/app/`)

| Page | Status |
|---|---|
| `users/page.tsx` | Exists (641 lines). Full user management with Kisan Card integration, role/verify/disable/delete mutations, pagination, search. |
| `shopkeeper-verification/page.tsx` | Exists (225 lines). Tabbed interface (pending/verified/rejected). Approve/reject with reason + re-application toggle. |
| `ai-analytics/page.tsx` | Exists (201 lines). Stat cards for requests, AI calls, cache, cost savings. Crop/category charts. |
| `kvk-management/page.tsx` | Exists (184 lines). Full CRUD with search, state/district/active filters, add/edit modal. |
| `settings/page.tsx` | Exists (75 lines). API URL display, health check, bootstrap admin instructions. |
| `crop-knowledge-base/page.tsx` | Read in prior phase. |
| `disease-knowledge-base/page.tsx` | Read in prior phase. Organic solution field exists. |
| `pest-knowledge-base/page.tsx` | Read in prior phase. Organic control field exists. |
| `registered-shops/page.tsx` | Read in prior phase. |
| `listings/page.tsx` | Read in prior phase. Organic flag shown (line 30). |
| `scheme-applications/page.tsx` | Read in prior phase. |
| `scheme-detail/` | Read in prior phase. |

### Admin API Service

- `admin/src/components/admin/admin-api.ts` (referenced): Fetch functions for users, KVK, listings, schemes, etc.
- `admin/src/components/admin/admin-types.ts` (699 lines, partial read): TypeScript types for AdminUser (with kisanCardNumber, kisanCardStatus), Listing (organic flag), SchemeType, GovtScheme, etc.

### Admin Backend Routes

- `backend/src/routes/admin.ts` (522 lines, fully read):
  - `/admin/overview`: User/recommendation/listing totals.
  - `/admin/users`: Full CRUD with Kisan Card join (cardNumber, cardStatus), role/verified/active filters.
  - `/admin/users/:id/role`, `:id/verify`, `:id/disable`, `:id`: User mutations.
  - `/admin/recommendations`: List/delete crop recommendations.
  - `/admin/listings`: List/update/delete marketplace listings.
  - `/admin/ai-analytics`: Aggregated AI stats from `CropKnowledgeBase`.
  - `/admin/ai-recommendations`: Full CRUD for AI crop entries (admin edit, status approve/disable/archive).
  - `/admin/crop-knowledge`: Full CRUD for crop knowledge base.
  - `/admin/kisan-cards`: Kisan Card list with search (cardNumber, name, state, district).
- `backend/src/routes/adminShopkeeper.ts` (referenced): Shopkeeper admin routes.
- `backend/src/routes/auth.ts`, `backend/src/routes/users.ts`, `backend/src/routes/settings.ts`: Auth and user routes.

### Admin Layout

- `admin/src/app/layout.tsx` (30 lines): Wraps children in `AdminProvider`. No sidebar visible in layout — sidebar likely in `AdminProvider` or individual pages.
- No dedicated admin navigation/sidebar file found (checked `admin/src/components/admin/Sidebar*` — not found). Admin navigation is probably per-page or in `AdminProvider`.

### Severity

| Finding | Severity | File:Line |
|---|---|---|
| No admin sidebar/layout navigation — admin nav is per-page | **Medium** | `admin/src/app/layout.tsx` (no nav) |
| Support ticket admin retrieval endpoint missing | **High** | `backend/src/routes/support.ts` (no GET route) |
| `feedback: { helpful: 0, notHelpful: 0 }` hardcoded in ai-analytics endpoint | **Low** | `backend/src/routes/admin.ts:334` |
| Estimated savings formula is trivial (totalCached × 0.01) | **Low** | `backend/src/routes/admin.ts:325` |

---

## Cross-Cutting Gaps

| Gap | Severity | Details |
|---|---|---|
| Organic shop page missing | **High** | `frontend/src/app/dashboard/shopkeeper/products/organic/page.tsx` does not exist; routed to from `shopkeeper/page.tsx:61` |
| Public shop page is empty stub | **High** | `frontend/src/app/shop/id/page.tsx:1-22` — no data loading |
| Backend `frontend/src/services/backend.ts` not found | **Medium** | Referenced path from prior summary; actual file is `backend/src/index.ts` |
| Support tickets have no admin retrieval | **High** | `backend/src/routes/support.ts` has only POST |
| Marketplace doesn't handle organic shop type | **Medium** | `backend/src/routes/shopkeeper.ts:401,482` |
| AI suggestions hardcoded | **Medium** | `frontend/src/app/dashboard/farmer/ai-suggestions/page.tsx:8-11` |
| Admin navigation structure unclear | **Low** | No sidebar in `admin/src/app/layout.tsx` |
| Voice config: single voice for all dialects | **Medium** | `Ai/voice_guide_ai/config/voice_config.json` |
| Under-represented intent classes (emergency=100) | **Medium** | `Ai/intent_engine/outputs/dataset_statistics.json` |
| Data directory contains only MongoDB WAL files | **Low** | `data/mongo/` — no structured datasets |

---

## Data Sources

- 60+ source files read across frontend, admin, backend, and Ai directories.
- MongoDB data directory (`data/mongo/`) contains WAL files only — no queryable structured data.
- No `backend/src/services/backend.ts` exists; actual backend entry is `backend/src/index.ts`.
- `frontend/src/services/backend.ts` also not found; frontend uses `lib/backend.ts` for `API_BASE`.
