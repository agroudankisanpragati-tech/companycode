/**
 * Disease Agent
 * Domain: Plant disease & pest identification
 * Data sources (priority order):
 *   1. Admin KB (DiseasePestSolution)    — confidence 0.95
 *   2. Disease KB (DiseaseKnowledgeBase) — confidence 0.80
 *   3. Pest KB (PestKnowledgeBase)       — confidence 0.75
 *   4. Static KB (hardcoded common)      — confidence 0.60
 * Response: structured via responseGenerator (cause, symptoms, severity,
 *   confidence, organic, chemical, prevention, fertilizer, irrigation,
 *   warnings, next steps)
 * Never communicates directly with the user.
 */

import { AgentContext, AgentResult } from './types';
import { searchDiseaseKB } from '../services/knowledgeBaseSearch';
import { generateDiseaseResponse } from '../services/responseGenerator';

export async function runDiseaseAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { message, pageData } = ctx;

    const cropName =
      pageData?.diseaseResult?.cropName ||
      pageData?.cropData?.cropName ||
      extractCropFromMessage(message);

    const diseaseName =
      pageData?.diseaseResult?.diseaseName ||
      extractDiseaseFromMessage(message);

    const yoloConf: number | undefined =
      pageData?.diseaseResult?.confidence !== undefined
        ? pageData.diseaseResult.confidence * 100
        : undefined;

    const hasImage = !!(pageData?.diseaseResult?.diseaseName);

    // ── Priority KB search: Admin → Disease → Pest → Static ──────────────
    const kbResult = await searchDiseaseKB(cropName, diseaseName);

    // ── Structured response generation ────────────────────────────────────
    const response = generateDiseaseResponse(kbResult, yoloConf, cropName, hasImage);

    // No image and no KB hit — ask for image
    if (response.needsImage && !hasImage) {
      return {
        agent: 'DiseaseAgent',
        success: true,
        data: {
          needsImage:  true,
          needsCrop:   response.needsCrop,
          cropName:    cropName || null,
          diseaseName: diseaseName || null,
          confidence:  0,
          structuredResponse: { english: response.english, hindi: response.hindi },
        },
        summary: response.english,
      };
    }

    // KB miss — no match found
    if (!kbResult.found) {
      return {
        agent: 'DiseaseAgent',
        success: true,
        data: {
          needsImage:  !hasImage,
          cropName:    cropName || null,
          diseaseName: diseaseName || null,
          confidence:  0,
          structuredResponse: { english: response.english, hindi: response.hindi },
        },
        summary: response.english,
      };
    }

    // Full structured response
    return {
      agent: 'DiseaseAgent',
      success: true,
      data: {
        ...kbResult.data,
        confidence:  response.confidence,
        kbSource:    kbResult.source,
        yoloConf,
        structuredResponse: { english: response.english, hindi: response.hindi },
      },
      summary: kbResult.summary,
    };
  } catch (err: any) {
    return {
      agent: 'DiseaseAgent',
      success: false,
      error: 'Disease information is temporarily unavailable. Please try the Disease Detection page directly.',
    };
  }
}

function extractCropFromMessage(msg: string): string {
  const crops = [
    'wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane',
    'potato', 'onion', 'mustard', 'gram', 'soybean', 'moong', 'mung',
    'bajra', 'jowar', 'groundnut', 'chilli', // ===== AI Supported Crops =====
  'black_gram',
  'green_gram',
  'corn_maize',
  'tomato',
  'pearl_millet _bajra',
  'wheat',

  // ===== English =====
  'black gram',
  'green gram',
  'corn',
  'maize',
  'pearl millet',

  // ===== Hindi / Hinglish =====
  'urad',
  'udad',
  'moong',
  'mung',
  'makka',
  'tamatar',
  'bajra',
  'gehu',
  'gehun',

  // ===== Other existing crops =====
  'rice',
  'cotton',
  'sugarcane',
  'potato',
  'onion',
  'mustard',
  'gram',
  'soybean',
  'jowar',
  'groundnut',
  'chilli',
  'brinjal','brinjal',
  ];
  const lower = msg.toLowerCase();
  return crops.find(c => lower.includes(c)) || '';
}

function extractDiseaseFromMessage(msg: string): string {
  const diseases = [
    'blight', 'rust', 'wilt', 'rot', 'mildew', 'mosaic', 'leaf spot',
    'fungus', 'aphid', 'borer', 'yellow mosaic', 'bacterial', 'powdery',
  ];
  const lower = msg.toLowerCase();
  return diseases.find(d => lower.includes(d)) || '';
}
