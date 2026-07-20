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

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios, { AxiosError } from 'axios';
import { createLogger } from '../utils/logger';

const log = createLogger('pragatiAIService');

const BRIDGE_BASE_URL  = process.env.PRAGATI_AI_BRIDGE_URL || 'http://localhost:8001';
const BRIDGE_TIMEOUT   = parseInt(process.env.PRAGATI_AI_TIMEOUT_MS || '60000', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AITextRequest {
  text:             string;
  sessionId?:       string;
  farmerId?:        string;
  farmerName?:      string;
  language?:        string;
  location?:        Record<string, unknown>;
  synthesizeAudio?: boolean;
  extra?:           Record<string, unknown>;
}

export interface AIVoiceRequest {
  audioPath:        string;
  sessionId?:       string;
  farmerId?:        string;
  farmerName?:      string;
  language?:        string;
  synthesizeAudio?: boolean;
}

export interface AIImageRequest {
  imagePath:  string;
  sessionId?: string;
  farmerId?:  string;
  language?:  string;
}

export interface AIMetrics {
  totalMs?:     number;
  sttMs?:       number;
  intentMs?:    number;
  routerMs?:    number;
  ttsMs?:       number;
  inferenceMs?: number;
  knowledgeMs?: number;
}

export interface AIResponse {
  success:          boolean;
  pipeline:         string;
  sessionId:        string;
  farmerId:         string;
  language:         string;
  intent?:          string;
  confidence?:      number;
  moduleId?:        string;
  responseText?:    string;
  responseAudio?:   string;
  status?:          string;
  suggestions?:     string[];
  data?:            Record<string, unknown> | null;
  knowledge?:       Record<string, unknown> | null;
  metrics?:         AIMetrics;
  error?:           string;
  fallbackReason?:  string;
  timestamp?:       string;
  // snake_case aliases from Python bridge
  session_id?:      string;
  farmer_id?:       string;
  module_id?:       string;
  response_text?:   string;
  response_audio?:  string;
  fallback_reason?: string;
}

export interface AIHealthResponse {
  status:    string;
  version:   string;
  modules:   Record<string, string>;
  assets:    Record<string, boolean>;
  paths:     Record<string, string>;
  timestamp: string;
}

export interface AIStatusResponse {
  modules:        Record<string, string>;
  startup_report: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function buildError(message: string, pipeline = 'unknown'): AIResponse {
  return {
    success:      false,
    pipeline,
    sessionId:    '',
    farmerId:     '',
    language:     'hi',
    responseText: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।',
    error:        message,
    metrics:      {},
  };
}

function extractAxiosError(err: unknown): string {
  const axErr = err as AxiosError<{ detail?: string; error?: string }>;
  return (
    axErr.response?.data?.detail ||
    axErr.response?.data?.error  ||
    axErr.message                ||
    'Unknown error'
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a text message through the Pragati AI text pipeline.
 */
export async function processText(req: AITextRequest): Promise<AIResponse> {
  try {
    const body = {
      text:             req.text,
      session_id:       req.sessionId,
      farmer_id:        req.farmerId   || '',
      farmer_name:      req.farmerName || '',
      language:         req.language   || null,
      location:         req.location   || null,
      synthesize_audio: req.synthesizeAudio ?? false,
      extra:            req.extra || null,
    };

    const res = await axios.post<AIResponse>(
      `${BRIDGE_BASE_URL}/process/text`,
      body,
      { timeout: BRIDGE_TIMEOUT }
    );

    log.debug('processText success', { intent: res.data.intent, lang: res.data.language });
    return res.data;
  } catch (err) {
    const msg = extractAxiosError(err);
    log.error('processText failed', { error: msg });
    return buildError(msg, 'text');
  }
}

/**
 * Send an audio file through the Pragati AI voice pipeline.
 * STT → Intent → Router → TTS
 */
export async function processVoice(req: AIVoiceRequest): Promise<AIResponse> {
  if (!fs.existsSync(req.audioPath)) {
    return buildError(`Audio file not found: ${req.audioPath}`, 'voice');
  }

  try {
    const form = new FormData();
    const ext  = path.extname(req.audioPath).toLowerCase();
    const mime = ext === '.mp3' ? 'audio/mpeg'
               : ext === '.ogg' ? 'audio/ogg'
               : ext === '.flac' ? 'audio/flac'
               : 'audio/wav';

    form.append('audio', fs.createReadStream(req.audioPath), {
      filename:    path.basename(req.audioPath),
      contentType: mime,
    });
    if (req.sessionId)       form.append('session_id',       req.sessionId);
    if (req.farmerId)        form.append('farmer_id',        req.farmerId);
    if (req.farmerName)      form.append('farmer_name',      req.farmerName);
    if (req.language)        form.append('language',         req.language);
    form.append('synthesize_audio', String(req.synthesizeAudio ?? true));

    const res = await axios.post<AIResponse>(
      `${BRIDGE_BASE_URL}/process/voice`,
      form,
      { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT }
    );

    log.debug('processVoice success', { intent: res.data.intent });
    return res.data;
  } catch (err) {
    const msg = extractAxiosError(err);
    log.error('processVoice failed', { error: msg });
    return buildError(msg, 'voice');
  }
}

/**
 * Send an image file through the Pragati AI image pipeline.
 * Disease AI → Knowledge Base → Response
 */
export async function processImage(req: AIImageRequest): Promise<AIResponse> {
  if (!fs.existsSync(req.imagePath)) {
    return buildError(`Image file not found: ${req.imagePath}`, 'image');
  }

  try {
    const form = new FormData();
    const ext  = path.extname(req.imagePath).toLowerCase();
    const mime = ext === '.png'  ? 'image/png'
               : ext === '.webp' ? 'image/webp'
               : 'image/jpeg';

    form.append('image', fs.createReadStream(req.imagePath), {
      filename:    path.basename(req.imagePath),
      contentType: mime,
    });
    if (req.sessionId) form.append('session_id', req.sessionId);
    if (req.farmerId)  form.append('farmer_id',  req.farmerId);
    if (req.language)  form.append('language',   req.language);

    const res = await axios.post<AIResponse>(
      `${BRIDGE_BASE_URL}/process/image`,
      form,
      { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT }
    );

    log.debug('processImage success', { intent: res.data.intent, module: res.data.moduleId });
    return res.data;
  } catch (err) {
    const msg = extractAxiosError(err);
    log.error('processImage failed', { error: msg });
    return buildError(msg, 'image');
  }
}

/**
 * Fetch health status from the Pragati AI Bridge.
 */
export async function getAIHealth(): Promise<AIHealthResponse | null> {
  try {
    const res = await axios.get<AIHealthResponse>(
      `${BRIDGE_BASE_URL}/health`,
      { timeout: 5000 }
    );
    return res.data;
  } catch (err) {
    log.warn('getAIHealth failed', { error: extractAxiosError(err) });
    return null;
  }
}

/**
 * Fetch per-module status and startup validation report.
 */
export async function getAIStatus(): Promise<AIStatusResponse | null> {
  try {
    const res = await axios.get<AIStatusResponse>(
      `${BRIDGE_BASE_URL}/status`,
      { timeout: 5000 }
    );
    return res.data;
  } catch (err) {
    log.warn('getAIStatus failed', { error: extractAxiosError(err) });
    return null;
  }
}

/**
 * Check if the Pragati AI Bridge is reachable.
 */
export async function isPragatiAIHealthy(): Promise<boolean> {
  try {
    const res = await axios.get(`${BRIDGE_BASE_URL}/health`, { timeout: 3000 });
    return res.data?.status === 'healthy' || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Get conversation history for a session from the bridge.
 */
export async function getSessionHistory(sessionId: string): Promise<unknown[]> {
  try {
    const res = await axios.get(
      `${BRIDGE_BASE_URL}/session/${encodeURIComponent(sessionId)}/history`,
      { timeout: 5000 }
    );
    return res.data?.history || [];
  } catch (err) {
    log.warn('getSessionHistory failed', { sessionId, error: extractAxiosError(err) });
    return [];
  }
}

/**
 * End a session on the bridge (flushes memory to disk).
 */
export async function endAISession(sessionId: string): Promise<void> {
  try {
    await axios.delete(
      `${BRIDGE_BASE_URL}/session/${encodeURIComponent(sessionId)}`,
      { timeout: 5000 }
    );
  } catch (err) {
    log.warn('endAISession failed', { sessionId, error: extractAxiosError(err) });
  }
}
