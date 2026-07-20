# Phase 6 — Enterprise Voice AI Platform

## Architecture

```
User
 → VoiceButton / VoiceInput (any page)
 → useVoiceEngineContext (singleton — loaded once in layout.tsx)
 → useVoiceEngine
     → useVoiceAI (Web Speech API — STT + TTS)
     → useSpeechPipeline
         → speechPipeline.ts (frontend service)
             → /api/language-engine/pipeline (backend)
                 → speechTranslationPipeline.ts
                 → languageDictionaryService.ts
     → useOfflineSpeechCache (localStorage, 7-day TTL)
     → /api/voice-engine/prepare-tts (pronunciation correction)
         → pronunciationEngine.ts
         → SpeechCacheEntry (MongoDB, 7-day TTL)
```

## Voice Rules

| App Language | Display Text | TTS Speaks |
|---|---|---|
| English (`en`) | English | English |
| Any other | Hindi | Selected language/dialect |

## Supported Modes

- **Push-to-talk** — hold button → speak → release → process
- **Continuous** — auto-restart STT after each AI response
- **Interrupt** — stop TTS mid-sentence
- **Replay** — replay last spoken text
- **Streaming** — speak AI response chunks as they arrive

## Using Voice on Any Page

```tsx
// Option 1: VoiceButton component (recommended)
import VoiceButton from '@/components/VoiceButton';

<VoiceButton onResult={r => console.log(r.englishForBackend)} />
<VoiceButton mode="speak" speakText="Your crop has leaf blight" />
<VoiceButton mode="push-to-talk" onResult={handleResult} />
<VoiceButton mode="continuous" onResult={handleResult} />

// Option 2: useVoiceEngineContext hook
import { useVoiceEngineContext } from '@/components/VoiceEngineProvider';

const voice = useVoiceEngineContext();
voice.speak('Leaf Blight detected', 'पत्ती झुलसा रोग पाया गया');
voice.startListening(result => sendToAI(result.englishForBackend));
```

## Swapping STT/TTS Provider (Zero Code Change)

Set environment variables in `backend/.env`:

```env
# STT provider: browser | google | azure | local
VOICE_STT_PROVIDER=browser

# TTS provider: browser | google | azure | local
VOICE_TTS_PROVIDER=browser

# For local self-hosted model (Whisper, Vosk, etc.)
LOCAL_STT_ENDPOINT=http://localhost:8080
LOCAL_TTS_ENDPOINT=http://localhost:8081

# For Google Cloud Speech
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# For Azure Cognitive Services
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=eastus
```

No application code changes needed. The `voiceProviderAdapter.ts` handles all routing.

## Training Pipeline

### Import a dataset
```bash
POST /api/voice-engine/training/import
{
  "name": "rajasthan-crops-v1",
  "langCode": "mwr",
  "transcripts": [
    { "audioFileRef": "audio/001.wav", "transcript": "उड़द दाल" }
  ]
}
```

### Validate transcripts
```bash
POST /api/voice-engine/training/validate/:id
```

### Admin approve
```bash
POST /api/voice-engine/training/approve/:id
```

### Get approved datasets (for external training pipeline)
```bash
GET /api/voice-engine/training/approved?langCode=mwr
```

Datasets are versioned (semver). Training is **never triggered automatically** — admin must approve first.

## Offline Design

- `useOfflineSpeechCache` caches TTS text in localStorage (7-day TTL, max 200 entries)
- `SpeechCacheEntry` (MongoDB) caches pronunciation-corrected text server-side
- Local speech models plug in via `LOCAL_STT_ENDPOINT` / `LOCAL_TTS_ENDPOINT`
- All voice operations have graceful fallback — never break a page

## Adding a New Language

1. Add entry to `frontend/src/i18n/languages.ts`
2. Add BCP-47 mapping to `backend/src/services/voiceEngineHelpers.ts`
3. Add dialect field to `LanguageDictionary` model (if needed)
4. Seed dictionary entries via admin panel

**Zero changes** to voice hooks, components, or business logic.

## Security

- Raw audio is **never stored** unless explicitly enabled
- Only text metadata and approved training datasets are stored
- `SpeechCacheEntry` stores only text + pronunciation hints (no audio)
- Training datasets store only transcript text + external file references
