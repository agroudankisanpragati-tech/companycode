# COMPANYCODE — ANDROID COMPATIBILITY AUDIT
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. CRITICAL ANDROID ISSUES

### 1.1 Hardcoded localhost URLs

**File**: `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

**Issue**: In Android WebView or when running on a physical device, `localhost:4000` refers to the device itself, not the development machine. The backend at `localhost:4000` is unreachable.

**Impact**: ALL API calls fail in Android WebView.

**Fix Required**: Use machine's LAN IP (e.g., `http://192.168.1.100:4000/api`) or configure Capacitor proxy.

### 1.2 Next.js Static Export Behavior

**Issue**: If the app is built with `next build && next export` (static HTML), all `/api/*` routes become static files. There is no backend server to handle API requests.

**Impact**: API calls return 404 or HTML pages instead of JSON.

**Fix Required**: Use `next start` (SSR) or configure Capacitor to proxy API calls to backend.

### 1.3 CORS Configuration

**File**: `backend/src/index.ts:65-98`
```typescript
const allowedOrigins = buildAllowedOrigins();
// Includes: http://localhost:3000, http://localhost:3001, FRONTEND_URL, ADMIN_URL
```

**Issue**: If Android WebView loads from `file://` or `http://localhost:8080`, the Origin header will not match allowed origins. CORS will block requests.

**Impact**: All authenticated API requests fail with CORS error.

**Fix Required**: Add Android WebView origin to CORS allowed list, or disable CORS check for specific patterns.

---

## 2. WEBVIEW LIMITATIONS

### 2.1 Microphone Access
**File**: `frontend/src/context/VoiceGuideContext.tsx`
**Issue**: Voice Guide uses Web Speech API (`speechSynthesis`) which works in WebView, but microphone access for voice input requires:
1. Android permission `RECORD_AUDIO` in `AndroidManifest.xml`
2. Runtime permission request in WebView
3. HTTPS (except for localhost)

**Impact**: Voice input fails without proper permissions.

### 2.2 Camera Access
**Issue**: Disease Scan requires camera/file upload. In WebView:
1. File input may not work properly
2. Camera intent must be handled by native Android code
3. Permissions required: `CAMERA`, `READ_EXTERNAL_STORAGE`

**Impact**: Disease scan image upload may fail.

### 2.3 File Upload
**Issue**: `<input type="file">` in WebView has limited support. Camera capture and file selection may not work as expected.

**Impact**: Avatar upload, soil report upload, disease scan upload may fail.

### 2.4 Blob/audio Playback
**Issue**: Pragati AI voice pipeline may return audio blobs. WebView has limited Blob/audio playback support.

**Impact**: Voice responses may not play.

### 2.5 localStorage
**Issue**: WebView's `localStorage` may be cleared when app is killed. Data persistence is unreliable.

**Impact**: User session lost on app restart.

### 2.6 Authorization Headers
**Issue**: WebView may not send `Authorization` headers correctly, especially with CORS restrictions.

**Impact**: Authenticated requests fail.

---

## 3. CAPACITOR NETWORKING

### 3.1 Cleartext HTTP
**Issue**: Android 9+ (API 28) blocks cleartext HTTP by default. If backend uses `http://` (not `https://`), WebView requests are blocked.

**Fix Required**: 
- Use HTTPS for all communications
- Or add `android:usesCleartextTraffic="true"` to `AndroidManifest.xml`

### 3.2 Capacitor HTTP Plugin
**Issue**: Standard `fetch()` in WebView uses the system WebView, which has CORS and cleartext restrictions.

**Fix Required**: Use Capacitor HTTP plugin (`@capacitor-community/http`) which bypasses CORS and supports cleartext.

### 3.3 Environment Variables
**Issue**: `NEXT_PUBLIC_API_URL` is baked into the static build at build time. Cannot be changed at runtime.

**Fix Required**: Use Capacitor's native configuration or runtime configuration.

---

## 4. ANDROID-SPECIFIC CODE ISSUES

### 4.1 SpeechSynthesis
**File**: `frontend/src/context/VoiceGuideContext.tsx:195`
```typescript
if (!('speechSynthesis' in window)) return;
```

**Issue**: `speechSynthesis` may not be available or may behave differently in Android WebView.

### 4.2 AbortSignal.timeout
**File**: `frontend/src/context/VoiceGuideContext.tsx:145`
```typescript
signal: AbortSignal.timeout(timeoutMs),
```

**Issue**: `AbortSignal.timeout()` is a modern API not supported in older Android WebViews.

### 4.3 MediaRecorder
**Issue**: Voice Guide does not use MediaRecorder (uses file upload instead), but if it did, Android WebView has limited MediaRecorder support.

### 4.4 getUserMedia
**Issue**: Camera access via `getUserMedia` is not used in current code, but if added, requires:
1. HTTPS
2. Android permissions
3. WebView settings (`setMediaPlaybackRequiresUserGesture`, etc.)

---

## 5. FRONTEND URL ASSUMPTIONS

### 5.1 Absolute vs Relative URLs

| Service | URL Type | Issue in Android |
|---------|----------|------------------|
| `weather.ts` | Relative (`/api/weather?...`) | OK if proxied |
| `pragatiAI.ts` | Relative (`/api/pragati-ai/...`) | OK if proxied |
| `voiceGuide.ts` | Relative (`/api/voice-guide...`) | OK if proxied |
| `farmerProfile.ts` | Relative (`/api/farmer-profile`) | OK if proxied |
| `backend.ts` | Absolute (`http://localhost:4000/api`) | **FAILS** |
| `frontend/.env.local` | Absolute (`http://localhost:4000/api`) | **FAILS** |

### 5.2 API_BASE Usage
**File**: `frontend/src/lib/backend.ts`
```typescript
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
```

**Issue**: `API_BASE` is only used in `fetchStateSchemes()`. Most services use relative URLs.

---

## 6. RECOMMENDATIONS

1. **Use Capacitor HTTP plugin**: Bypass CORS and cleartext restrictions
2. **Configure CORS for Android**: Add WebView origins to allowed list
3. **Use machine IP instead of localhost**: Configure `NEXT_PUBLIC_API_URL` to use LAN IP
4. **Enable cleartext traffic**: Add `android:usesCleartextTraffic="true"` if using HTTP
5. **Add Android permissions**: `INTERNET`, `CAMERA`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`
6. **Handle WebView lifecycle**: Save/restore session properly
7. **Use HTTPS in production**: Required for microphone/camera access
8. **Runtime configuration**: Allow API URL to be configured at runtime, not just build time

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
