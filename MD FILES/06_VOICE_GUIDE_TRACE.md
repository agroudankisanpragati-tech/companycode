# COMPANYCODE — VOICE GUIDE AI DEEP TRACE
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. COMPLETE REQUEST CHAIN

### 1.1 UI Component
**Frontend**: `frontend/src/context/VoiceGuideContext.tsx`
**Global Object**: `window.__VOICE_GUIDE__`
**Components**: `HomeVoiceGuide`, VoiceGuideAvatar

### 1.2 Frontend → Backend
```
POST /api/voice-guide/initialize
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
  { page: string, language?: string }
```

### 1.3 Backend Route
**File**: `backend/src/routes/voiceGuide.ts`
**Function**: `router.post('/initialize', ...)`
**Line**: 143-198

---

## 2. VOICE GUIDE BRIDGE (BACKEND → PYTHON)

### 2.1 Bridge Configuration
**File**: `backend/src/routes/voiceGuide.ts:23-26`
```typescript
const BRIDGE_URL = process.env.VOICE_GUIDE_BRIDGE_URL || 'http://localhost:8002';
const BRIDGE_TIMEOUT_COLD = parseInt(process.env.VOICE_GUIDE_BRIDGE_TIMEOUT_COLD_MS || '15000', 10);
const BRIDGE_TIMEOUT_FAST = parseInt(process.env.VOICE_GUIDE_BRIDGE_TIMEOUT_MS || '8000', 10);
```

### 2.2 Bridge Request Helper
**File**: `backend/src/routes/voiceGuide.ts:32-86`
```typescript
async function bridgeRequest(method, path, body?, timeoutMs = BRIDGE_TIMEOUT_FAST) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, status: res.status };
}
```

**Note**: Backend uses native `fetch()` (Node.js 18+ global fetch) to call Python bridge.

---

## 3. VOICE GUIDE PYTHON BRIDGE

**File**: `Ai/voice_guide_ai/api_bridge.py`
**Port**: 8002 (default)
**Host**: 0.0.0.0 (default)

### 3.1 Endpoints
- `POST /voice-guide/session/start` — Start session
- `POST /voice-guide/session/stop` — Stop session
- `POST /voice-guide/initialize` — Initialize with page/language/conditions
- `POST /voice-guide/page` — Open page
- `POST /voice-guide/play` — Play dialogue
- `POST /voice-guide/replay` — Replay dialogue
- `POST /voice-guide/language` — Set language
- `POST /voice-guide/conditions` — Update conditions
- `POST /voice-guide/online` — Set online status
- `GET /voice-guide/status` — Get status
- `GET /voice-guide/dialogue/{page}/{dialogue_type}` — Get dialogue
- `GET /voice-guide/translation/{lang}/{page}` — Get translation
- `GET /voice-guide/avatar/config` — Get avatar config
- `GET /health` — Health check

### 3.2 Architecture
- Uses `RuntimeManager` singleton (pygame + serial worker)
- Background tasks run in `ThreadPoolExecutor` (8 workers)
- Deduplication guards prevent duplicate calls
- Returns immediate ACK with `{"success": true, "queued": true, ...}`

---

## 4. INITIALIZE FLOW

### 4.1 Backend Initialize Handler
```typescript
// voiceGuide.ts:143-198
router.post('/initialize', async (req, res) => {
  const { page = 'home', language } = req.body;
  const conditions = await buildConditions(req.user!.userId);

  // Parallel: session/start + avatar/config
  const [runtimeResult, avatarResult] = await Promise.all([
    bridgeRequest('POST', '/voice-guide/session/start', {}, BRIDGE_TIMEOUT_COLD),
    bridgeRequest('GET', '/voice-guide/avatar/config'),
  ]);

  // Initialize (calls update_conditions + set_language + open_page internally)
  const initResult = await bridgeRequest('POST', '/voice-guide/initialize', { page, language, conditions });

  return res.status(200).json({
    success: true,
    data: {
      runtime: runtimeResult.data,
      avatar: avatarResult.data,
      page: initResult.data,
    },
  });
});
```

### 4.2 Python Bridge Initialize
```python
# api_bridge.py:394-410
@app.post("/voice-guide/initialize")
def initialize(req: InitializeRequest):
    lang = _resolve_alias(req.language)
    page = req.page

    if _init_guard.is_duplicate((page, lang or "")):
        return _queued(page=page, language=lang or "", state="deduped")

    _BG_POOL.submit(_bg_initialize, page, lang, req.conditions)
    return _queued(page=page, language=lang or "", state="scheduled")
```

### 4.3 Background Initialize
```python
def _bg_initialize(page, language, conditions):
    rt = get_runtime()
    if conditions: rt.update_conditions(conditions)
    if language: rt.set_language(language)
    rt.open_page(page, language)  # internally calls play()
```

---

## 5. RESPONSE SCHEMA

### 5.1 Backend Response
```json
{
  "success": true,
  "data": {
    "runtime": { "status": "...", "events": [...] },
    "avatar": { "config": {...} },
    "page": { "success": true, "queued": true, "page": "home", "language": "hi", "state": "scheduled" }
  }
}
```

### 5.2 Python Bridge Response
```json
{
  "success": true,
  "queued": true,
  "page": "home",
  "language": "hi",
  "state": "scheduled"
}
```

---

## 6. "SERVER RETURNED AN INVALID RESPONSE" ERROR TRACE

### 6.1 Frontend Error Handler
**File**: `frontend/src/services/voiceGuide.ts:29`
```typescript
const json = await res.json().catch(() => ({}));
return { success: res.ok, data: json, error: (json as any)?.error };
```

**File**: `frontend/src/context/VoiceGuideContext.tsx:148`
```typescript
const json = await res.json().catch(() => ({}));
return { success: res.ok, data: json, error: (json as any)?.error };
```

### 6.2 Possible Causes
1. **Bridge not running** (port 8002) → Backend gets ECONNREFUSED → returns 503 with JSON error → frontend parses error correctly
2. **Bridge returns non-JSON** → `res.json().catch(() => ({}))` handles this gracefully → returns empty object
3. **Bridge returns HTML** → Same as above, `res.json()` fails, returns `{}`
4. **Network timeout** → AbortSignal.timeout triggers → fetch throws → caught by try/catch

### 6.3 Backend Error Response
**File**: `backend/src/routes/voiceGuide.ts:90-103`
```typescript
function bridgeError(res, result) {
  const payload = { success: false };
  if (IS_DEV) {
    payload.error = data?.error ?? 'Voice Guide unavailable';
    payload.detail = data?.detail ?? null;
    payload.bridge_url = BRIDGE_URL;
  } else {
    payload.error = 'Voice Guide unavailable';
  }
  return res.status(result.status).json(payload);
}
```

### 6.4 Mismatch Analysis
**The "Server returned an invalid response" error is NOT caused by a JSON mismatch in the Voice Guide API.**

The frontend correctly handles:
- JSON responses (parsed normally)
- Non-JSON responses (catch returns `{}`)
- Network errors (try/catch returns `{ success: false, error: 'Voice Guide unavailable' }`)

**Actual causes**:
1. **Bridge not running** → Backend returns 503 → Frontend shows "Voice Guide unavailable"
2. **Bridge slow/cold start** → Timeout after 6-20 seconds → "Voice Guide unavailable"
3. **Bridge crashes** → Returns 500 → "Voice Guide unavailable"
4. **No bridge configured** → `VOICE_GUIDE_BRIDGE_URL` not set → tries localhost:8002 → fails

---

## 7. VOICE GUIDE BRIDGE MANAGER

**File**: `backend/src/services/voiceGuideBridgeManager.ts`

### 7.1 Auto-Start
```typescript
export const bridgeManager = {
  async ensureBridgeRunning(): Promise<void> {
    if (await isBridgeHealthy()) return;  // Already running

    if (bridgeProcess) {
      spawnBridge();  // Spawn if not already
    }

    const healthy = await waitForBridge();  // Poll /health every 1s, max 20s
    if (!healthy) {
      log.warn('Bridge startup failed — Voice Guide routes will return 503 until bridge is available.');
    }
  },
};
```

### 7.2 Spawn Command
```typescript
bridgeProcess = spawn(PYTHON_BIN, [BRIDGE_SCRIPT], {
  cwd: BRIDGE_CWD,  // Ai/voice_guide_ai/
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

### 7.3 Health Check
```typescript
async function isBridgeHealthy(): Promise<boolean> {
  const res = await fetch(`${BRIDGE_URL}${HEALTH_PATH}`, { signal: controller.signal });
  return res.ok;
}
```

---

## 8. FRONTEND VOICE GUIDE CONTEXT

### 8.1 Audio Playback
**File**: `frontend/src/context/VoiceGuideContext.tsx:194-222`
```typescript
const speakText = useCallback((text, lang) => {
  if (!text || isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  utter.rate = 0.9;
  
  window.speechSynthesis.speak(utter);
}, [isMuted]);
```

**Note**: Frontend uses Web Speech API (`speechSynthesis`) for TTS, NOT the backend bridge audio. The bridge provides dialogue text, and the browser speaks it.

### 8.2 Audio Unlock
```typescript
// Unlock on first user interaction
const unlock = () => {
  audioUnlockedRef.current = true;
  if (pendingPlayRef.current) speakText(pendingPlayRef.current, langCode);
};
window.addEventListener('click', unlock);
window.addEventListener('touchstart', unlock);
window.addEventListener('keydown', unlock);
```

### 8.3 Bridge Health Check
```typescript
const checkBridge = useCallback(async () => {
  const res = await vgApi('GET', '/health');
  setBridgeOnline(res.success);
  if (!res.success) {
    console.warn('[VoiceGuide] bridge unavailable:', res.error);
  }
}, []);
```

Polls every 30 seconds.

---

## 9. VOICE GUIDE ERROR MESSAGES

| Error Message | Source | Cause |
|---------------|--------|-------|
| "Voice Guide unavailable" | `voiceGuide.ts:151` | Network error, bridge down, timeout |
| "Bridge unavailable" | `voiceGuideBridgeManager.ts` | Bridge process not running |
| "Voice Guide bridge is not running" | `voiceGuide.ts:73` | ECONNREFUSED to port 8002 |
| "Voice Guide bridge timeout after Xms" | `voiceGuide.ts:64` | Request timeout |

---

## 10. FILES REFERENCE

| File | Purpose |
|------|---------|
| `frontend/src/context/VoiceGuideContext.tsx` | Frontend voice guide state |
| `frontend/src/components/HomeVoiceGuide.tsx` | Home page voice guide |
| `frontend/src/services/voiceGuide.ts` | Frontend API service |
| `backend/src/routes/voiceGuide.ts` | Backend route handler |
| `backend/src/services/voiceGuideBridgeManager.ts` | Auto-spawn bridge |
| `Ai/voice_guide_ai/api_bridge.py` | Python HTTP bridge |
| `Ai/voice_guide_ai/runtime/` | Runtime manager (pygame) |
| `Ai/voice_guide_ai/core/` | Dialogue engine |
| `Ai/voice_guide_ai/avatar/` | Avatar configuration |

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
