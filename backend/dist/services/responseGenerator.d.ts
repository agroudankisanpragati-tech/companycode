/**
 * Response Generator
 *
 * Generates structured, farmer-friendly responses from KB data.
 * Handles all required fields for disease responses:
 *   cause, symptoms, severity, confidence, organic treatment,
 *   chemical treatment, prevention, fertilizer, irrigation,
 *   warnings, next steps
 *
 * Also handles low-confidence responses:
 *   - Asks for crop name if missing
 *   - Asks for location if missing
 *   - Asks for better image if confidence < threshold
 *
 * Rules:
 * - Never fabricates data not present in KB
 * - Always returns bilingual (English + Hindi)
 * - Structured markdown output for UI rendering
 */
import { KBSearchResult } from './knowledgeBaseSearch';
export interface DiseaseResponseResult {
    english: string;
    hindi: string;
    confidence: number;
    source: string;
    needsImage: boolean;
    needsCrop: boolean;
}
/**
 * Generate a structured disease response from KB data.
 * Handles low confidence by asking for more information.
 */
export declare function generateDiseaseResponse(kbResult: KBSearchResult, yoloConf?: number, // YOLO confidence 0–100
cropName?: string, hasImage?: boolean): DiseaseResponseResult;
/**
 * Generate a confidence-aware response for any domain.
 * Used when KB returns a result but confidence is borderline.
 */
export declare function generateLowConfidencePrompt(domain: string, missing: string[]): {
    english: string;
    hindi: string;
};
//# sourceMappingURL=responseGenerator.d.ts.map