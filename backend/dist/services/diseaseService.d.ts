import { IDiseaseRecommendation } from '../models/DiseaseRecommendation';
import type { Document } from 'mongoose';
import { YoloPrediction } from './yoloService';
/** Minimum YOLO confidence (%) required to return a prediction. Below this the
 *  scan endpoint returns a low-confidence response and asks for a clearer image. */
export declare const YOLO_CONFIDENCE_THRESHOLD: number;
type CacheResult = (Omit<IDiseaseRecommendation, keyof Document> & {
    _id: any;
    source: 'cache';
    similarityScore: number;
}) | null;
/** Step 1 — search DiseaseRecommendations (scan history cache) */
export declare function searchCache(cropName: string, diseaseName: string): Promise<CacheResult>;
/** Step 2 — search DiseaseKnowledgeBase (permanent knowledge store) */
export declare function searchKnowledgeBase(cropName: string, diseaseName: string): Promise<{
    knowledgeBaseId: any;
    cropName: any;
    diseaseName: any;
    diseaseType: any;
    severityLevel: any;
    symptoms: string;
    organicTreatment: any;
    chemicalTreatment: any;
    treatment: string;
    prevention: string;
    recommendedActions: any;
    description: any;
    confidenceScore: any;
    source: "knowledge_base";
    similarityScore: number;
    urgentPrevention: any;
    recoveryTips: any;
    dos: any;
    donts: any;
    recommendedProducts: any;
    recommendedFertilizer: any;
    recommendedBioProduct: any;
    recommendedOrganicProduct: any;
    extraFarmerAdvice: any;
    suitableWeather: any;
    diseaseImages: any;
    healthyImages: any;
    imageGallery: any;
    tags: any;
} | null>;
export interface KBAdvisory {
    knowledgeBaseId: string;
    symptoms: string;
    organicTreatment: string;
    chemicalTreatment: string;
    treatment: string;
    prevention: string;
    description: string;
    recommendedActions: string;
    urgentPrevention: string;
    recoveryTips: string;
    dos: string;
    donts: string;
    recommendedProducts: string;
    recommendedFertilizer: string;
    recommendedBioProduct: string;
    recommendedOrganicProduct: string;
    extraFarmerAdvice: string;
    suitableWeather: string;
    diseaseImages: string[];
    tags: string[];
    source: 'dps' | 'knowledge_base';
}
/**
 * Fetch advisory content (symptoms, treatment, prevention, etc.) from the
 * knowledge base using YOLO-provided crop name and disease/pest label.
 *
 * Priority:
 *   1. Admin-curated DiseasePestSolution (exact crop + disease match)
 *   2. DiseaseKnowledgeBase (fuzzy crop + disease match)
 *
 * Returns null when no advisory data exists — the scan result is still valid
 * because the prediction came from YOLO.
 */
export declare function getAdvisoryFromKnowledgeBase(cropName: string, diseaseName: string): Promise<KBAdvisory | null>;
export type AIDetectionResult = {
    cropName: string;
    cropNameHindi: string;
    diseaseName: string;
    diseaseNameHindi: string;
    diseaseType: string;
    severityLevel: string;
    symptoms: string;
    symptomsHindi: string;
    organicTreatment: string;
    organicTreatmentHindi: string;
    chemicalTreatment: string;
    chemicalTreatmentHindi: string;
    treatment: string;
    prevention: string;
    preventionHindi: string;
    description: string;
    descriptionHindi: string;
    recommendedActions: string;
    recommendedActionsHindi: string;
    confidenceScore: number;
};
/**
 * YOLO-only disease detection.
 * OpenAI Vision is NOT used anywhere in this function.
 */
export declare function runHybridDiseaseDetection(imagePath: string, _imageBase64: string, cropHint?: string): Promise<{
    engine: 'yolo';
    result: AIDetectionResult | null;
    yoloRaw?: YoloPrediction;
}>;
/** Auto-save AI result to DiseaseKnowledgeBase for future reuse */
export declare function autoSaveToKnowledgeBase(aiResult: AIDetectionResult, imageUrl?: string): Promise<void>;
/** Called when feedback is 'helpful' — promote ai_auto to ai_verified after threshold */
export declare function handleFeedbackForKB(knowledgeBaseId: string | undefined, cropName: string, diseaseName: string, isHelpful: boolean): Promise<void>;
export {};
//# sourceMappingURL=diseaseService.d.ts.map