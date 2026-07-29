/**
 * Disease Agent
 * Domain: Plant disease & pest identification
 * Data source: Disease & Pest Management (diseasepestsolutions) ONLY — confidence 0.95
 *
 * Fix 2: reads crop/disease from ctx.entities — no local parsing
 */

import { AgentContext, AgentResult } from './types';
import { searchDiseaseKB } from '../services/knowledgeBaseSearch';
import { generateDiseaseResponse } from '../services/responseGenerator';
import { buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('diseaseAgent');

export async function runDiseaseAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { message, pageData, entities } = ctx;

    // Fix 2: use pre-extracted entities; pageData takes priority (live scan result)
    const cropName =
      pageData?.diseaseResult?.cropName ||
      pageData?.cropData?.cropName ||
      entities?.crop ||
      '';

    const diseaseName =
      pageData?.diseaseResult?.diseaseName ||
      entities?.disease ||
      entities?.pest ||
      '';

    const yoloConf: number | undefined =
      pageData?.diseaseResult?.confidence !== undefined
        ? pageData.diseaseResult.confidence * 100
        : undefined;

    const hasImage = !!(pageData?.diseaseResult?.diseaseName);

    log.debug('DiseaseAgent running', { cropName, diseaseName, hasImage });

    // Priority KB search: Admin → Disease → Pest → Static
    const kbResult = await searchDiseaseKB(cropName, diseaseName);

    // Structured response generation
    const response = generateDiseaseResponse(kbResult, yoloConf, cropName, hasImage);

    // No image and no KB hit — ask for image
    if (response.needsImage && !hasImage) {
      return {
        agent:   'DiseaseAgent',
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

    // KB miss
    if (!kbResult.found) {
      return {
        agent:   'DiseaseAgent',
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
      agent:   'DiseaseAgent',
      success: true,
      data: {
        ...kbResult.data,
        confidence: response.confidence,
        kbSource:   kbResult.source,
        yoloConf,
        structuredResponse: { english: response.english, hindi: response.hindi },
      },
      summary: kbResult.summary,
    };
  } catch (err: any) {
    log.error('DiseaseAgent error', { error: err?.message });
    return buildErrorResult('DiseaseAgent', 'disease', err);
  }
}
