// =============================================================================
// AKP — Agroudan Kisan Pragati
// File: backend/src/services/yoloService.ts
// Purpose: HTTP client for the Python FastAPI YOLO inference service.
//          Supports crop-aware filtered prediction and dynamic crop list.
// =============================================================================

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios, { AxiosError } from 'axios';

const YOLO_BASE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:8000';
const YOLO_TIMEOUT_MS = parseInt(process.env.YOLO_TIMEOUT_MS || '15000', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YoloCropClass {
  class_id: number;
  class_name: string;
  category: string;
}

export interface YoloCrop {
  crop_key: string;
  crop_name: string;
  class_count: number;
  classes: YoloCropClass[];
}

export interface YoloPrediction {
  success: true;
  status: 'success';
  engine: 'yolo';
  crop: string;
  category: string;
  class_name: string;
  confidence: number;
  crop_filtered: boolean;
  top5: Array<{
    rank: number;
    class_id: number;
    class_name: string;
    confidence: number;
    crop: string;
    category: string;
  }>;
  inference_ms: number;
}

// ---------------------------------------------------------------------------
// Crop list cache (from FastAPI /crops — built from dataset_index.json)
// ---------------------------------------------------------------------------

let _cropsCache: YoloCrop[] | null = null;
let _cropsCacheExpiry = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchCropsFromYolo(): Promise<YoloCrop[]> {
  const now = Date.now();
  if (_cropsCache && now < _cropsCacheExpiry) return _cropsCache;

  try {
    const res = await axios.get<{ crops: YoloCrop[] }>(`${YOLO_BASE_URL}/crops`, { timeout: 4000 });
    _cropsCache = res.data.crops || [];
    _cropsCacheExpiry = now + CACHE_TTL_MS;
    return _cropsCache;
  } catch {
    return _cropsCache || [];
  }
}

// ---------------------------------------------------------------------------
// Supported crop check
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[\s\-_]+/g, '');
}

export async function isCropSupportedByYolo(cropHint: string): Promise<boolean> {
  if (!cropHint?.trim()) return false;
  const crops = await fetchCropsFromYolo();
  if (crops.length === 0) return true; // YOLO down — let it try, fail gracefully
  const normalized = normalizeName(cropHint);
  return crops.some(c => {
    const cn = normalizeName(c.crop_name);
    const ck = normalizeName(c.crop_key);
    // Exact match first
    if (cn === normalized || ck === normalized) return true;
    // Only allow substring if one fully contains the other AND length is close
    // (prevents 'gram' matching both 'blackgram' and 'greengram')
    const lenRatio = (a: string, b: string) => Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (cn.includes(normalized) && lenRatio(cn, normalized) > 0.6) return true;
    if (normalized.includes(cn) && lenRatio(cn, normalized) > 0.6) return true;
    if (ck.includes(normalized) && lenRatio(ck, normalized) > 0.6) return true;
    if (normalized.includes(ck) && lenRatio(ck, normalized) > 0.6) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Crop-aware YOLO predict
// ---------------------------------------------------------------------------

export async function callYoloPredict(
  imagePath: string,
  cropHint?: string,
): Promise<YoloPrediction | null> {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error(`[YOLO] Image file not found: ${imagePath}`);
      return null;
    }

    const form = new FormData();
    // Detect content type from extension — handles .jpg.jpeg double-extension filenames
    const ext = imagePath.toLowerCase();
    const contentType = ext.endsWith('.png') ? 'image/png'
      : ext.endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';

    form.append('image', fs.createReadStream(imagePath), {
      filename: 'upload.jpg',  // always send a clean filename to FastAPI
      contentType,
    });
    if (cropHint) {
      form.append('crop_hint', cropHint);
    }

    console.log(`[YOLO] Sending predict request: crop=${cropHint}, file=${imagePath}`);

    const res = await axios.post<YoloPrediction>(`${YOLO_BASE_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: YOLO_TIMEOUT_MS,
    });

    if (res.data?.success) {
      console.log(`[YOLO] Prediction: ${res.data.class_name} (${res.data.confidence}%)`);
      return res.data;
    }
    console.error('[YOLO] Unexpected response shape:', JSON.stringify(res.data).slice(0, 200));
    return null;
  } catch (err) {
    const axiosErr = err as AxiosError<{ detail: string }>;
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

export async function isYoloServiceHealthy(): Promise<boolean> {
  try {
    const res = await axios.get(`${YOLO_BASE_URL}/health`, { timeout: 3000 });
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}
