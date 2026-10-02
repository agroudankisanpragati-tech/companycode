# COMPANYCODE — PRAGATI AI DEEP TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. COMPLETE REQUEST CHAIN

### 1.1 UI Component
**Frontend**: AI Assistant page (`frontend/src/app/ai-assistant/`)
**Context**: `frontend/src/context/AIAssistantContext.tsx`
**Service**: `frontend/src/services/pragatiAI.ts`

### 1.2 Frontend Functions
- `sendTextQuery(text, options)` — `pragatiAI.ts:108`
- `sendVoiceQuery(audioBlob, filename, options)` — `pragatiAI.ts:146`
- `sendImageQuery(imageFile, options)` — `pragatiAI.ts:187`
- `getAIHistory(options)` — `pragatiAI.ts:225`
- `getAIHealth(token)` — `pragatiAI.ts:255`
- `getAIStats(token)` — `pragatiAI.ts:272`
- `endAISession(sessionId, token)` — `pragatiAI.ts:289`

---

## 2. TEXT PIPELINE TRACE

### 2.1 Frontend → Backend
```
POST /api/pragati-ai/text
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
  {
    text: string,
    sessionId?: string,
    language?: string,
    synthesizeAudio?: boolean,
    extra?: Record<string, unknown>
  }
```

### 2.2 Backend Route
**File**: `backend/src/routes/pragatiAI.ts`
**Function**: `router.post('/text', authenticate, aiLimiter, ...)`
**Line**: 302-369

### 2.3 Backend Processing
```typescript
// 1. Build farmer context
const farmerContext = await buildFarmerContext(userId);

// 2. Call AI service
const aiResponse = normalizeAIResponse(await processText({
  text,
  sessionId,
  farmerId: userId,
  farmerName: farmerContext.name,
  language: language || 'hi',
  synthesizeAudio: synthesizeAudio,
  extra,
}));

// 3. Persist conversation (async)
setImmediate(async () => {
  await persistConversation(userId, sid, 'text', aiResponse, farmerContext, { inputText: text });
  await updateFarmerMemory(userId, text, aiResponse.responseText, ...);
});

// 4. Return response
return res.json({
  success: aiResponse.success,
  sessionId: sid,
  pipeline: 'text',
  intent: aiResponse.intent,
  confidence: aiResponse.confidence,
  language: aiResponse.language,
  responseText: aiResponse.responseText,
  suggestions: aiResponse.suggestions || [],
  moduleId: aiResponse.moduleId,
  metrics: aiResponse.metrics,
  error: aiResponse.error,
  timestamp: aiResponse.timestamp || new Date().toISOString(),
});
```

---

## 3. PRAGATI AI SERVICE (Backend)

**File**: `backend/src/services/pragatiAIService.ts`
**Bridge URL**: `process.env.PRAGATI_AI_BRIDGE_URL || 'http://localhost:8001'`
**Timeout**: `process.env.PRAGATI_AI_TIMEOUT_MS || '60000'` (60 seconds)

### 3.1 processText()
**Line**: 146-172
```typescript
const body = {
  text: req.text,
  session_id: req.sessionId,
  farmer_id: req.farmerId || '',
  farmer_name: req.farmerName || '',
  language: req.language || null,
  location: req.location || null,
  synthesize_audio: req.synthesizeAudio ?? false,
  extra: req.extra || null,
};

const res = await axios.post<AIResponse>(
  `${BRIDGE_BASE_URL}/process/text`,
  body,
  { timeout: BRIDGE_TIMEOUT }
);
```

### 3.2 processVoice()
**Line**: 178-214
```typescript
const form = new FormData();
form.append('audio', fs.createReadStream(req.audioPath), { ... });
form.append('session_id', req.sessionId);
form.append('farmer_id', req.farmerId);
form.append('farmer_name', req.farmerName);
form.append('language', req.language);
form.append('synthesize_audio', String(req.synthesizeAudio ?? true));

const res = await axios.post<AIResponse>(
  `${BRIDGE_BASE_URL}/process/voice`,
  form,
  { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT }
);
```

### 3.3 processImage()
**Line**: 220-253
```typescript
const form = new FormData();
form.append('image', fs.createReadStream(req.imagePath), { ... });
form.append('session_id', req.sessionId);
form.append('farmer_id', req.farmerId);
form.append('language', req.language);

const res = await axios.post<AIResponse>(
  `${BRIDGE_BASE_URL}/process/image`,
  form,
  { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT }
);
```

---

## 4. PRAGATI AI BRIDGE (Python)

**File**: `Ai/pragati_ai_controller/fastapi_bridge.py`
**Port**: 8001 (default)
**Endpoints**:
- `POST /process/text` — Text pipeline
- `POST /process/voice` — Voice pipeline (STT → Intent → Router → TTS)
- `POST /process/image` — Image pipeline (YOLO → KB → Response)
- `GET /health` — Health check
- `GET /status` — Module status
- `POST /intent/predict` — Intent classification
- `GET /session/{session_id}/history` — Session history
- `DELETE /session/{session_id}` — End session

### 4.1 Request Schema (Python Bridge)
```json
{
  "text": "string",
  "session_id": "string (optional)",
  "farmer_id": "string",
  "farmer_name": "string",
  "language": "string (optional)",
  "location": {"type": "object"} (optional),
  "synthesize_audio": "boolean",
  "extra": {"type": "object"} (optional),
  "use_cache": "boolean"
}
```

### 4.2 Response Schema (Python Bridge)
```json
{
  "success": "boolean",
  "pipeline": "string",
  "session_id": "string",
  "farmer_id": "string",
  "language": "string",
  "intent": "string",
  "confidence": "number",
  "module_id": "string",
  "response_text": "string",
  "response_audio": "string (path or base64)",
  "status": "string",
  "suggestions": ["string"],
  "data": {"type": "object"} (optional),
  "knowledge": {"type": "object"} (optional),
  "metrics": {
    "total_ms": "number",
    "stt_ms": "number",
    "intent_ms": "number",
    "router_ms": "number",
    "tts_ms": "number",
    "inference_ms": "number",
    "knowledge_ms": "number"
  },
  "error": "string",
  "fallback_reason": "string",
  "timestamp": "string"
}
```

---

## 5. PRAGATI AI CONTROLLER (Root Agent)

**File**: `Ai/pragati_ai_controller/controller.py`
**Pipeline**:
1. Language Engine (normalize + translate input)
2. Intent Engine (TF-IDF + LogReg via Python bridge)
3. Root Router — routeIntent()
4. Memory Engine (persist turn, update preferences)
5. Response Generator

### 5.1 Routing Logic
- `greeting/navigation/voice` → static response (NEVER KB, NEVER LLM)
- `disease/crop/soil/weather/market/government/kvk` → dedicated agent → local composer
- `general` → GeneralAgent → dispatchAgents → composeLocalResponse → [optional LLM]

### 5.2 LLM Fallback Rules
- NEVER called for: greeting, navigation, voice, disease, crop, soil, weather, market, government, kvk
- ONLY optional fallback for: general (and only when local KB returns nothing)
- NEVER called if OPENAI_API_KEY is absent

---

## 6. RESPONSE SCHEMA MISMATCHES

### 6.1 Backend Normalizes Python Response
**File**: `backend/src/routes/pragatiAI.ts:50-69`
```typescript
function normalizeAIResponse(raw: AIResponse): AIResponse {
  return {
    ...raw,
    sessionId: raw.sessionId || raw.session_id || '',
    farmerId: raw.farmerId || raw.farmer_id || '',
    moduleId: raw.moduleId || raw.module_id || '',
    responseText: raw.responseText || raw.response_text || '',
    responseAudio: raw.responseAudio || raw.response_audio || undefined,
    fallbackReason: raw.fallbackReason || raw.fallback_reason || '',
    metrics: raw.metrics ? { ... } : undefined,
  };
}
```

### 6.2 Backend Returns vs Frontend Expects

**Backend returns**:
```json
{
  "success": true,
  "sessionId": "abc123",
  "pipeline": "text",
  "intent": "disease",
  "confidence": 0.95,
  "language": "hi",
  "responseText": "आपके फसल में...",
  "suggestions": ["...", "..."],
  "moduleId": "DiseaseAgent",
  "metrics": { "totalMs": 1234, ... },
  "error": null,
  "timestamp": "2026-08-26T..."
}
```

**Frontend expects** (`PragatiAIResponse` interface):
```typescript
{
  success: boolean,
  sessionId: string,
  pipeline: 'text' | 'voice' | 'image',
  intent?: string,
  confidence?: number,
  language?: string,
  responseText?: string,
  responseAudio?: string,
  imageAnalysis?: { crop?, className?, category?, confidence?, top5? },
  knowledge?: Record<string, unknown> | null,
  suggestions?: string[],
  moduleId?: string,
  metrics?: PragatiAIMetrics,
  error?: string,
  timestamp?: string
}
```

**MISMATCH**: Backend returns `sessionId` (camelCase) and `responseText` (camelCase), which matches frontend expectation. The `normalizeAIResponse` function handles snake_case → camelCase conversion. **No mismatch here.**

---

## 7. "SERVER RETURNED INVALID RESPONSE" ERROR TRACE

### 7.1 Frontend Error Handler
**File**: `frontend/src/services/pragatiAI.ts:131-134`
```typescript
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  return buildErrorResponse('text', (err as any).error || res.statusText);
}
```

### 7.2 Possible Causes
1. **Bridge not running** (port 8001) → Backend gets ECONNREFUSED → returns 503 → frontend shows error
2. **Bridge timeout** (>60s) → Backend gets timeout → returns 500/504
3. **Bridge returns non-JSON** → Backend tries to parse, fails
4. **Bridge returns HTML error page** → `res.json()` throws
5. **Network error** → `fetch` throws → caught by try/catch → `buildErrorResponse`

### 7.3 Backend Error Response
```json
{
  "success": false,
  "pipeline": "text",
  "sessionId": "",
  "farmerId": "",
  "language": "hi",
  "responseText": "AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।",
  "error": "timeout of 60000ms exceeded",
  "metrics": {}
}
```

---

## 8. AI SERVER IDENTIFICATION

| Service | Host | Port | Env Variable | Endpoint |
|---------|------|------|--------------|----------|
| Pragati AI Bridge | localhost | 8001 | `PRAGATI_AI_BRIDGE_URL` | `/process/text`, `/process/voice`, `/process/image` |
| YOLO FastAPI | localhost | 8000 | `YOLO_SERVICE_URL` | `/predict`, `/crops`, `/health` |
| Voice Guide Bridge | localhost | 8002 | `VOICE_GUIDE_BRIDGE_URL` | `/voice-guide/*` |
| OpenAI/OpenRouter | External | 443 | `OPENAI_BASE_URL`, `OPENAI_API_KEY` | `/chat/completions` |

**Note**: OPENAI_API_KEY is used by:
- `openaiService.ts` (crop recommendations)
- `soilAIService.ts` (soil analysis OCR)
- `pragatiAIController.ts` (LLM fallback for general intent)
- `speechTranslationPipeline.ts` (translation when no dictionary hit)

---

## 9. VOICE PIPELINE TRACE

### 9.1 Frontend
```typescript
const form = new FormData();
form.append('audio', audioBlob, filename);
form.append('session_id', sessionId);
form.append('language', language);
form.append('synthesize_audio', String(true));

const res = await fetch(`${API_BASE}/pragati-ai/voice`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

### 9.2 Backend
```typescript
// pragatiAI.ts:375-455
router.post('/voice', authenticate, aiLimiter, uploadAudio.single('audio'), async (req, res) => {
  const aiResponse = normalizeAIResponse(await processVoice({
    audioPath: file.path,
    sessionId,
    farmerId: userId,
    farmerName: farmerContext.name,
    language,
    synthesizeAudio: synthesizeAudio !== 'false',
  }));
  // ...
  return res.json({
    success: aiResponse.success,
    responseText: aiResponse.responseText,
    responseAudio: aiResponse.responseAudio,
    // ...
  });
});
```

### 9.3 Python Bridge
**File**: `Ai/pragati_ai_controller/fastapi_bridge.py:611-680`
```python
@app.post("/process/voice")
async def process_voice(audio, session_id, farmer_id, farmer_name, language, synthesize_audio):
    # Write upload to temp file
    # Call controller.process(Path(tmp_path), session_id, farmer_id, ...)
    # Return JSONResponse(content=result)
```

---

## 10. IMAGE PIPELINE TRACE

### 10.1 Frontend
```typescript
const form = new FormData();
form.append('image', imageFile, imageFile.name);
form.append('session_id', sessionId);
form.append('language', language);

const res = await fetch(`${API_BASE}/pragati-ai/image`, { ... });
```

### 10.2 Backend
**Note**: Pragati AI image pipeline is DIFFERENT from Disease Scan pipeline.
- `/api/pragati-ai/image` → Pragati AI Bridge → YOLO + KB
- `/api/disease/scan` → Direct YOLO + KB (no bridge)

### 10.3 Response
Same as text pipeline but with `imageAnalysis` field:
```json
{
  "success": true,
  "pipeline": "image",
  "imageAnalysis": {
    "crop": "Wheat",
    "className": "Wheat__Rust",
    "category": "disease",
    "confidence": 87.5,
    "top5": [...]
  },
  "knowledge": { ... },
  "responseText": "..."
}
```

---

## 11. SESSION MANAGEMENT

### 11.1 Session ID
- Generated by Python bridge or provided by frontend
- Stored in `AIConversation` collection with `sessionId`
- Used for conversation history and memory

### 11.2 End Session
```typescript
// Frontend
await fetch(`${API_BASE}/pragati-ai/session/${sessionId}`, { method: 'DELETE', headers: authHeaders(token) });

// Backend
router.delete('/session/:sessionId', authenticate, async (req, res) => {
  await endAISession(sessionId);
  return res.json({ success: true, sessionId });
});

// Python bridge
@app.delete("/session/{session_id}")
async def end_session(session_id: str):
    await _ctrl().end_session(session_id)
    return JSONResponse(content={"success": True, "session_id": session_id})
```

---

## 12. HEALTH CHECK

### 12.1 Frontend
```typescript
const res = await fetch(`${API_BASE}/pragati-ai/health`, { headers: authHeaders(token) });
if (!res.ok) return null;
const data = await res.json();
return data.success ? data : null;
```

### 12.2 Backend
```typescript
router.get('/health', authenticate, async (req, res) => {
  const health = await getAIHealth();
  if (!health) return res.status(503).json({ success: false, status: 'unavailable', error: '...' });
  return res.json({ success: true, ...health });
});
```

### 12.3 Python Bridge
```python
@app.get("/health")
async def health():
    result = await _run_in_executor(_ctrl().health_check)
    return JSONResponse(content=result)
```

---

## 13. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/app/ai-assistant/` | AI Assistant UI |
| `frontend/src/context/AIAssistantContext.tsx` | AI Assistant state |
| `frontend/src/services/pragatiAI.ts` | Frontend API service |
| `backend/src/routes/pragatiAI.ts` | Backend route handler |
| `backend/src/services/pragatiAIService.ts` | Backend HTTP client for bridge |
| `backend/src/services/pragatiAIController.ts` | Root agent controller |
| `backend/src/services/intentEngine.ts` | Intent detection |
| `backend/src/services/memoryEngine.ts` | Conversation memory |
| `backend/src/services/speechTranslationPipeline.ts` | Language normalization |
| `Ai/pragati_ai_controller/fastapi_bridge.py` | Python HTTP bridge |
| `Ai/pragati_ai_controller/controller.py` | Root agent controller |
| `Ai/pragati_ai_controller/pipeline.py` | Processing pipeline |
| `Ai/intent_engine/` | Intent classification ML |
| `Ai/knowledge_base/` | Knowledge base services |
| `backend/src/models/AIConversation.ts` | Chat history model |
| `backend/src/models/FarmerMemory.ts` | Memory model |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
