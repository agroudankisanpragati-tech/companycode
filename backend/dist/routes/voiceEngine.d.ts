/**
 * Voice Engine Routes — Phase 6
 *
 * Unified voice API used by every page in the application.
 * Mounted at /api/voice-engine.
 *
 * Endpoints:
 *   POST /prepare-tts       — pronunciation-correct text before browser TTS
 *   POST /transcribe        — server-side STT (non-browser providers)
 *   GET  /providers         — list available STT/TTS providers
 *   GET  /speech-cache      — list cached speech entries (admin)
 *   DELETE /speech-cache    — clear speech cache (admin)
 *   POST /training/import   — import a new speech dataset
 *   POST /training/validate/:id — validate dataset transcripts
 *   POST /training/approve/:id  — admin approve dataset
 *   POST /training/reject/:id   — admin reject dataset
 *   GET  /training/datasets     — list datasets
 *   GET  /training/approved     — get approved datasets for a language
 *   POST /training/sync-farmer  — sync farmer voice dataset refs
 *
 * All existing routes (language-engine, ai-assistant, etc.) are unchanged.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=voiceEngine.d.ts.map