/**
 * Context Engine
 *
 * Builds the page-aware context block injected into the Root AI system prompt.
 * Each page context produces a focused instruction block that:
 *   - Tells the AI exactly what data is currently visible on the page
 *   - Restricts the AI to answer only from that context
 *   - Prevents cross-context hallucination
 *
 * This is purely a string-builder — no DB calls, no AI calls.
 * Live page data (scan result, open scheme, selected crop, etc.) is passed in
 * from the frontend via the `pageData` field in the chat request body.
 */
import { IntentType } from './intentEngine';
export type PageContextKey = 'disease' | 'crop' | 'soil' | 'weather' | 'market' | 'government' | 'kvk' | 'farm_diary' | 'shop' | 'admin' | 'dashboard' | 'ui';
export interface PageData {
    /** Current page context key */
    pageContext: PageContextKey;
    /** Disease scan result currently shown */
    diseaseResult?: {
        diseaseName?: string;
        cropName?: string;
        confidence?: number;
        severity?: string;
        causes?: string;
        organicSolution?: string;
        chemicalSolution?: string;
        prevention?: string;
    };
    /** Scheme currently open */
    schemeData?: {
        title?: string;
        department?: string;
        summary?: string;
        benefits?: string[];
        eligibility?: string;
        applicationProcess?: string;
    };
    /** Crop currently selected / being advised */
    cropData?: {
        cropName?: string;
        variety?: string;
        stage?: string;
        dayAge?: number;
        soilType?: string;
        season?: string;
    };
    /** Soil report currently shown */
    soilData?: {
        healthScore?: number;
        healthStatus?: string;
        nitrogen?: string;
        phosphorus?: string;
        potassium?: string;
        ph?: number;
        recommendations?: string;
    };
    /** Weather data currently shown */
    weatherData?: {
        location?: string;
        condition?: string;
        temp?: number;
        humidity?: number;
        rainfall?: number;
        forecast?: string;
    };
    /** Market/mandi data currently shown */
    marketData?: {
        commodity?: string;
        market?: string;
        state?: string;
        modalPrice?: number;
        minPrice?: number;
        maxPrice?: number;
    };
    /** KVK center currently shown */
    kvkData?: {
        name?: string;
        district?: string;
        state?: string;
        services?: string[];
        distance?: number;
    };
    /** Active crop in farm diary */
    farmDiaryData?: {
        cropName?: string;
        stage?: string;
        dayAge?: number;
        todayTasks?: string[];
    };
    /** Shop currently viewed */
    shopData?: {
        shopName?: string;
        shopType?: string;
        products?: string[];
    };
}
export declare function buildPageContextBlock(pageData: PageData, userMessage: string): string;
/**
 * Validates that the user's intent matches the current page context.
 * Returns a warning string to inject if there's a mismatch, or empty string if OK.
 */
export declare function buildMismatchWarning(pageCtx: PageContextKey, intent: IntentType): string;
//# sourceMappingURL=contextEngine.d.ts.map