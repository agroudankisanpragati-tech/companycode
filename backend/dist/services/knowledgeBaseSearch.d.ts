/**
 * Knowledge Base Search
 *
 * Unified KB search with strict priority order:
 *   1. Admin KB (DiseasePestSolution — admin-curated, highest trust)
 *   2. Crop KB (CropKnowledgeBase)
 *   3. Disease KB (DiseaseKnowledgeBase)
 *   4. General KB (PestKnowledgeBase)
 *   5. Static KB (hardcoded fallback for common queries)
 *
 * Rules:
 * - Never bypasses local knowledge
 * - Returns first match found in priority order
 * - All searches are case-insensitive regex
 * - Structured result with confidence score
 */
export type KBSource = 'admin_kb' | 'crop_kb' | 'disease_kb' | 'pest_kb' | 'static_kb' | 'none';
export interface KBSearchResult {
    found: boolean;
    source: KBSource;
    confidence: number;
    data: Record<string, any>;
    summary: string;
}
export declare function searchDiseaseKB(cropName: string, diseaseName: string): Promise<KBSearchResult>;
export declare function searchCropKB(cropName: string, soilType?: string, season?: string): Promise<KBSearchResult>;
export declare function searchSchemeKB(keyword: string, state?: string): Promise<KBSearchResult>;
//# sourceMappingURL=knowledgeBaseSearch.d.ts.map