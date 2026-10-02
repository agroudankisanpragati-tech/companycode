# COMPANYCODE — AI FEATURE TRACE (Soil, Fertilizer, Crop, Farm Manager)
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. SOIL HEALTH

### 1.1 Frontend Service
**File**: `frontend/src/services/soilHealth.ts`

**Endpoints**:
- `POST /api/soil/upload` — Upload PDF/image soil report
- `POST /api/soil/analyze` — Analyze manually entered data
- `GET /api/soil/history` — Get report history
- `GET /api/soil/:id` — Get specific report
- `GET /api/soil/crops/:id` — Get crop recommendations for report
- `POST /api/soil/translate` — Translate report
- `DELETE /api/soil/:id` — Delete report

### 1.2 Backend Route
**File**: `backend/src/routes/soil.ts`

### 1.3 AI Service
**File**: `backend/src/services/soilAIService.ts`

**Key Functions**:
- `extractAndAnalyzeSoilWithAI(ocrText, standard)` — Uses OpenAI Vision API for image OCR, GPT for analysis
- `generateAIAnalysisFromData(data, standard)` — Uses OpenAI GPT for analysis
- `calculateSoilHealthScore(data, standard)` — Rule-based scoring
- `buildBenchmarkComparison(data, standard)` — Rule-based comparison
- `detectDeficiencies(data, standard)` — Rule-based deficiency detection

### 1.4 AI Model
- **Provider**: OpenAI/OpenRouter
- **Model**: `process.env.OPENAI_MODEL || 'openai/gpt-4o-mini'`
- **Base URL**: `process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'`
- **Usage**:
  1. OCR extraction (image reports) via GPT-4o Vision
  2. Soil data parsing and analysis
  3. Recommendations generation
  4. Hindi translation (`aiAnalysisHindi`)

### 1.5 Database Models
- `SoilReport` — Main report storage
- `SoilStandard` — Benchmark data (seeded at startup)

### 1.6 Request Flow
```
Frontend uploads file
    ↓
Backend /api/soil/upload
    ↓
Extract text (PDF parsing or OpenAI Vision)
    ↓
Get soil standard (Alluvial default)
    ↓
Call OpenAI for analysis
    ↓
Calculate health score
    ↓
Build benchmark comparison
    ↓
Detect deficiencies
    ↓
Save to SoilReport
    ↓
Return to frontend
```

---

## 2. FERTILIZER CALCULATOR

### 2.1 Frontend Service
**File**: `frontend/src/services/fertilizerCalculator.ts`

**Endpoints**:
- `GET /api/fertilizer-calculator/meta` — Get crops list + area units
- `POST /api/fertilizer-calculator/calculate` — Calculate fertilizer needs
- `GET /api/fertilizer-calculator/soil-reports` — List soil reports

### 2.2 Backend Route
**File**: `backend/src/routes/fertilizerCalculator.ts`

### 2.3 AI Service
**File**: `backend/src/services/fertilizerAI.ts`
**File**: `backend/src/services/fertilizerCalculatorService.ts`

**Key Functions**:
- `calculateFertilizer({ crop, areaValue, areaUnit, method, soil })` — Rule-based calculation
- `getFertilizerAIRecommendation({ calculation, soilType, soilPH, ... })` — OpenAI GPT recommendation

### 2.4 AI Model
- **Provider**: OpenAI/OpenRouter
- **Model**: `openai/gpt-4o-mini`
- **Usage**: Generate AI fertilizer recommendations based on soil data

---

## 3. CROP RECOMMENDATION

### 3.1 Frontend Service
**File**: `frontend/src/services/cropRecommendation.ts`

**Endpoints**:
- `POST /api/crop-recommendation` — Get recommendations
- `GET /api/crop-recommendation/history` — Get history
- `GET /api/crop-recommendation/:id` — Get specific recommendation
- `POST /api/crop-recommendation/translate` — Translate recommendations
- `POST /api/crop-recommendation/feedback` — Submit feedback

### 3.2 Backend Route
**File**: `backend/src/routes/cropRecommendation.ts`

### 3.3 Recommendation Pipeline
```typescript
// Step 1: Similarity search in CropKnowledgeBase
const similar = await findSimilarRecommendation(conditions);
if (similar.found) return res.json({ source: 'database', recommendations: similar.recommendations });

// Step 2: Run local recommendation engine
const { recommendations, hasHighScore } = await runRecommendationEngine(farmerRequest);
if (hasHighScore && recommendations.length >= 3) {
  await upsertToCropKnowledgeBase(recommendations, conditions, 'database', farmerId);
  return res.json({ source: 'database', recommendations });
}

// Step 3: Fallback to OpenAI GPT
const aiRecommendations = await callOpenAIForCrops(conditions);
await upsertToCropKnowledgeBase(aiRecommendations, conditions, 'openai', farmerId);
return res.json({ source: 'openai', recommendations: aiRecommendations });
```

### 3.4 AI Model
- **Provider**: OpenAI/OpenRouter
- **Model**: `openai/gpt-4o-mini`
- **Usage**: Final fallback when local database has no good matches

### 3.5 Database Models
- `FarmerCropRequest` — Request log
- `CropKnowledgeBase` — Cached recommendations

---

## 4. MY CROPS

### 4.1 Frontend Service
**File**: `frontend/src/services/myCrops.ts`

**Endpoints**:
- `POST /api/my-crops` — Add crop
- `GET /api/my-crops` — List crops
- `GET /api/my-crops/:id` — Get crop details
- `DELETE /api/my-crops/:id` — Remove crop

### 4.2 Backend Route
**File**: `backend/src/routes/myCrops.ts`

### 4.3 Database Model
- `MyCrop` — Farmer's saved crops with recommendation details

---

## 5. AI-FOS (Farm Operating System)

### 5.1 Frontend Service
**File**: `frontend/src/services/aiFos.ts` (not read, but referenced)

### 5.2 Backend Route
**File**: `backend/src/routes/aiFos.ts`

### 5.3 Key Features
- **Activate Crop**: Creates ActiveCrop + CropTask[] from lifecycle
- **Dashboard**: Shows active crops, today's tasks, upcoming tasks, overdue tasks
- **AI Recommendation**: Daily recommendation based on crop stage, weather, soil
- **Scheme Recommendations**: Relevant govt schemes based on farmer profile

### 5.4 Database Models
- `ActiveCrop` — Currently growing crops
- `CropTask` — Daily/weekly tasks for active crops

### 5.5 AI Service
**File**: `backend/src/services/aiFosEngine.ts`
- `getCropLifecycle(cropName, duration, state, district)` — Generates lifecycle stages and tasks
- `generateDailyRecommendation({ cropName, dayAge, stage, moisture, humidity, ... })` — AI recommendation

---

## 6. SOIL MOISTURE

### 6.1 Frontend Service
**File**: `frontend/src/services/soilMoisture.ts`

**Endpoints**:
- `GET /api/soil-moisture` — Get moisture data
- `POST /api/soil-moisture/location` — Update location and fetch fresh data
- `DELETE /api/soil-moisture/cache` — Invalidate cache

### 6.2 Backend Route
**File**: `backend/src/routes/soilMoisture.ts`

### 6.3 Data Sources
1. **Weather API** (primary): Fetches humidity + rainfall from weather service
2. **data.gov.in** (fallback): IMD rainfall dataset

### 6.4 Derivation Algorithm
```typescript
function deriveMoisture(rainfallMm, humidity, state) {
  let base = 20 + (humidity / 100) * 50;  // Base from humidity
  base += Math.min(rainfallMm * 1.2, 30);  // Rainfall boost
  if (isMonsoon) base += 10;
  if (isPostMonsoon) base += 5;
  else base -= 5;
  if (aridStates.includes(state)) base -= 8;
  if (wetStates.includes(state)) base += 8;
  return Math.round(Math.max(5, Math.min(95, base)));
}
```

### 6.5 Database Model
- `SoilMoisture` — Cached moisture data (4-hour TTL)

---

## 7. CROP ADVISORY (AI ASSISTANT)

### 7.1 Integration
The AI Assistant (`/api/ai-assistant/chat`) uses the Pragati AI Controller which routes to:
- `DiseaseAgent` — Disease detection queries
- `CropAgent` — Crop advice queries
- `SoilAgent` — Soil health queries
- `WeatherAgent` — Weather queries
- `MarketAgent` — Market price queries
- `GeneralAgent` — General queries (may use LLM fallback)

### 7.2 Agent Routing
**File**: `backend/src/agents/intentRouter.ts`
**File**: `backend/src/services/pragatiAIController.ts`

---

## 8. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/services/soilHealth.ts` | Soil health frontend |
| `frontend/src/services/soilMoisture.ts` | Soil moisture frontend |
| `frontend/src/services/cropRecommendation.ts` | Crop recommendation frontend |
| `frontend/src/services/myCrops.ts` | My crops frontend |
| `frontend/src/services/fertilizerCalculator.ts` | Fertilizer calculator frontend |
| `frontend/src/services/aiFos.ts` | AI-FOS frontend |
| `backend/src/routes/soil.ts` | Soil backend routes |
| `backend/src/routes/soilMoisture.ts` | Soil moisture backend |
| `backend/src/routes/cropRecommendation.ts` | Crop recommendation backend |
| `backend/src/routes/myCrops.ts` | My crops backend |
| `backend/src/routes/fertilizerCalculator.ts` | Fertilizer backend |
| `backend/src/routes/aiFos.ts` | AI-FOS backend |
| `backend/src/services/soilAIService.ts` | Soil AI analysis |
| `backend/src/services/fertilizerCalculatorService.ts` | Fertilizer calculation |
| `backend/src/services/fertilizerAI.ts` | Fertilizer AI recommendation |
| `backend/src/services/recommendationEngine.ts` | Crop recommendation engine |
| `backend/src/services/similaritySearch.ts` | Similar recommendation search |
| `backend/src/services/aiFosEngine.ts` | AI-FOS engine |
| `backend/src/models/SoilReport.ts` | Soil report model |
| `backend/src/models/SoilStandard.ts` | Soil standard model |
| `backend/src/models/SoilMoisture.ts` | Soil moisture model |
| `backend/src/models/CropKnowledgeBase.ts` | Crop KB model |
| `backend/src/models/FarmerCropRequest.ts` | Crop request model |
| `backend/src/models/MyCrop.ts` | My crop model |
| `backend/src/models/ActiveCrop.ts` | Active crop model |
| `backend/src/models/CropTask.ts` | Crop task model |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
