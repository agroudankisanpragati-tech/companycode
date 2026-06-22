import { IDiseaseRecommendation } from '../models/DiseaseRecommendation';
import type { Document } from 'mongoose';
type CacheResult = (Omit<IDiseaseRecommendation, keyof Document> & {
    _id: any;
    source: 'cache';
    similarityScore: number;
}) | null;
/** Step 1 — search DiseaseRecommendations cache */
export declare function searchCache(cropName: string, diseaseName: string): Promise<CacheResult>;
/** Step 2 — search DiseaseKnowledgeBase */
export declare function searchKnowledgeBase(cropName: string, diseaseName: string): Promise<{
    cropName: any;
    diseaseName: any;
    diseaseType: any;
    severityLevel: any;
    symptoms: string;
    treatment: string;
    prevention: string;
    description: any;
    source: "knowledge_base";
    similarityScore: number;
} | null>;
/** Step 3 — call OpenAI Vision */
export declare function callAIForDisease(imageBase64: string, cropHint?: string): Promise<{
    cropName: string;
    diseaseName: string;
    diseaseType: string;
    severityLevel: string;
    symptoms: string;
    treatment: string;
    prevention: string;
    description: string;
}>;
export {};
//# sourceMappingURL=diseaseService.d.ts.map