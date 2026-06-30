# Agrodan Kisan Pragati — AI Ecosystem Bilingual Upgrade

## Overview

Complete upgrade of the AI ecosystem to support:
- Bilingual responses (Hindi + English) across all AI modules
- Voice Input (`VoiceInput` component)
- Voice Output (`VoicePlayer` component)
- Language switching with persistence
- Production-grade error handling
- Accessibility (ARIA, keyboard nav, screen readers)

---

## Architecture

### Global Language System

**File:** `frontend/src/context/LanguageContext.tsx`

Extended with:
- `aiDisplayMode: 'en' | 'hi' | 'both'` — controls how AI responses are displayed
- `setAiDisplayMode()` — toggle display mode
- Auto-syncs mode when language changes (hi→'hi', en→'en', others→'both')

**Storage priority:**
1. MongoDB `UserSettings.appLanguage` (server, requires auth)
2. `localStorage['kp_language']` (fallback)
3. Default: `'en'`

---

### Bilingual Response Contract

All AI modules return:

```json
{
  "english": "Response in English",
  "hindi": "हिंदी में उत्तर",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "source": "AI"
}
```

---

## New Components

### `VoicePlayer`
**File:** `frontend/src/components/VoicePlayer.tsx`

```tsx
<VoicePlayer
  text="Rice is recommended."
  lang="en-IN"           // or "hi-IN"
  autoDetect={true}      // auto-detect language from text
  label="Listen"
  className=""
/>
```

Features:
- Play / Pause / Resume / Stop controls
- Auto language detection from Unicode ranges
- Hindi fallback: uses closest available Indian voice
- Cleans markdown before speaking
- ARIA labels on all controls

### `VoiceInput`
**File:** `frontend/src/components/VoiceInput.tsx`

```tsx
<VoiceInput
  lang="hi-IN"           // or "en-US"
  disabled={false}
  onTranscript={(text) => console.log(text)}
/>
```

Features:
- Real-time interim transcript display
- Auto-timeout after 15 seconds
- Full error handling: denied, no-speech, network, unsupported
- Bilingual error messages
- ARIA labels, keyboard accessible

### `AILangToggle`
**File:** `frontend/src/components/AILangToggle.tsx`

Quick toggle for AI display mode: EN | हिं | EN+हिं

### `BilingualCard`
**File:** `frontend/src/components/BilingualCard.tsx`

Reusable card for displaying bilingual AI content with integrated TTS.

### `AIErrorBoundary`
**File:** `frontend/src/components/AIErrorBoundary.tsx`

React error boundary with bilingual fallback UI.

---

## AI Copilot Updates

**File:** `frontend/src/components/AIAssistantWidget.tsx`

New features:
- Language display toggle (EN / HI / EN+HI) in header
- Voice input language toggle (🎤 HI / EN)
- `VoicePlayer` per message bubble for TTS
- Bilingual error messages on failure
- ARIA roles: `dialog`, `log`, `list`

**Backend:** `backend/src/routes/aiAssistant.ts`
- System prompt now requests JSON `{ english, hindi, timestamp, source }`
- Parses bilingual JSON or falls back gracefully
- Returns `{ reply, bilingual }` — `reply` is always English for backwards compat

---

## Disease Detection Updates

**Backend:** `backend/src/services/diseaseService.ts`
- AI prompt now requests Hindi fields: `diseaseNameHindi`, `symptomsHindi`, `organicTreatmentHindi`, `chemicalTreatmentHindi`, `preventionHindi`, `recommendedActionsHindi`, `descriptionHindi`

**Frontend:** `frontend/src/app/disease-detection/page.tsx`
- All result sections show English + Hindi
- "Speak Result" TTS button on main result
- "सुनें Prevention" TTS on prevention section

---

## Crop Recommendation Updates

**Backend:** `backend/src/services/openaiService.ts`
- Prompt requests bilingual fields: `cropNameHindi`, `whySuitableHindi`, `estimatedYieldHindi`, `marketDemandHindi`, `risksHindi`, `cultivationGuideHindi`, `bestSowingTime`, `bestSowingTimeHindi`

**Frontend:** `frontend/src/components/crop/CropCard.tsx`
- Displays Hindi names and descriptions
- "Listen (EN)" + "सुनें (HI)" TTS buttons
- Shows best sowing time in both languages

---

## Soil Health Updates

**Backend:** `backend/src/services/soilAIService.ts`
- `extractAndAnalyzeSoilWithAI` returns `aiAnalysisHindi`
- `generateAIAnalysisFromData` returns `aiAnalysisHindi`

**Frontend:** `frontend/src/app/dashboard/farmer/soil-health/page.tsx`
- AI Analysis section shows English + Hindi
- "Listen Report" + "सुनें" TTS buttons on analysis

---

## Error Handling

**File:** `backend/src/middleware/errorHandler.ts`

All errors return:
```json
{ "error": "English message", "hindi": "हिंदी संदेश" }
```

Covered:
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 408 Timeout
- 413 File Too Large
- 422 Unprocessable
- 429 Rate Limited
- 500 Server Error
- 502 AI Provider Error
- 503 DB/Service Error
- MongoDB errors (NetworkError, TimeoutError, ValidationError, DuplicateKey)
- JWT errors (JsonWebTokenError, TokenExpiredError)
- Multer errors (LIMIT_FILE_SIZE)

**Request timeout:** 30 seconds (via `requestTimeout` middleware)

---

## Accessibility

- All interactive elements have `aria-label`
- Voice buttons have `aria-pressed` state
- Chat panel: `role="dialog"`, messages: `role="log"` with `aria-live="polite"`
- Quick prompts: `role="list"` + `role="listitem"`
- Error messages: `role="alert"`
- Interim transcript: `aria-live="polite"`
- `focus:ring` on all buttons for keyboard nav
- `disabled:opacity-40` for clear disabled state

---

## Tests

**File:** `frontend/src/src/__tests__/aiEcosystem.test.ts`

Test coverage:
1. Language Context (localStorage, server persistence, aiDisplayMode)
2. AI Copilot (bilingual response, errors, dashboard context)
3. Crop Recommendation (bilingual fields, validation)
4. Disease Detection (bilingual fields, scan, history)
5. Soil Health (bilingual analysis, upload, history)
6. Voice Input (API availability, lang detection, start/stop)
7. Voice Output (TTS controls, voice selection, markdown cleaning)
8. Error Handling (network, 500/502/429/401/413, bilingual structure)
9. Bilingual Response Contract (structure validation)

**Run tests:**
```bash
cd frontend
npm install
npm test
```

---

## Performance Optimizations

- `VoicePlayer` and `VoiceInput` lazy loaded with `dynamic()`/`lazy()`
- Translation files loaded on-demand and cached in `Map`
- `Suspense` wraps all voice components (no blocking)
- `useCallback` on all handlers to prevent re-renders

---

## File Summary

### New Files Created
| File | Purpose |
|------|---------|
| `frontend/src/components/VoicePlayer.tsx` | Reusable TTS player |
| `frontend/src/components/VoiceInput.tsx` | Reusable voice input |
| `frontend/src/components/AILangToggle.tsx` | EN/HI/EN+HI toggle |
| `frontend/src/components/BilingualCard.tsx` | Bilingual content display |
| `frontend/src/components/AIErrorBoundary.tsx` | React error boundary |
| `backend/src/middleware/errorHandler.ts` | Bilingual error middleware |
| `frontend/src/src/__tests__/aiEcosystem.test.ts` | Full test suite |
| `frontend/src/src/__tests__/setup.ts` | Jest browser API mocks |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/context/LanguageContext.tsx` | Added `aiDisplayMode` |
| `frontend/src/components/AIAssistantWidget.tsx` | Full bilingual + voice rewrite |
| `frontend/src/components/crop/CropCard.tsx` | Bilingual fields + TTS |
| `frontend/src/app/disease-detection/page.tsx` | Bilingual results + TTS |
| `frontend/src/app/dashboard/farmer/soil-health/page.tsx` | Bilingual AI analysis + TTS |
| `frontend/src/services/cropRecommendation.ts` | Extended RecommendationItem type |
| `backend/src/routes/aiAssistant.ts` | Bilingual JSON response |
| `backend/src/services/openaiService.ts` | Hindi fields in crop prompt |
| `backend/src/services/diseaseService.ts` | Hindi fields in disease prompt |
| `backend/src/services/soilAIService.ts` | `aiAnalysisHindi` field |
| `backend/src/services/recommendationEngine.ts` | Extended IRecommendationItem |
| `backend/src/index.ts` | bilingualErrorHandler + requestTimeout |
| `frontend/package.json` | Added Jest dependencies |
