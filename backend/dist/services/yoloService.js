"use strict";
// =============================================================================
// AKP — Agroudan Kisan Pragati
// File: backend/src/services/yoloService.ts
// Purpose: HTTP client for the Python FastAPI YOLO inference service.
//          Supports crop-aware filtered prediction and dynamic crop list.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCropsFromYolo = fetchCropsFromYolo;
exports.isCropSupportedByYolo = isCropSupportedByYolo;
exports.callYoloPredict = callYoloPredict;
exports.isYoloServiceHealthy = isYoloServiceHealthy;
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
const YOLO_BASE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:8000';
const YOLO_TIMEOUT_MS = parseInt(process.env.YOLO_TIMEOUT_MS || '15000', 10);
// ---------------------------------------------------------------------------
// Crop list cache (from FastAPI /crops — built from dataset_index.json)
// ---------------------------------------------------------------------------
let _cropsCache = null;
let _cropsCacheExpiry = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
async function fetchCropsFromYolo() {
    const now = Date.now();
    if (_cropsCache && now < _cropsCacheExpiry)
        return _cropsCache;
    try {
        const res = await axios_1.default.get(`${YOLO_BASE_URL}/crops`, { timeout: 4000 });
        _cropsCache = res.data.crops || [];
        _cropsCacheExpiry = now + CACHE_TTL_MS;
        return _cropsCache;
    }
    catch {
        return _cropsCache || [];
    }
}
// ---------------------------------------------------------------------------
// Supported crop check
// ---------------------------------------------------------------------------
function normalizeName(name) {
    return name.toLowerCase().trim().replace(/[\s\-_]+/g, '');
}
async function isCropSupportedByYolo(cropHint) {
    if (!cropHint?.trim())
        return false;
    const crops = await fetchCropsFromYolo();
    if (crops.length === 0)
        return true; // YOLO down — let it try, fail gracefully
    const normalized = normalizeName(cropHint);
    return crops.some(c => {
        const cn = normalizeName(c.crop_name);
        const ck = normalizeName(c.crop_key);
        // Exact match first
        if (cn === normalized || ck === normalized)
            return true;
        // Only allow substring if one fully contains the other AND length is close
        // (prevents 'gram' matching both 'blackgram' and 'greengram')
        const lenRatio = (a, b) => Math.min(a.length, b.length) / Math.max(a.length, b.length);
        if (cn.includes(normalized) && lenRatio(cn, normalized) > 0.6)
            return true;
        if (normalized.includes(cn) && lenRatio(cn, normalized) > 0.6)
            return true;
        if (ck.includes(normalized) && lenRatio(ck, normalized) > 0.6)
            return true;
        if (normalized.includes(ck) && lenRatio(ck, normalized) > 0.6)
            return true;
        return false;
    });
}
// ---------------------------------------------------------------------------
// Crop-aware YOLO predict
// ---------------------------------------------------------------------------
async function callYoloPredict(imagePath, cropHint) {
    try {
        if (!fs_1.default.existsSync(imagePath)) {
            console.error(`[YOLO] Image file not found: ${imagePath}`);
            return null;
        }
        const form = new form_data_1.default();
        // Detect content type from extension — handles .jpg.jpeg double-extension filenames
        const ext = imagePath.toLowerCase();
        const contentType = ext.endsWith('.png') ? 'image/png'
            : ext.endsWith('.webp') ? 'image/webp'
                : 'image/jpeg';
        form.append('image', fs_1.default.createReadStream(imagePath), {
            filename: 'upload.jpg', // always send a clean filename to FastAPI
            contentType,
        });
        if (cropHint) {
            form.append('crop_hint', cropHint);
        }
        console.log(`[YOLO] Sending predict request: crop=${cropHint}, file=${imagePath}`);
        const res = await axios_1.default.post(`${YOLO_BASE_URL}/predict`, form, {
            headers: form.getHeaders(),
            timeout: YOLO_TIMEOUT_MS,
        });
        if (res.data?.success) {
            console.log(`[YOLO] Prediction: ${res.data.class_name} (${res.data.confidence}%)`);
            return res.data;
        }
        console.error('[YOLO] Unexpected response shape:', JSON.stringify(res.data).slice(0, 200));
        return null;
    }
    catch (err) {
        const axiosErr = err;
        const status = axiosErr.response?.status;
        const detail = axiosErr.response?.data?.detail || axiosErr.message;
        if (status === 422) {
            console.log(`[YOLO] Crop not in training data (422): ${detail}`);
            return null;
        }
        console.error(`[YOLO] Predict failed (${status || 'no response'}): ${detail}`);
        return null;
    }
}
// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
async function isYoloServiceHealthy() {
    try {
        const res = await axios_1.default.get(`${YOLO_BASE_URL}/health`, { timeout: 3000 });
        return res.data?.status === 'ok';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=yoloService.js.map