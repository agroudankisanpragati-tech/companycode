/**
 * Pragati AI Service
 *
 * TypeScript service layer that communicates with the Python
 * Pragati AI Bridge (fastapi_bridge.py) running on port 8001.
 *
 * Handles:
 *   - Text requests
 *   - Voice (multipart audio upload)
 *   - Image (multipart image upload)
 *   - Health / status probes
 *   - Session management
 *
 * All failures are non-fatal and return structured error objects.
 * Never throws — callers always receive a typed result.
 */
export interface AITextRequest {
    text: string;
    sessionId?: string;
    farmerId?: string;
    farmerName?: string;
    language?: string;
    location?: Record<string, unknown>;
    synthesizeAudio?: boolean;
    extra?: Record<string, unknown>;
}
export interface AIVoiceRequest {
    audioPath: string;
    sessionId?: string;
    farmerId?: string;
    farmerName?: string;
    language?: string;
    synthesizeAudio?: boolean;
}
export interface AIImageRequest {
    imagePath: string;
    sessionId?: string;
    farmerId?: string;
    language?: string;
}
export interface AIMetrics {
    totalMs?: number;
    sttMs?: number;
    intentMs?: number;
    routerMs?: number;
    ttsMs?: number;
    inferenceMs?: number;
    knowledgeMs?: number;
}
export interface AIResponse {
    success: boolean;
    pipeline: string;
    sessionId: string;
    farmerId: string;
    language: string;
    intent?: string;
    confidence?: number;
    moduleId?: string;
    responseText?: string;
    responseAudio?: string;
    status?: string;
    suggestions?: string[];
    data?: Record<string, unknown> | null;
    knowledge?: Record<string, unknown> | null;
    metrics?: AIMetrics;
    error?: string;
    fallbackReason?: string;
    timestamp?: string;
    session_id?: string;
    farmer_id?: string;
    module_id?: string;
    response_text?: string;
    response_audio?: string;
    fallback_reason?: string;
}
export interface AIHealthResponse {
    status: string;
    version: string;
    modules: Record<string, string>;
    assets: Record<string, boolean>;
    paths: Record<string, string>;
    timestamp: string;
}
export interface AIStatusResponse {
    modules: Record<string, string>;
    startup_report: Record<string, unknown>;
}
/**
 * Send a text message through the Pragati AI text pipeline.
 */
export declare function processText(req: AITextRequest): Promise<AIResponse>;
/**
 * Send an audio file through the Pragati AI voice pipeline.
 * STT → Intent → Router → TTS
 */
export declare function processVoice(req: AIVoiceRequest): Promise<AIResponse>;
/**
 * Send an image file through the Pragati AI image pipeline.
 * Disease AI → Knowledge Base → Response
 */
export declare function processImage(req: AIImageRequest): Promise<AIResponse>;
/**
 * Fetch health status from the Pragati AI Bridge.
 */
export declare function getAIHealth(): Promise<AIHealthResponse | null>;
/**
 * Fetch per-module status and startup validation report.
 */
export declare function getAIStatus(): Promise<AIStatusResponse | null>;
/**
 * Check if the Pragati AI Bridge is reachable.
 */
export declare function isPragatiAIHealthy(): Promise<boolean>;
/**
 * Get conversation history for a session from the bridge.
 */
export declare function getSessionHistory(sessionId: string): Promise<unknown[]>;
/**
 * End a session on the bridge (flushes memory to disk).
 */
export declare function endAISession(sessionId: string): Promise<void>;
//# sourceMappingURL=pragatiAIService.d.ts.map