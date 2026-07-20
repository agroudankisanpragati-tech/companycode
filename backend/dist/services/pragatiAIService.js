"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processText = processText;
exports.processVoice = processVoice;
exports.processImage = processImage;
exports.getAIHealth = getAIHealth;
exports.getAIStatus = getAIStatus;
exports.isPragatiAIHealthy = isPragatiAIHealthy;
exports.getSessionHistory = getSessionHistory;
exports.endAISession = endAISession;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const log = (0, logger_1.createLogger)('pragatiAIService');
const BRIDGE_BASE_URL = process.env.PRAGATI_AI_BRIDGE_URL || 'http://localhost:8001';
const BRIDGE_TIMEOUT = parseInt(process.env.PRAGATI_AI_TIMEOUT_MS || '60000', 10);
// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function buildError(message, pipeline = 'unknown') {
    return {
        success: false,
        pipeline,
        sessionId: '',
        farmerId: '',
        language: 'hi',
        responseText: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।',
        error: message,
        metrics: {},
    };
}
function extractAxiosError(err) {
    const axErr = err;
    return (axErr.response?.data?.detail ||
        axErr.response?.data?.error ||
        axErr.message ||
        'Unknown error');
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Send a text message through the Pragati AI text pipeline.
 */
async function processText(req) {
    try {
        const body = {
            text: req.text,
            session_id: req.sessionId,
            farmer_id: req.farmerId || '',
            farmer_name: req.farmerName || '',
            language: req.language || null,
            location: req.location || null,
            synthesize_audio: req.synthesizeAudio ?? false,
            extra: req.extra || null,
        };
        const res = await axios_1.default.post(`${BRIDGE_BASE_URL}/process/text`, body, { timeout: BRIDGE_TIMEOUT });
        log.debug('processText success', { intent: res.data.intent, lang: res.data.language });
        return res.data;
    }
    catch (err) {
        const msg = extractAxiosError(err);
        log.error('processText failed', { error: msg });
        return buildError(msg, 'text');
    }
}
/**
 * Send an audio file through the Pragati AI voice pipeline.
 * STT → Intent → Router → TTS
 */
async function processVoice(req) {
    if (!fs_1.default.existsSync(req.audioPath)) {
        return buildError(`Audio file not found: ${req.audioPath}`, 'voice');
    }
    try {
        const form = new form_data_1.default();
        const ext = path_1.default.extname(req.audioPath).toLowerCase();
        const mime = ext === '.mp3' ? 'audio/mpeg'
            : ext === '.ogg' ? 'audio/ogg'
                : ext === '.flac' ? 'audio/flac'
                    : 'audio/wav';
        form.append('audio', fs_1.default.createReadStream(req.audioPath), {
            filename: path_1.default.basename(req.audioPath),
            contentType: mime,
        });
        if (req.sessionId)
            form.append('session_id', req.sessionId);
        if (req.farmerId)
            form.append('farmer_id', req.farmerId);
        if (req.farmerName)
            form.append('farmer_name', req.farmerName);
        if (req.language)
            form.append('language', req.language);
        form.append('synthesize_audio', String(req.synthesizeAudio ?? true));
        const res = await axios_1.default.post(`${BRIDGE_BASE_URL}/process/voice`, form, { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT });
        log.debug('processVoice success', { intent: res.data.intent });
        return res.data;
    }
    catch (err) {
        const msg = extractAxiosError(err);
        log.error('processVoice failed', { error: msg });
        return buildError(msg, 'voice');
    }
}
/**
 * Send an image file through the Pragati AI image pipeline.
 * Disease AI → Knowledge Base → Response
 */
async function processImage(req) {
    if (!fs_1.default.existsSync(req.imagePath)) {
        return buildError(`Image file not found: ${req.imagePath}`, 'image');
    }
    try {
        const form = new form_data_1.default();
        const ext = path_1.default.extname(req.imagePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
            : ext === '.webp' ? 'image/webp'
                : 'image/jpeg';
        form.append('image', fs_1.default.createReadStream(req.imagePath), {
            filename: path_1.default.basename(req.imagePath),
            contentType: mime,
        });
        if (req.sessionId)
            form.append('session_id', req.sessionId);
        if (req.farmerId)
            form.append('farmer_id', req.farmerId);
        if (req.language)
            form.append('language', req.language);
        const res = await axios_1.default.post(`${BRIDGE_BASE_URL}/process/image`, form, { headers: form.getHeaders(), timeout: BRIDGE_TIMEOUT });
        log.debug('processImage success', { intent: res.data.intent, module: res.data.moduleId });
        return res.data;
    }
    catch (err) {
        const msg = extractAxiosError(err);
        log.error('processImage failed', { error: msg });
        return buildError(msg, 'image');
    }
}
/**
 * Fetch health status from the Pragati AI Bridge.
 */
async function getAIHealth() {
    try {
        const res = await axios_1.default.get(`${BRIDGE_BASE_URL}/health`, { timeout: 5000 });
        return res.data;
    }
    catch (err) {
        log.warn('getAIHealth failed', { error: extractAxiosError(err) });
        return null;
    }
}
/**
 * Fetch per-module status and startup validation report.
 */
async function getAIStatus() {
    try {
        const res = await axios_1.default.get(`${BRIDGE_BASE_URL}/status`, { timeout: 5000 });
        return res.data;
    }
    catch (err) {
        log.warn('getAIStatus failed', { error: extractAxiosError(err) });
        return null;
    }
}
/**
 * Check if the Pragati AI Bridge is reachable.
 */
async function isPragatiAIHealthy() {
    try {
        const res = await axios_1.default.get(`${BRIDGE_BASE_URL}/health`, { timeout: 3000 });
        return res.data?.status === 'healthy' || res.status === 200;
    }
    catch {
        return false;
    }
}
/**
 * Get conversation history for a session from the bridge.
 */
async function getSessionHistory(sessionId) {
    try {
        const res = await axios_1.default.get(`${BRIDGE_BASE_URL}/session/${encodeURIComponent(sessionId)}/history`, { timeout: 5000 });
        return res.data?.history || [];
    }
    catch (err) {
        log.warn('getSessionHistory failed', { sessionId, error: extractAxiosError(err) });
        return [];
    }
}
/**
 * End a session on the bridge (flushes memory to disk).
 */
async function endAISession(sessionId) {
    try {
        await axios_1.default.delete(`${BRIDGE_BASE_URL}/session/${encodeURIComponent(sessionId)}`, { timeout: 5000 });
    }
    catch (err) {
        log.warn('endAISession failed', { sessionId, error: extractAxiosError(err) });
    }
}
//# sourceMappingURL=pragatiAIService.js.map