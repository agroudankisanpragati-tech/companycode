/**
 * Voice Provider Adapter — Phase 6
 *
 * Defines the provider interface so STT/TTS providers can be swapped
 * through configuration only — zero application code changes needed.
 *
 * Current providers:
 *   - 'browser'  : Web Speech API (default, no cost, works offline)
 *   - 'google'   : Google Cloud Speech-to-Text / Text-to-Speech
 *   - 'azure'    : Azure Cognitive Services Speech
 *   - 'local'    : Local/self-hosted model (future — pluggable)
 *
 * Provider is selected via VOICE_STT_PROVIDER / VOICE_TTS_PROVIDER env vars.
 * If a provider is unavailable, falls back to 'browser' gracefully.
 *
 * This adapter is used by the voiceEngine route.
 * Frontend always uses Web Speech API directly (no server round-trip for TTS).
 * This adapter handles server-side STT for streaming/offline scenarios.
 */
export interface STTProvider {
    name: string;
    /** Transcribe audio buffer to text */
    transcribe(audioBuffer: Buffer, langBcp47: string, options?: {
        dialectCode?: string;
    }): Promise<STTResult>;
    /** Check if provider is available/configured */
    isAvailable(): boolean;
}
export interface TTSProvider {
    name: string;
    /** Convert text to speech audio (returns base64 or URL) */
    synthesize(text: string, langBcp47: string, options?: {
        rate?: number;
        pitch?: number;
        dialectCode?: string;
    }): Promise<TTSResult>;
    isAvailable(): boolean;
}
export interface STTResult {
    transcript: string;
    confidence: number;
    langDetected?: string;
    provider: string;
}
export interface TTSResult {
    /** base64-encoded audio or external URL */
    audioData?: string;
    audioUrl?: string;
    mimeType: string;
    provider: string;
    /** Text that was actually spoken (after pronunciation correction) */
    spokenText: string;
}
/**
 * Get the active STT provider from env config.
 * Falls back to 'browser' if configured provider is unavailable.
 */
export declare function getActiveSTTProvider(): STTProvider;
/**
 * Get the active TTS provider from env config.
 * Falls back to 'browser' if configured provider is unavailable.
 */
export declare function getActiveTTSProvider(): TTSProvider;
/**
 * List all registered providers and their availability.
 * Used by admin health check endpoint.
 */
export declare function listProviders(): Array<{
    type: 'stt' | 'tts';
    name: string;
    available: boolean;
}>;
/**
 * Register a custom provider at runtime (for testing or future plugins).
 * Does not change any business logic.
 */
export declare function registerSTTProvider(name: string, provider: STTProvider): void;
export declare function registerTTSProvider(name: string, provider: TTSProvider): void;
//# sourceMappingURL=voiceProviderAdapter.d.ts.map