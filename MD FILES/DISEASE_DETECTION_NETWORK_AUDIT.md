# Disease Detection — Network Dependency Audit Report

Generated: 2025

---

## 1. Every Network Dependency Found

### Frontend

| Location | Call | Target | Blocks Scan? |
|---|---|---|---|
| `frontend/src/app/disease-detection/page.tsx` | `voiceGuide.triggerProcessing()` (BEFORE scan — **removed**) | `/api/voice-guide/play` → `localhost:8002` | ✅ YES — **removed** |
| `frontend/src/app/disease-detection/page.tsx` | `voiceGuide.triggerButton('submit')` (BEFORE scan — **removed**) | `window CustomEvent` → `/api/voice-guide/play` | ✅ YES — **removed** |
| `frontend/src/app/disease-detection/page.tsx` | `voiceGuide.triggerSuccess()` (after scan) | `/api/voice-guide/play` → `localhost:8002` | No — async |
| `frontend/src/app/disease-detection/page.tsx` | `voiceGuide.triggerError()` (after error) | `/api/voice-guide/play` → `localhost:8002` | No — async |
| `frontend/src/app/disease-detection/page.tsx` | `voiceGuide.triggerButton('retry')` in `reset()` | `window CustomEvent` | No — fire-and-forget |
| `frontend/src/hooks/useDisease.ts` | `fetch('/api/disease/scan', ...)` | `localhost:4000` (Node backend) | Required — this IS the scan |
| `frontend/src/hooks/useDisease.ts` | `fetch('/api/disease/history', ...)` | `localhost:4000` | No — history tab only |
| `frontend/src/hooks/useDisease.ts` | `fetch('/api/disease/feedback', ...)` | `localhost:4000` | No — post-result only |
| `frontend/src/hooks/useVoiceGuide.ts` | `guide.openPage(pageKey)` on mount | `/api/voice-guide/page` → `localhost:8002` | Was synchronous — **made fire-and-forget** |
| `frontend/src/context/VoiceGuideContext.tsx` | `checkBridge()` on mount + every 30s | `/api/voice-guide/health` → `localhost:8002` | No — independent of scan |
| `frontend/src/context/VoiceGuideContext.tsx` | `vgApi('POST', '/online', ...)` on browser offline event | `localhost:8002` | No — fire-and-forget |
| `frontend/src/context/VoiceGuideContext.tsx` | `vgApi('POST', '/language', ...)` on lang change | `localhost:8002` | No — unrelated to scan |
| `frontend/src/services/voiceGuide.ts` | All `vgFetch(...)` calls | `/api/voice-guide/*` → `localhost:8002` | No — Voice Guide service layer |

### Backend (Node.js — `localhost:4000`)

| Location | Call | Target | Blocks Scan? |
|---|---|---|---|
| `backend/src/services/yoloService.ts` | `axios.post('/predict', ...)` | `localhost:8000` (FastAPI) | Required — this IS the AI inference |
| `backend/src/services/yoloService.ts` | `axios.get('/crops', ...)` | `localhost:8000` (FastAPI) | No — cached, used for crop hint resolution |
| `backend/src/services/yoloService.ts` | `axios.get('/health', ...)` | `localhost:8000` (FastAPI) | No — admin health check only |
| `backend/src/services/pragatiAIService.ts` | `axios.post('/process/text', ...)` | `localhost:8001` (Pragati AI Bridge) | No — AI assistant, not disease scan |
| `backend/src/services/pragatiAIService.ts` | `axios.get('/health', ...)` | `localhost:8001` | No — admin health check only |
| `backend/src/routes/voiceGuide.ts` | `fetch(BRIDGE_URL + path, ...)` | `localhost:8002` (Voice Guide bridge) | No — Voice Guide proxy only |
| `backend/src/routes/health.ts` | `isYoloServiceHealthy()` | `localhost:8000` | No — admin `/api/health/deep` only |
| `backend/src/routes/health.ts` | `isPragatiAIHealthy()` | `localhost:8001` | No — admin `/api/health/deep` only |
| `backend/src/routes/health.ts` | `fetch(OPENAI_BASE_URL + '/models', ...)` | `https://api.openai.com` | No — admin `/api/health/deep` only |

### Python (FastAPI — `localhost:8000`)

| Location | Call | Target | Blocks Scan? |
|---|---|---|---|
| `Ai/fastapi_server.py` | `_run_crop_filtered_predict(...)` | Local YOLO model (`best.pt`) | Required — fully offline |
| `Ai/fastapi_server.py` | `_verify_crop(...)` via `crop_verifier.py` | Local EfficientNet model | Required — fully offline |
| `Ai/crop_verification_stage.py` | `verify(context.image_path, ...)` | Local EfficientNet model | Required — fully offline |

**No external internet calls exist in the disease detection pipeline.**

---

## 2. Which Ones Are Required

| Dependency | Required? | Reason |
|---|---|---|
| `fetch('/api/disease/scan')` → Node:4000 | ✅ Required | Entry point for disease scan |
| `axios.post('/predict')` → FastAPI:8000 | ✅ Required | YOLO inference engine |
| Local YOLO model (`best.pt`) | ✅ Required | Disease classification |
| Local EfficientNet model (crop verifier) | ✅ Required | Crop verification |
| MongoDB (via Node backend) | ✅ Required | Persist result + KB lookup |
| `axios.get('/crops')` → FastAPI:8000 | ⚠️ Optional | Crop hint resolution — gracefully skipped if YOLO is down |

---

## 3. Which Ones Were Removed

| What | Where | Why Removed |
|---|---|---|
| `voiceGuide.triggerProcessing()` called BEFORE `apiScan()` | `disease-detection/page.tsx` | Fired a network call to Voice Guide bridge BEFORE AI inference started — blocked scan if bridge was slow |
| `voiceGuide.triggerButton('submit')` called BEFORE `apiScan()` | `disease-detection/page.tsx` | Same — dispatched event that triggered `/api/voice-guide/play` before inference |
| Bare `voiceGuide.triggerButton('retry')` in `reset()` | `disease-detection/page.tsx` | Called synchronously without error isolation — could throw if bridge was down |

---

## 4. Which Ones Were Made Optional / Isolated

| What | Where | Change Made |
|---|---|---|
| `voiceGuide.triggerSuccess()` | `disease-detection/page.tsx` | Wrapped in `triggerVoiceGuide()` — fire-and-forget, executes AFTER response, never blocks |
| `voiceGuide.triggerError()` | `disease-detection/page.tsx` | Same — executes AFTER error is set, never blocks |
| `voiceGuide.triggerButton('retry')` | `disease-detection/page.tsx` | Wrapped in `triggerVoiceGuide()` — fire-and-forget |
| `guide.openPage(pageKey)` on mount | `useVoiceGuide.ts` | Changed from bare call to `void guide.openPage(pageKey).catch(() => {})` — fire-and-forget |
| `checkBridge()` | `VoiceGuideContext.tsx` | Added explicit comment: checks Voice Guide bridge ONLY, never affects disease detection |
| `setBridgeOnline(false)` on browser offline event | `VoiceGuideContext.tsx` | Added comment: `navigator.onLine` reflects internet, NOT localhost — disease detection unaffected |

---

## 5. Files Modified

| File | Change |
|---|---|
| `frontend/src/app/disease-detection/page.tsx` | Removed Voice Guide calls before scan; added `triggerVoiceGuide()` helper; all VG calls now fire-and-forget AFTER response |
| `frontend/src/hooks/useVoiceGuide.ts` | `openPage()` on mount is now `void ... .catch(() => {})` — fire-and-forget, never blocks |
| `frontend/src/context/VoiceGuideContext.tsx` | `checkBridge()` and `goOffline` handler annotated to clarify they only affect Voice Guide, never disease detection |

---

## 6. Exact Reason for Each Change

### `disease-detection/page.tsx` — Removed pre-scan Voice Guide calls

**Before:**
```ts
try { voiceGuide.triggerProcessing(); } catch { }
try { voiceGuide.triggerButton('submit'); } catch { }
const data = await apiScan(file, cropEnglish, ...);
```

**Problem:** `triggerProcessing()` calls `guide.play(page, 'processing')` which calls `vgApi('POST', '/play', ...)` — a `fetch` to `/api/voice-guide/play`. This fetch had a 10-second timeout. If the Voice Guide bridge was slow or unresponsive, this call would hang for up to 10 seconds BEFORE `apiScan()` was even called. The `try/catch` only caught thrown errors, not slow responses.

**After:**
```ts
const data = await apiScan(file, cropEnglish, ...);
// Voice Guide executes AFTER response — fire-and-forget, never blocks
triggerVoiceGuide(() => voiceGuide.triggerSuccess());
```

**Result:** Disease scan starts immediately. Voice Guide fires only after the result is ready.

---

### `disease-detection/page.tsx` — `reset()` Voice Guide isolation

**Before:**
```ts
voiceGuide.triggerButton('retry');
```

**Problem:** `triggerButton` dispatches a `CustomEvent` which is caught by `VoiceGuideContext` and calls `play(currentPage, 'retry')` — another network call. If this threw synchronously (e.g., context not mounted), it would crash `reset()`.

**After:**
```ts
triggerVoiceGuide(() => voiceGuide.triggerButton('retry') as unknown as Promise<void>);
```

**Result:** `reset()` always completes. Voice Guide is best-effort.

---

### `useVoiceGuide.ts` — `openPage()` on mount

**Before:**
```ts
guide.openPage(pageKey);
```

**Problem:** `openPage` is `async` and returns a `Promise<void>`. The bare call discards the promise but the function still executes synchronously up to the first `await`, setting `avatarState('loading')` and making a fetch call. React's `useEffect` cleanup would not cancel this. If the bridge was slow, it could interfere with the page render.

**After:**
```ts
void guide.openPage(pageKey).catch(() => {});
```

**Result:** Explicit fire-and-forget. Any error is silently swallowed. Disease Detection page renders and scans without waiting.

---

### `VoiceGuideContext.tsx` — `checkBridge()` and offline handler

**Change:** Added clarifying comments only — no logic change.

**Reason:** The `checkBridge()` function calls `/api/voice-guide/health` which proxies to `localhost:8002`. This is the Voice Guide Python bridge, completely separate from the disease detection stack (`localhost:8000` FastAPI + `localhost:4000` Node). The `goOffline` handler sets `bridgeOnline = false` when `navigator.onLine` fires — but `navigator.onLine` reflects internet connectivity, not localhost. Disease detection uses only localhost services and is unaffected by internet connectivity. Comments added to prevent future confusion.

---

## 7. Disease Pipeline — Confirmed Offline

```
Upload Image
    ↓
POST /api/disease/scan  (localhost:4000 — Node.js backend)
    ↓
Crop Verification  (localhost:8000 — EfficientNet-B0, local model)
    ↓
Disease Detection  (localhost:8000 — YOLOv8, local model best.pt)
    ↓
Knowledge Base     (MongoDB — local database)
    ↓
Pragati AI         (localhost:8001 — optional, for AI assistant context)
    ↓
Response
    ↓ (AFTER response — fire-and-forget)
Voice Guide        (localhost:8002 — optional, skipped if unavailable)
```

**No external internet calls exist anywhere in this pipeline.**

---

## 8. Error Messages — Backend Unavailable

When the backend is unavailable, `useDisease.ts` returns these messages (not "No Internet Connection"):

| Condition | Message |
|---|---|
| Node backend not running (port 4000) | `"Backend server is not running. Please start the Node.js backend (port 4000) and try again."` |
| FastAPI not running (port 8000) | `"FastAPI AI server is not running. Please start the Python FastAPI server (port 8000) and try again."` |
| Request timeout | `"Request timed out. The AI server (FastAPI) may be slow to respond. Please try again."` |
| Crop verification mismatch | Pass-through from server — user-friendly message |

---

## 9. Backward Compatibility

- All Voice Guide functionality is preserved — it still fires after the response
- No Voice Guide API contracts changed
- No backend routes changed
- No Python files changed
- History, feedback, and translation features unchanged
- The `triggerVoiceGuide` helper is local to the disease page — no shared API change
