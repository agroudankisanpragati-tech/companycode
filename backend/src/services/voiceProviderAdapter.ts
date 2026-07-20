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

// ─── Provider interface ───────────────────────────────────────────────────────

export interface STTProvider {
  name: string;
  /** Transcribe audio buffer to text */
  transcribe(
    audioBuffer: Buffer,
    langBcp47: string,
    options?: { dialectCode?: string }
  ): Promise<STTResult>;
  /** Check if provider is available/configured */
  isAvailable(): boolean;
}

export interface TTSProvider {
  name: string;
  /** Convert text to speech audio (returns base64 or URL) */
  synthesize(
    text: string,
    langBcp47: string,
    options?: { rate?: number; pitch?: number; dialectCode?: string }
  ): Promise<TTSResult>;
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

// ─── Browser provider (default — delegates to frontend Web Speech API) ────────
// Server-side browser provider is a no-op stub.
// Actual Web Speech API runs in the browser via useVoiceAI hook.

class BrowserSTTProvider implements STTProvider {
  name = 'browser';
  isAvailable() { return true; }
  async transcribe(_buf: Buffer, _lang: string): Promise<STTResult> {
    // Browser STT runs client-side — this stub is for interface compliance
    return { transcript: '', confidence: 0, provider: 'browser' };
  }
}

class BrowserTTSProvider implements TTSProvider {
  name = 'browser';
  isAvailable() { return true; }
  async synthesize(text: string, langBcp47: string): Promise<TTSResult> {
    // Browser TTS runs client-side — server returns text for client to speak
    return { mimeType: 'text/plain', provider: 'browser', spokenText: text, audioUrl: undefined };
  }
}

// ─── Google provider stub (pluggable — configure via env vars) ────────────────

class GoogleSTTProvider implements STTProvider {
  name = 'google';
  isAvailable() {
    return !!(process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  async transcribe(audioBuffer: Buffer, langBcp47: string): Promise<STTResult> {
    if (!this.isAvailable()) throw new Error('Google STT not configured');
    // Plug in @google-cloud/speech here when credentials are provided
    // import { SpeechClient } from '@google-cloud/speech';
    // const client = new SpeechClient();
    // ... (implementation added when credentials are configured)
    throw new Error('Google STT: install @google-cloud/speech and configure credentials');
  }
}

class GoogleTTSProvider implements TTSProvider {
  name = 'google';
  isAvailable() {
    return !!(process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  async synthesize(text: string, langBcp47: string): Promise<TTSResult> {
    if (!this.isAvailable()) throw new Error('Google TTS not configured');
    throw new Error('Google TTS: install @google-cloud/text-to-speech and configure credentials');
  }
}

// ─── Azure provider stub ──────────────────────────────────────────────────────

class AzureSTTProvider implements STTProvider {
  name = 'azure';
  isAvailable() { return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION); }
  async transcribe(audioBuffer: Buffer, langBcp47: string): Promise<STTResult> {
    if (!this.isAvailable()) throw new Error('Azure STT not configured');
    throw new Error('Azure STT: install microsoft-cognitiveservices-speech-sdk and configure credentials');
  }
}

class AzureTTSProvider implements TTSProvider {
  name = 'azure';
  isAvailable() { return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION); }
  async synthesize(text: string, langBcp47: string): Promise<TTSResult> {
    if (!this.isAvailable()) throw new Error('Azure TTS not configured');
    throw new Error('Azure TTS: install microsoft-cognitiveservices-speech-sdk and configure credentials');
  }
}

// ─── Local model stub (future self-hosted) ────────────────────────────────────

class LocalSTTProvider implements STTProvider {
  name = 'local';
  isAvailable() { return !!(process.env.LOCAL_STT_ENDPOINT); }
  async transcribe(audioBuffer: Buffer, langBcp47: string): Promise<STTResult> {
    if (!this.isAvailable()) throw new Error('Local STT endpoint not configured');
    const endpoint = process.env.LOCAL_STT_ENDPOINT!;
    // POST audio to local model endpoint (Whisper, Vosk, etc.)
    const res = await fetch(`${endpoint}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Lang': langBcp47 },
      body: audioBuffer,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Local STT error: ${res.statusText}`);
    const data = await res.json() as any;
    return { transcript: data.transcript || '', confidence: data.confidence || 0.8, provider: 'local' };
  }
}

class LocalTTSProvider implements TTSProvider {
  name = 'local';
  isAvailable() { return !!(process.env.LOCAL_TTS_ENDPOINT); }
  async synthesize(text: string, langBcp47: string, options?: any): Promise<TTSResult> {
    if (!this.isAvailable()) throw new Error('Local TTS endpoint not configured');
    const endpoint = process.env.LOCAL_TTS_ENDPOINT!;
    const res = await fetch(`${endpoint}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langBcp47, rate: options?.rate || 0.9 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Local TTS error: ${res.statusText}`);
    const data = await res.json() as any;
    return { audioData: data.audioBase64, mimeType: data.mimeType || 'audio/wav', provider: 'local', spokenText: text };
  }
}

// ─── Provider registry ────────────────────────────────────────────────────────

const STT_PROVIDERS: Record<string, STTProvider> = {
  browser: new BrowserSTTProvider(),
  google:  new GoogleSTTProvider(),
  azure:   new AzureSTTProvider(),
  local:   new LocalSTTProvider(),
};

const TTS_PROVIDERS: Record<string, TTSProvider> = {
  browser: new BrowserTTSProvider(),
  google:  new GoogleTTSProvider(),
  azure:   new AzureTTSProvider(),
  local:   new LocalTTSProvider(),
};

// ─── Active provider resolution ───────────────────────────────────────────────

/**
 * Get the active STT provider from env config.
 * Falls back to 'browser' if configured provider is unavailable.
 */
export function getActiveSTTProvider(): STTProvider {
  const name = (process.env.VOICE_STT_PROVIDER || 'browser').toLowerCase();
  const provider = STT_PROVIDERS[name];
  if (provider?.isAvailable()) return provider;
  console.warn(`[VoiceProvider] STT provider '${name}' unavailable, falling back to browser`);
  return STT_PROVIDERS.browser;
}

/**
 * Get the active TTS provider from env config.
 * Falls back to 'browser' if configured provider is unavailable.
 */
export function getActiveTTSProvider(): TTSProvider {
  const name = (process.env.VOICE_TTS_PROVIDER || 'browser').toLowerCase();
  const provider = TTS_PROVIDERS[name];
  if (provider?.isAvailable()) return provider;
  console.warn(`[VoiceProvider] TTS provider '${name}' unavailable, falling back to browser`);
  return TTS_PROVIDERS.browser;
}

/**
 * List all registered providers and their availability.
 * Used by admin health check endpoint.
 */
export function listProviders(): Array<{ type: 'stt' | 'tts'; name: string; available: boolean }> {
  return [
    ...Object.values(STT_PROVIDERS).map(p => ({ type: 'stt' as const, name: p.name, available: p.isAvailable() })),
    ...Object.values(TTS_PROVIDERS).map(p => ({ type: 'tts' as const, name: p.name, available: p.isAvailable() })),
  ];
}

/**
 * Register a custom provider at runtime (for testing or future plugins).
 * Does not change any business logic.
 */
export function registerSTTProvider(name: string, provider: STTProvider): void {
  STT_PROVIDERS[name] = provider;
}

export function registerTTSProvider(name: string, provider: TTSProvider): void {
  TTS_PROVIDERS[name] = provider;
}
