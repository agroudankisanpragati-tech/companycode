# COMPANYCODE — FRONTEND API TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. FRONTEND API CLIENT CONFIGURATION

**File**: `frontend/src/lib/backend.ts`
```typescript
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
```

**Environment**: `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

**Note**: Most frontend services use relative URLs (`/api/...`) instead of `API_BASE`, which Next.js rewrites to the backend.

---

## 2. COMPLETE FRONTEND API CONSUMERS

### 2.1 Authentication

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `context/AuthContext.tsx` | `requestEmailOtp()` | POST | `/api/auth/register/request-otp` | Content-Type: application/json | No | `{ email, role }` | `auth.ts:122` | auth.ts | — | User |
| `context/AuthContext.tsx` | `verifyEmailOtp()` | POST | `/api/auth/register/verify-otp` | Content-Type: application/json | No | `{ email, otp }` | `auth.ts:157` | auth.ts | — | — |
| `context/AuthContext.tsx` | `register()` | POST | `/api/auth/register` | Content-Type: application/json | No | `{ name, email, password, role, ... }` | `auth.ts:201` | auth.ts | — | User |
| `context/AuthContext.tsx` | `login()` | POST | `/api/auth/login` | Content-Type: application/json | No | `{ email, password, role }` | `auth.ts:281` | auth.ts | — | User |
| `context/AuthContext.tsx` | `restoreSession()` | GET | `/api/auth/me` | Authorization: Bearer <token> | Yes | — | `auth.ts:319` | auth.ts | — | User |
| `services/cardLogin.ts` | `requestCardOtp()` | POST | `/api/auth/card/request-otp` | Content-Type: application/json | No | `{ cardNumber, mobile }` | `cardLogin.ts:56` | cardLogin.ts | — | AgroudAnKisanCard, User |
| `services/cardLogin.ts` | `verifyCardOtp()` | POST | `/api/auth/card/verify-otp` | Content-Type: application/json | No | `{ cardNumber, mobile, otp }` | `cardLogin.ts:111` | cardLogin.ts | — | AgroudAnKisanCard, User |

### 2.2 Farmer Profile

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/farmerProfile.ts` | `getFullProfile()` | GET | `/api/farmer-profile` | Authorization: Bearer <token> | Yes | — | `farmerProfile.ts:35` | farmerProfile.ts | — | User, FarmerProfileData |
| `services/farmerProfile.ts` | `saveFullProfile()` | PUT | `/api/farmer-profile` | Authorization: Bearer <token> | Yes | `{ name, phone, location, soilType, ... }` | `farmerProfile.ts:53` | farmerProfile.ts | — | User, FarmerProfileData |
| `services/farmerProfile.ts` | `uploadAvatar()` | POST | `/api/farmer-profile/avatar` | Authorization: Bearer <token> | Yes | FormData: avatar | `farmerProfile.ts:111` | farmerProfile.ts | — | User |
| `services/farmerProfile.ts` | `removeAvatar()` | DELETE | `/api/farmer-profile/avatar` | Authorization: Bearer <token> | Yes | — | `farmerProfile.ts:138` | farmerProfile.ts | — | User |
| `services/farmerProfile.ts` | `addFarm()` | POST | `/api/farmer-profile/farm` | Authorization: Bearer <token> | Yes | `{ farmName, farmSize, ... }` | `farmerProfile.ts:155` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `updateFarm()` | PUT | `/api/farmer-profile/farm/:id` | Authorization: Bearer <token> | Yes | `{ farmName, farmSize, ... }` | `farmerProfile.ts:169` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `deleteFarm()` | DELETE | `/api/farmer-profile/farm/:id` | Authorization: Bearer <token> | Yes | — | `farmerProfile.ts:185` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `addLand()` | POST | `/api/farmer-profile/land` | Authorization: Bearer <token> | Yes | `{ name, area, unit, ... }` | `farmerProfile.ts:201` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `updateLand()` | PUT | `/api/farmer-profile/land/:id` | Authorization: Bearer <token> | Yes | `{ name, area, ... }` | `farmerProfile.ts:215` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `deleteLand()` | DELETE | `/api/farmer-profile/land/:id` | Authorization: Bearer <token> | Yes | — | `farmerProfile.ts:231` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `addCropRecord()` | POST | `/api/farmer-profile/crop` | Authorization: Bearer <token> | Yes | `{ cropName, season, year, ... }` | `farmerProfile.ts:247` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `updateCropRecord()` | PUT | `/api/farmer-profile/crop/:id` | Authorization: Bearer <token> | Yes | `{ cropName, season, ... }` | `farmerProfile.ts:261` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `deleteCropRecord()` | DELETE | `/api/farmer-profile/crop/:id` | Authorization: Bearer <token> | Yes | — | `farmerProfile.ts:277` | farmerProfile.ts | — | FarmerProfileData |
| `services/farmerProfile.ts` | `deleteAccount()` | DELETE | `/api/farmer-profile/account` | Authorization: Bearer <token> | Yes | `{ password }` | `farmerProfile.ts:293` | farmerProfile.ts | — | User, FarmerProfileData |
| `services/farmerProfile.ts` | `changePassword()` | POST | `/api/settings/change-password` | Authorization: Bearer <token> | Yes | `{ currentPassword, newPassword }` | `settings.ts:58` | settings.ts | — | User |

### 2.3 Disease Detection

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| Disease components | `fetchSupportedCrops()` | GET | `/api/disease/supported-crops` | Authorization: Bearer <token> | Yes | — | `disease.ts:46` | disease.ts | `yoloService.ts:fetchCropsFromYolo()` | — |
| Disease components | `scanDisease()` | POST | `/api/disease/scan` | Authorization: Bearer <token> | Yes | FormData: image, cropName | `disease.ts:60` | disease.ts | `diseaseService.ts:runHybridDiseaseDetection()` | DiseaseRecommendation, DiseasePestSolution |
| Disease components | `getHistory()` | GET | `/api/disease/history` | Authorization: Bearer <token> | Yes | Query: page, limit | `disease.ts:246` | disease.ts | — | DiseaseRecommendation |
| Disease components | `translateResult()` | POST | `/api/disease/translate` | Authorization: Bearer <token> | Yes | `{ recordId, language }` | `disease.ts:263` | disease.ts | `translationService.ts:translateObject()` | DiseaseRecommendation |
| Disease components | `submitFeedback()` | POST | `/api/disease/feedback` | Authorization: Bearer <token> | Yes | `{ recommendationId, feedback, comment, correctDisease }` | `disease.ts:309` | disease.ts | `diseaseService.ts:handleFeedbackForKB()` | DiseaseRecommendation, DiseasePestSolution |

### 2.4 Pragati AI

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/pragatiAI.ts` | `sendTextQuery()` | POST | `/api/pragati-ai/text` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ text, sessionId, language, synthesizeAudio, extra }` | `pragatiAI.ts:302` | pragatiAI.ts | `pragatiAIService.ts:processText()` | AIConversation, FarmerMemory |
| `services/pragatiAI.ts` | `sendVoiceQuery()` | POST | `/api/pragati-ai/voice` | Authorization: Bearer <token> | Yes | FormData: audio, session_id, language, synthesize_audio | `pragatiAI.ts:375` | pragatiAI.ts | `pragatiAIService.ts:processVoice()` | AIConversation, FarmerMemory |
| `services/pragatiAI.ts` | `sendImageQuery()` | POST | `/api/pragati-ai/image` | Authorization: Bearer <token> | Yes | FormData: image, session_id, language | `pragatiAI.ts:461` | pragatiAI.ts | `pragatiAIService.ts:processImage()` | AIConversation, FarmerMemory, DiseaseRecommendation |
| `services/pragatiAI.ts` | `getAIHistory()` | GET | `/api/pragati-ai/history` | Authorization: Bearer <token> | Yes | Query: limit, skip, type | `pragatiAI.ts:544` | pragatiAI.ts | — | AIConversation |
| `services/pragatiAI.ts` | `getAIHealth()` | GET | `/api/pragati-ai/health` | Authorization: Bearer <token> | Yes | — | `pragatiAI.ts:583` | pragatiAI.ts | `pragatiAIService.ts:getAIHealth()` | — |
| `services/pragatiAI.ts` | `getAIStats()` | GET | `/api/pragati-ai/stats` | Authorization: Bearer <token> | Yes | — | `pragatiAI.ts:633` | pragatiAI.ts | — | AIConversation |
| `services/pragatiAI.ts` | `endAISession()` | DELETE | `/api/pragati-ai/session/:sessionId` | Authorization: Bearer <token> | Yes | — | `pragatiAI.ts:618` | pragatiAI.ts | `pragatiAIService.ts:endAISession()` | — |

### 2.5 AI Assistant (Chat)

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/speechPipeline.ts` | `runPipeline()` | POST | `/api/language-engine/pipeline` | Content-Type: application/json | No | `{ rawText, appLangCode, pageContext }` | `languageEngine.ts` | — | `speechTranslationPipeline.ts:runSpeechTranslationPipeline()` | LanguageDictionary |
| `services/speechPipeline.ts` | `translateOutput()` | POST | `/api/language-engine/translate-output` | Content-Type: application/json | No | `{ englishText, appLangCode }` | `languageEngine.ts` | — | `translationService.ts:translateObject()` | — |
| `services/speechPipeline.ts` | `detectLanguage()` | POST | `/api/language-engine/detect-language` | Content-Type: application/json | No | `{ text }` | `languageEngine.ts` | — | — | — |
| AI Assistant components | Chat | POST | `/api/ai-assistant/chat` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ messages, dashboardContext, selectedLang, pageData }` | `aiAssistant.ts:72` | aiAssistant.ts | `pragatiAIController.ts:runPragatiAIController()` | User, SoilMoisture, AIConversation |
| AI Assistant components | Dashboard Context | GET | `/api/ai-assistant/dashboard-context` | Authorization: Bearer <token> | Yes | — | `aiAssistant.ts:21` | aiAssistant.ts | — | User, SoilMoisture |

### 2.6 Voice Guide

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/voiceGuide.ts` | `initialize()` | POST | `/api/voice-guide/initialize` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ page, language }` | `voiceGuide.ts:143` | voiceGuide.ts | `voiceGuideBridgeManager.ts` | — |
| `services/voiceGuide.ts` | `openPage()` | POST | `/api/voice-guide/page` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ page, language }` | `voiceGuide.ts:201` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `play()` | POST | `/api/voice-guide/play` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ page, dialogue_type, language, priority, context }` | `voiceGuide.ts:227` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `replay()` | POST | `/api/voice-guide/replay` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ dialogue_id }` | `voiceGuide.ts:256` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `setLanguage()` | POST | `/api/voice-guide/language` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ language }` | `voiceGuide.ts:275` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `setOnline()` | POST | `/api/voice-guide/online` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ online }` | `voiceGuide.ts:289` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `getStatus()` | GET | `/api/voice-guide/status` | Authorization: Bearer <token> | Yes | — | `voiceGuide.ts:302` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `getDialogue()` | GET | `/api/voice-guide/dialogue/:page/:type` | Authorization: Bearer <token> | Yes | Query: lang | `voiceGuide.ts:314` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `getTranslation()` | GET | `/api/voice-guide/translation/:lang/:page` | Authorization: Bearer <token> | Yes | — | `voiceGuide.ts:328` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `getAvatarConfig()` | GET | `/api/voice-guide/avatar/config` | Authorization: Bearer <token> | Yes | — | `voiceGuide.ts:341` | voiceGuide.ts | — | — |
| `services/voiceGuide.ts` | `health()` | GET | `/api/voice-guide/health` | None | No | — | `voiceGuide.ts:130` | voiceGuide.ts | — | — |

### 2.7 Weather

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/weather.ts` | `fetchWeather()` | GET | `/api/weather?latitude=...&longitude=...` | None | No | — | `weather.ts:7` | weather.ts | `weatherService.ts:fetchWeather()` | — |
| `services/weather.ts` | `searchLocations()` | GET | `/api/weather/search?query=...` | None | No | — | `weather.ts:33` | weather.ts | `weatherService.ts:searchLocations()` | — |
| `services/weather.ts` | `fetchWeatherByLocation()` | GET | `/api/weather?location=...` | None | No | — | `weather.ts:12` | weather.ts | `weatherService.ts:fetchWeatherByLocationQuery()` | — |

### 2.8 Mandi / Market Price

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/mandibav.ts` | `getPrices()` | GET | `/api/mandi/prices` | Content-Type: application/json | No | Query: commodity, state, market, date | `mandi.ts:304` | mandi.ts | — | FarmerMarketPreference, MarketPriceHistory |
| `services/marketPrice.ts` | `getPriceById()` | GET | `/api/mandi/prices/:id` | Content-Type: application/json | No | — | `mandi.ts` | mandi.ts | — | — |
| `services/mandibav.ts` | (via backend proxy) | GET | `/api/mandi/prices` | Content-Type: application/json | No | Query: commodity, state, district | `mandi.ts:304` | mandi.ts | `axios.get(MANDI_API_BASE)` | — |
| Mandi components | GET | GET | `/api/mandi/preference` | Authorization: Bearer <token> | Yes | — | `mandi.ts:136` | mandi.ts | — | FarmerMarketPreference |
| Mandi components | PUT | PUT | `/api/mandi/preference` | Authorization: Bearer <token> | Yes | `{ selectedCrop, selectedDistrict, selectedState }` | `mandi.ts:163` | mandi.ts | — | FarmerMarketPreference, User |
| Mandi components | GET | GET | `/api/mandi/current` | Authorization: Bearer <token> | Yes | — | `mandi.ts:195` | mandi.ts | `axios.get(MANDI_API_BASE)` | FarmerMarketPreference, MarketPriceHistory |
| Mandi components | GET | GET | `/api/mandi/history` | Authorization: Bearer <token> | Yes | Query: crop | `mandi.ts:281` | mandi.ts | — | MarketPriceHistory |

### 2.9 Soil Health

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/soilHealth.ts` | `uploadSoilReport()` | POST | `/api/soil/upload` | Authorization: Bearer <token> | Yes | FormData: report | `soil.ts:142` | soil.ts | `soilAIService.ts:extractAndAnalyzeSoilWithAI()` | SoilReport, SoilStandard |
| `services/soilHealth.ts` | `analyzeSoilData()` | POST | `/api/soil/analyze` | Authorization: Bearer <token> | Yes | `{ soilType, pH, nitrogen, ... }` | `soil.ts:205` | soil.ts | `soilAIService.ts:generateAIAnalysisFromData()` | SoilReport, SoilStandard |
| `services/soilHealth.ts` | `getSoilReport()` | GET | `/api/soil/:id` | Authorization: Bearer <token> | Yes | — | `soil.ts:358` | soil.ts | — | SoilReport |
| `services/soilHealth.ts` | `getSoilHistory()` | GET | `/api/soil/history` | Authorization: Bearer <token> | Yes | Query: page, limit | `soil.ts:261` | soil.ts | — | SoilReport |
| `services/soilHealth.ts` | `deleteSoilReport()` | DELETE | `/api/soil/:id` | Authorization: Bearer <token> | Yes | — | `soil.ts:338` | soil.ts | — | SoilReport |
| `services/soilHealth.ts` | `getCropRecommendations()` | GET | `/api/soil/crops/:id` | Authorization: Bearer <token> | Yes | — | `soil.ts:282` | soil.ts | — | SoilReport |

### 2.10 Soil Moisture

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/soilMoisture.ts` | `getMoisture()` | GET | `/api/soil-moisture` | Authorization: Bearer <token> | Yes | — | `soilMoisture.ts:102` | soilMoisture.ts | — | SoilMoisture, User |
| `services/soilMoisture.ts` | `updateLocation()` | POST | `/api/soil-moisture/location` | Authorization: Bearer <token> | Yes | `{ state, district }` | `soilMoisture.ts:145` | soilMoisture.ts | — | SoilMoisture, User |

### 2.11 Crop Recommendation

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/cropRecommendation.ts` | `getCropRecommendations()` | POST | `/api/crop-recommendation` | Authorization: Bearer <token> | Yes | `{ farmArea, areaUnit, state, district, soilType, soilPH, ... }` | `cropRecommendation.ts:71` | cropRecommendation.ts | `recommendationEngine.ts`, `similaritySearch.ts`, `openaiService.ts` | FarmerCropRequest, CropKnowledgeBase |
| `services/cropRecommendation.ts` | `getRecommendationHistory()` | GET | `/api/crop-recommendation/history` | Authorization: Bearer <token> | Yes | Query: page, limit | `cropRecommendation.ts:161` | cropRecommendation.ts | — | FarmerCropRequest, CropKnowledgeBase |
| `services/cropRecommendation.ts` | `getRecommendationById()` | GET | `/api/crop-recommendation/:id` | Authorization: Bearer <token> | Yes | — | `cropRecommendation.ts:209` | cropRecommendation.ts | — | CropKnowledgeBase |
| `services/cropRecommendation.ts` | `submitFeedback()` | POST | `/api/crop-recommendation/feedback` | Authorization: Bearer <token> | Yes | `{ recommendationId, feedback, feedbackNote }` | `cropRecommendation.ts:222` | cropRecommendation.ts | — | — |

### 2.12 My Crops

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/myCrops.ts` | `addMyCrop()` | POST | `/api/my-crops` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ cropName, image, category, description, ... }` | `myCrops.ts:8` | myCrops.ts | — | MyCrop |
| `services/myCrops.ts` | `getMyCrops()` | GET | `/api/my-crops` | Authorization: Bearer <token> | Yes | — | `myCrops.ts:19` | myCrops.ts | — | MyCrop |
| `services/myCrops.ts` | `getMyCropById()` | GET | `/api/my-crops/:id` | Authorization: Bearer <token> | Yes | — | `myCrops.ts:30` | myCrops.ts | — | MyCrop |
| `services/myCrops.ts` | `deleteMyCrop()` | DELETE | `/api/my-crops/:id` | Authorization: Bearer <token> | Yes | — | `myCrops.ts:42` | myCrops.ts | — | MyCrop |

### 2.13 Fertilizer Calculator

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/fertilizerCalculator.ts` | `calculateFertilizer()` | POST | `/api/fertilizer-calculator/calculate` | Authorization: Bearer <token>, Content-Type: application/json | Yes | `{ crop, areaValue, areaUnit, method, soilReportId }` | `fertilizerCalculator.ts:16` | fertilizerCalculator.ts | `fertilizerCalculatorService.ts:calculateFertilizer()`, `fertilizerAI.ts:getFertilizerAIRecommendation()` | SoilReport |
| `services/fertilizerCalculator.ts` | `getMeta()` | GET | `/api/fertilizer-calculator/meta` | None | No | — | `fertilizerCalculator.ts:10` | fertilizerCalculator.ts | — | — |
| `services/fertilizerCalculator.ts` | `getSoilReports()` | GET | `/api/fertilizer-calculator/soil-reports` | Authorization: Bearer <token> | Yes | — | `fertilizerCalculator.ts:78` | fertilizerCalculator.ts | — | SoilReport |

### 2.14 Kisan Card

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/kisanCard.ts` | `getCardStatus()` | GET | `/api/kisan-card/status` | Authorization: Bearer <token> | Yes | — | `kisanCard.ts:169` | kisanCard.ts | — | AgroudAnKisanCard |
| `services/kisanCard.ts` | `getCard()` | GET | `/api/kisan-card` | Authorization: Bearer <token> | Yes | — | `kisanCard.ts:188` | kisanCard.ts | — | AgroudAnKisanCard |
| `services/kisanCard.ts` | `createCard()` | POST | `/api/kisan-card` | Authorization: Bearer <token> | Yes | `{ fullName, fatherName, gender, ... }` | `kisanCard.ts:202` | kisanCard.ts | — | AgroudAnKisanCard, User, FarmerProfileData |
| `services/kisanCard.ts` | `updateCard()` | PUT | `/api/kisan-card` | Authorization: Bearer <token> | Yes | `{ fullName, fatherName, gender, ... }` | `kisanCard.ts:283` | kisanCard.ts | — | AgroudAnKisanCard, User, FarmerProfileData |

### 2.15 Government Schemes

| File | Function | Method | Endpoint | Headers | Auth | Request Body | Backend Route | Backend Controller | Backend Service | Database Model |
|------|----------|--------|----------|---------|------|--------------|---------------|-------------------|-----------------|----------------|
| `services/schemes.ts` | `fetchStateSchemes()` | GET | `/api/schemes?status=published&schemeType=state&state=...` | None | No | — | `schemes.ts` | schemes.ts | — | GovtScheme |

### 2.16 Other Services

| Service | File | Endpoints | Auth | Models |
|---------|------|-----------|------|--------|
| KVK | `services/kvk.ts` | `/api/kvk/*` | No | KVK |
| Gallery | `services/gallery.ts` | `/api/gallery` | No | GalleryItem |
| Blog | `services/blog.ts` | `/api/blogs/*` | No | BlogPost |
| Shop | `services/shopkeeperApi.ts` | `/api/shops/*`, `/api/shopkeeper/*` | Mixed | Shop, ShopProduct |
| Irrigation | `services/irrigation.ts` | `/api/irrigation/*` | Yes | IrrigationSchedule |
| Settings | `services/settings.ts` | `/api/settings/*` | Yes | UserSettings |
| Location | `services/locationService.ts` | Various | Mixed | User |
| Address | `services/addressService.ts` | Various | Yes | User |

---

## 3. API BASE URL ISSUES

### 3.1 Frontend .env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 3.2 Frontend Services
Most services use relative URLs:
```typescript
const API_BASE = '/api';  // or process.env.NEXT_PUBLIC_API_URL || '/api'
```

### 3.3 Next.js Rewrites
If `next.config.js` has rewrites configured, `/api/*` is forwarded to backend. Otherwise, Next.js tries to handle `/api/*` as a page route.

**Potential Issue**: If rewrites are not configured, API calls from static export will fail because there's no backend server to handle them.

---

## 4. FRONTEND API ERROR HANDLING

### 4.1 Common Pattern
```typescript
const res = await fetch(url, options);
const data = await res.json();
if (!res.ok) throw new Error(data.error || 'Failed');
return data;
```

### 4.2 Issues
1. **No timeout**: fetch calls have no explicit timeout
2. **No retry**: Failed requests are not retried
3. **JSON parsing assumption**: All responses assumed to be JSON
4. **HTML response crash**: If backend returns HTML (error page), `res.json()` throws

### 4.3 Safe Fetch Pattern (myCrops.ts)
```typescript
async function safeFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!text || text.trim() === '') throw new Error('Empty response');
  if (text.trimStart().startsWith('<')) throw new Error('Backend not reachable');
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
```

This pattern correctly detects HTML responses (starts with `<`) and empty responses.

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
