# COMPANYCODE — DISEASE SCAN / DIGISCAN DEEP TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. COMPLETE REQUEST CHAIN

### 1.1 UI Component → File → Function
**Frontend**: Disease Detection page (`frontend/src/app/disease-detection/`)
**Service**: `frontend/src/services/speechPipeline.ts` (not directly used for scan)
**Actual frontend service**: Not explicitly read, but scan calls backend directly via fetch

### 1.2 Image Selection/Camera
- Frontend uses file input or camera capture
- Image converted to File/FormData
- **Crop selection is MANDATORY** before scanning

### 1.3 Frontend Request
```
POST /api/disease/scan
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data
Body (FormData):
  - image: <File> (image/jpeg, image/png, etc.)
  - cropName: <string> (MANDATORY)
```

### 1.4 Backend Route
**File**: `backend/src/routes/disease.ts`
**Function**: `router.post('/scan', authenticate, upload.single('image'), ...)`
**Line**: 60-242

### 1.5 Middleware
1. `authenticate` — Validates JWT, attaches `req.user`
2. `upload.single('image')` — Multer saves image to `uploads/disease/`
   - Max file size: 10MB
   - Allowed types: image/*

### 1.6 Controller Logic
```typescript
// 1. Validate cropName (MANDATORY)
const cropName = req.body.cropName?.trim();
if (!cropName) return 400 { success: false, error: 'Please select a crop before scanning.' }

// 2. Validate image
if (!req.file) return 400 { success: false, error: 'Image file is required' }

// 3. Call YOLO service
const yoloResult = await runHybridDiseaseDetection(req.file.path, '', cropName);

// 4. Handle YOLO errors
if (yoloResult.error) {
  if (lower.includes('econnrefused')) userError = 'FastAPI AI server is not running...';
  if (lower.includes('timeout')) userError = 'FastAPI AI server timed out...';
}

// 5. Low confidence guard
if (confidence < YOLO_CONFIDENCE_THRESHOLD) return 200 { success: false, lowConfidence: true, ... }

// 6. Knowledge base lookup
const advisory = await getAdvisoryFromKnowledgeBase(prediction.cropName, prediction.diseaseName, prediction.rawAiLabel);

// 7. Persist to database
const saved = await DiseaseRecommendation.create(record);

// 8. Return response
return res.json({ success: true, predictionSource: 'YOLOv8 Classification Model', source: 'yolo', engine: 'yolo', hasAdvisory: !!advisory, data: { ...saved.toObject(), farmerAdvice: saved.extraFarmerAdvice } });
```

---

## 2. YOLO SERVICE DETAILS

### 2.1 YOLO Service Configuration
**File**: `backend/src/services/yoloService.ts`
**URL**: `process.env.YOLO_SERVICE_URL || 'http://localhost:8000'`
**Timeout**: `process.env.YOLO_TIMEOUT_MS || '15000'` (15 seconds)
**Environment Variable**: `YOLO_SERVICE_URL`, `YOLO_TIMEOUT_MS`, `YOLO_PORT`, `YOLO_HOST`

### 2.2 YOLO FastAPI Server
**File**: `Ai/fastapi_server.py`
**Port**: 8000 (default)
**Host**: 0.0.0.0 (default)
**Model**: `weights/best.pt` (YOLOv8 classification model)
**Endpoints**:
- `GET /health` — Health check
- `GET /crops` — List supported crops and classes
- `POST /predict` — Crop-aware prediction

### 2.3 YOLO Request to FastAPI
```typescript
// backend/src/services/yoloService.ts:137
const res = await axios.post<YoloPrediction>(`${YOLO_BASE_URL}/predict`, form, {
  headers: form.getHeaders(),
  timeout: YOLO_TIMEOUT_MS,
});
```

**FormData**:
- `image`: file stream (image/*)
- `crop_hint`: string (crop name selected by user)

### 2.4 YOLO Response Schema
```typescript
{
  success: true,
  status: 'success',
  engine: 'yolo',
  crop: string,           // e.g., "Wheat"
  category: string,       // e.g., "disease", "pest", "healthy"
  class_name: string,     // e.g., "Wheat__Rust"
  confidence: number,     // e.g., 87.5
  crop_filtered: boolean,
  top5: [
    { rank, class_id, class_name, confidence, crop, category }
  ],
  inference_ms: number
}
```

### 2.5 YOLO Prediction Flow (FastAPI)
1. Validates `crop_hint` is not blank
2. Resolves crop hint to YOLO class filter via `_resolve_crop_key()`
3. Saves upload to temp file
4. Runs `_run_crop_filtered_predict()`:
   - Loads YOLOv8 model from `best.pt`
   - Runs inference on image
   - Filters top-5 to only allowed class IDs for selected crop
   - Re-normalizes confidence within crop subset
5. Returns prediction result

---

## 3. DISEASE DETECTION MODEL

### 3.1 Model Details
- **Name**: YOLOv8s-cls (classification)
- **File**: `Ai/weights/yolov8s-cls.pt`
- **Type**: Image classification (not detection)
- **Classes**: Multiple crops × multiple diseases/pests/healthy states
- **Framework**: Ultralytics YOLOv8

### 3.2 Class Naming Convention
Classes follow pattern: `CropName__DiseaseName` or `CropName__PestName` or `CropName__Healthy`
Example: `Wheat__Rust`, `Tomato__Late_Blight`, `Rice__Brown_Spot`

### 3.3 Crop-Filtered Prediction
- User MUST select a crop before scanning
- Backend validates crop is in YOLO training data
- Only classes belonging to selected crop are considered
- Confidences are re-normalized within crop subset

---

## 4. KNOWLEDGE BASE LOOKUP

### 4.1 Source of Truth
**Collection**: `diseasepestsolutions` (DiseasePestSolution model)
**Admin-managed**: Yes — only admins can create/edit entries
**No auto-save**: Auto-save to knowledge base is disabled (no-op)

### 4.2 Lookup Order
1. Exact match on `diseasePestName` (case-insensitive, normalized)
2. Exact match on `aiLabel` (raw YOLO class_name)
3. Aliases array match
4. Fuzzy similarity score >= 0.55 on `diseasePestName`
5. Keyword/tag match

### 4.3 Lookup Function
**File**: `backend/src/services/diseaseService.ts:133`
**Function**: `findDiseaseKnowledge(cropName, diseaseName, rawAiLabel, lang)`

### 4.4 Advisory Fields Returned
- `displayName`, `displayNameHi`
- `symptoms`, `symptomsHi`
- `organicTreatment`, `organicTreatmentHi`
- `chemicalTreatment`, `chemicalTreatmentHi`
- `treatment`
- `prevention`, `preventionHi`
- `description`, `descriptionHi`
- `recommendedActions`, `recommendedActionsHi`
- `urgentPrevention`, `urgentPreventionHi`
- `recoveryTips`, `recoveryTipsHi`
- `dos`, `dosHi`
- `donts`, `dontsHi`
- `recommendedProducts`, `recommendedProductsHi`
- `extraFarmerAdvice`, `extraFarmerAdviceHi`
- `suitableWeather`
- `diseaseImages`
- `tags`

---

## 5. RESPONSE SCHEMA

### 5.1 Success Response (with advisory)
```json
{
  "success": true,
  "predictionSource": "YOLOv8 Classification Model",
  "source": "yolo",
  "engine": "yolo",
  "hasAdvisory": true,
  "data": {
    "userId": "...",
    "cropName": "Wheat",
    "diseaseName": "Rust",
    "diseaseType": "Disease",
    "severityLevel": "medium",
    "confidenceScore": 87.5,
    "predictionSource": "YOLOv8 Classification Model",
    "yoloTop5": [...],
    "imageUrl": "/uploads/disease/...",
    "source": "yolo",
    "knowledgeBaseId": "...",
    "symptoms": { "en": "...", "hi": "..." },
    "organicTreatment": { "en": "...", "hi": "..." },
    "chemicalTreatment": { "en": "...", "hi": "..." },
    "treatment": "...",
    "prevention": { "en": "...", "hi": "..." },
    "description": { "en": "...", "hi": "..." },
    "recommendedActions": { "en": "...", "hi": "..." },
    "urgentPrevention": { "en": "...", "hi": "..." },
    "recoveryTips": { "en": "...", "hi": "..." },
    "dos": { "en": "...", "hi": "..." },
    "donts": { "en": "...", "hi": "..." },
    "recommendedProducts": { "en": "...", "hi": "..." },
    "recommendedFertilizer": "",
    "recommendedBioProduct": "",
    "recommendedOrganicProduct": "",
    "extraFarmerAdvice": { "en": "...", "hi": "..." },
    "suitableWeather": "",
    "tags": [],
    "farmerAdvice": { "en": "...", "hi": "..." }
  }
}
```

### 5.2 Low Confidence Response
```json
{
  "success": false,
  "lowConfidence": true,
  "predictionSource": "YOLOv8 Classification Model",
  "confidence": 25.0,
  "threshold": 30,
  "cropName": "Wheat",
  "error": "Low confidence prediction (25%). Please upload a clearer image...",
  "yoloTop5": [...]
}
```

### 5.3 Error Responses
```json
// Missing crop
{ "success": false, "error": "Please select a crop before scanning." }

// Missing image
{ "success": false, "error": "Image file is required" }

// YOLO service down
{ "success": false, "error": "FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again." }

// YOLO timeout
{ "success": false, "error": "FastAPI AI server timed out. The model may still be loading. Please try again in a moment." }

// No result from YOLO
{ "success": false, "error": "Unable to identify the disease in this image. Please upload a clear leaf image." }
```

---

## 6. DISEASE SCAN FAILURE ROOT CAUSES

### 6.1 CONFIRMED FROM CODE

#### Cause 1: YOLO FastAPI Server Not Running
**File**: `backend/src/services/yoloService.ts:164-166`
**Error**: `ECONNREFUSED` → `FastAPI server not running`
**Root Cause**: `Ai/fastapi_server.py` must be running on port 8000
**Impact**: ALL disease scans fail with "AI service failed"
**Fix Required**: Start Python server: `cd Ai && python fastapi_server.py`

#### Cause 2: YOLO Model Not Loaded
**File**: `Ai/fastapi_server.py:160-167`
**Error**: `best.pt not found at <path>`
**Root Cause**: `weights/best.pt` missing or path incorrect
**Impact**: Health endpoint returns `model_loaded: false`
**Fix Required**: Ensure YOLO model weights exist

#### Cause 3: Crop Not in YOLO Training Data
**File**: `Ai/fastapi_server.py:271-275`
**Error**: `422 { detail: "Crop 'X' not found in YOLO training data." }`
**Root Cause**: Selected crop not in YOLO class list
**Impact**: Scan returns 422 error
**Fix Required**: Use supported crops from `/crops` endpoint

#### Cause 4: Confidence Below Threshold
**File**: `backend/src/services/diseaseService.ts:14-17`
**Default Threshold**: 30%
**Impact**: Returns `success: false, lowConfidence: true`
**Fix Required**: Upload clearer image or adjust `YOLO_CONFIDENCE_THRESHOLD`

#### Cause 5: No Advisory in Knowledge Base
**File**: `backend/src/routes/disease.ts:134-139`
**Impact**: Scan succeeds but `hasAdvisory: false`
**Fix Required**: Admin must add disease to `diseasepestsolutions` collection with `status: 'published'`

#### Cause 6: Frontend Calls Wrong Endpoint
**Potential Issue**: If frontend calls `/api/disease/scan` without `cropName`
**Confirmed**: Backend rejects with 400 if cropName missing

#### Cause 7: Image Upload Issues
**File**: `backend/src/routes/disease.ts:33-40`
- Max size: 10MB
- Allowed: image/* only
- Filename sanitized

### 6.2 POSSIBLE / REQUIRES RUNTIME VERIFICATION

#### Possible 1: Network/Firewall Blocking Port 8000
If Windows Firewall blocks Python from accepting connections on port 8000, frontend will get ECONNREFUSED.

#### Possible 2: YOLO Model Loading Time
First inference may take longer while model loads into GPU/CPU memory.
Timeout is 15 seconds — may need adjustment for slower systems.

#### Possible 3: Memory/GPU Issues
YOLOv8 may require significant RAM/VRAM. If system is low on memory, inference may fail or crash.

---

## 7. "AI SERVICE FAILED" / "AI SERVICE SESSION FAILED" ERROR TRACE

### 7.1 Exact Error Sources

**Error**: "AI service failed"
**Source**: `frontend/src/services/pragatiAI.ts:85-96`
```typescript
function buildErrorResponse(pipeline, error) {
  return {
    success: false,
    sessionId: '',
    pipeline,
    responseText: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।',
    error,
  };
}
```

**Triggered When**:
- `sendTextQuery()` catches error → `buildErrorResponse('text', err.message)`
- `sendVoiceQuery()` catches error → `buildErrorResponse('voice', err.message)`
- `sendImageQuery()` catches error → `buildErrorResponse('image', err.message)`

**Root Causes** (from backend):
1. Pragati AI Bridge (port 8001) not running → `ECONNREFUSED`
2. Bridge timeout (>60s) → `timeout`
3. Bridge returns 500/503
4. Network error between backend and bridge

### 7.2 "Disease analysis service is technically unavailable"

**Source**: Not found in current codebase
**Possible Source**: Old error message from previous implementation
**Current Error**: "FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again."

---

## 8. RESPONSE SCHEMA MISMATCHES (DISEASE SCAN)

### 8.1 Backend Returns vs Frontend Expects

**Backend returns**:
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

**Frontend expects** (from `pragatiAI.ts` image pipeline):
```typescript
{
  success: boolean,
  sessionId: string,
  pipeline: 'text' | 'voice' | 'image',
  intent?: string,
  confidence?: number,
  language?: string,
  responseText?: string,
  imageAnalysis?: { crop?, className?, category?, confidence?, top5? },
  knowledge?: Record<string, unknown> | null,
  suggestions?: string[],
  moduleId?: string,
  metrics?: PragatiAIMetrics,
  error?: string,
  timestamp?: string
}
```

**MISMATCH**: Disease scan (`/api/disease/scan`) returns DIFFERENT schema than Pragati AI image pipeline (`/api/pragati-ai/image`). The frontend may be calling the wrong endpoint for disease detection.

---

## 9. FRONTEND DISEASE SCAN COMPONENT

**Not fully read** — Based on code analysis:
- Frontend has a Disease Detection page at `/disease-detection`
- Uses `upload.single('image')` on backend
- Must send `cropName` in form data
- Backend returns `success`, `data`, `predictionSource`, `hasAdvisory`, `yoloTop5`

---

## 10. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/app/disease-detection/` | Disease scan UI |
| `backend/src/routes/disease.ts` | Disease scan route handler |
| `backend/src/services/diseaseService.ts` | KB lookup, YOLO orchestration |
| `backend/src/services/yoloService.ts` | HTTP client for YOLO FastAPI |
| `Ai/fastapi_server.py` | YOLO inference service |
| `Ai/weights/yolov8s-cls.pt` | YOLOv8 classification model |
| `backend/src/models/DiseasePestSolution.ts` | Knowledge base model |
| `backend/src/models/DiseaseRecommendation.ts` | Scan history model |
| `backend/src/config/database.ts` | MongoDB connection |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
