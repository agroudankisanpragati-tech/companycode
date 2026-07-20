/**
 * Speech Translation Pipeline — Backend Service
 *
 * Full pipeline:
 *   Raw text (any language/dialect)
 *     → Language detection
 *     → Dictionary normalization (Phase 1 LanguageDictionary)
 *     → English internal representation (for YOLO / DB / AI)
 *     → Hindi display text
 *     → Dialect voice text
 *
 * Rules enforced here:
 *   - Backend modules (YOLO, DB, AI) ALWAYS receive English.
 *   - English selected → display English, speak English.
 *   - Any other language → display Hindi, speak selected dialect.
 *   - Unknown words → queued for admin review (via languageDictionaryService).
 *   - Translations are cached in-process (Map) to avoid redundant AI calls.
 *
 * This service is stateless and reusable by every route.
 */
export declare function detectLanguageFromText(text: string): string;
export declare function isDialect(langCode: string): boolean;
export interface PipelineInput {
    /** Raw text from STT or keyboard */
    rawText: string;
    /** App language code selected by user ('en', 'hi', 'mwr', …) */
    appLangCode: string;
    /** Page context for dictionary priority ('disease', 'soil', 'crop', …) */
    pageContext?: string;
}
export interface PipelineResult {
    /** Original raw input */
    original: string;
    /** Detected language code */
    detectedLang: string;
    /** Normalized English text — sent to YOLO / DB / AI */
    englishForBackend: string;
    /** Hindi text — shown in UI for non-English users */
    hindiDisplay: string;
    /** Text for TTS in the selected dialect */
    voiceText: string;
    /** Final display text (English if en selected, Hindi otherwise) */
    displayText: string;
    /** Whether the term was found in the dictionary */
    foundInDictionary: boolean;
    /** Confidence score from dictionary (0–1) */
    confidence: number;
}
export declare function runSpeechTranslationPipeline(input: PipelineInput): Promise<PipelineResult>;
export declare function runBatchPipeline(inputs: PipelineInput[]): Promise<PipelineResult[]>;
export declare function translateOutputForDisplay(englishText: string, appLangCode: string): Promise<{
    displayText: string;
    voiceText: string;
}>;
export declare function getCacheSize(): number;
export declare function clearTranslationCache(): void;
//# sourceMappingURL=speechTranslationPipeline.d.ts.map