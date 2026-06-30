import { IDiseaseRecommendation } from '../models/DiseaseRecommendation';
import type { Document } from 'mongoose';
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
} | null>;
/** Step 3 — call OpenAI Vision API */
export declare function callAIForDisease(imageBase64: string, cropHint?: string): Promise<{
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
}>;
/** Auto-save AI result to DiseaseKnowledgeBase for future reuse */
export declare function autoSaveToKnowledgeBase(aiResult: Awaited<ReturnType<typeof callAIForDisease>>, imageUrl?: string): Promise<void>;
/** Called when feedback is 'helpful' — promote ai_auto to ai_verified after threshold */
export declare function handleFeedbackForKB(knowledgeBaseId: string | undefined, cropName: string, diseaseName: string, isHelpful: boolean): Promise<void>;
export {};
//# sourceMappingURL=diseaseService.d.ts.map