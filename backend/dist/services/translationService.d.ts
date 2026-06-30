/**
 * Reusable AI Translation Service
 * Translates any structured AI response into the requested Indian language.
 * Used by Disease Detection, Soil Health, AI Crop Advisor, AI Farm Manager, and all future AI modules.
 */
/**
 * Translate a flat key-value object of string fields into the target language.
 * Numeric / non-string fields are passed through unchanged.
 * Returns the same shape as the input with all string values translated.
 */
export declare function translateObject(data: Record<string, any>, targetLang: string): Promise<Record<string, any>>;
/**
 * Translate a nested object (e.g. SoilReport with nested arrays/objects).
 * Flattens translatable leaf strings, translates them, then reassembles.
 */
export declare function translateNestedObject(data: Record<string, any>, targetLang: string): Promise<Record<string, any>>;
export declare const SUPPORTED_LANGUAGES: string[];
//# sourceMappingURL=translationService.d.ts.map