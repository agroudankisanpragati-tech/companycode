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

import { IntentType, detectIntent, intentLabel } from './intentEngine';

// ─── Page context keys ────────────────────────────────────────────────────────

export type PageContextKey =
  | 'disease'
  | 'crop'
  | 'soil'
  | 'weather'
  | 'market'
  | 'government'
  | 'kvk'
  | 'farm_diary'
  | 'shop'
  | 'admin'
  | 'dashboard'
  | 'ui';

// ─── Page data shape sent from frontend ──────────────────────────────────────

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

// ─── Page-specific system prompt blocks ──────────────────────────────────────

const PAGE_INSTRUCTIONS: Record<PageContextKey, string> = {
  disease: `PAGE CONTEXT: Disease Detection
You are currently on the Disease Detection page.
STRICT RULE: Answer ONLY about the disease scan result shown on this page.
- If a scan result is provided below, explain ONLY that disease, its causes, treatment and prevention.
- Do NOT recommend other crops or discuss unrelated topics.
- If no scan result is provided yet, guide the user to upload a crop photo.
- Never fabricate disease names or treatments not in the scan result.`,

  crop: `PAGE CONTEXT: Crop Advisory
You are currently on the Crop Advisory / Crop Recommendation page.
STRICT RULE: Answer ONLY about the crop currently selected or being recommended.
- If crop data is provided below, explain ONLY that crop's cultivation, season, soil needs, and market.
- Do NOT discuss diseases from other pages or unrelated government schemes.
- Guide the user through the crop recommendation form if they haven't submitted yet.`,

  soil: `PAGE CONTEXT: Soil Health
You are currently on the Soil Health page.
STRICT RULE: Answer ONLY about the soil report currently shown.
- If soil data is provided below, explain ONLY those specific deficiencies, pH issues, and fertilizer recommendations.
- Do NOT discuss crop diseases or market prices unless directly related to the soil report.
- Guide the user to upload a soil report if none is shown.`,

  weather: `PAGE CONTEXT: Weather
You are currently on the Weather page.
STRICT RULE: Answer ONLY about the weather data currently shown for the farmer's location.
- Explain what the current weather means for farming decisions.
- Advise on irrigation, sowing, harvesting based on the weather shown.
- Do NOT discuss diseases, schemes, or market prices unless the farmer explicitly asks.`,

  market: `PAGE CONTEXT: Market Prices (Mandi Bhav)
You are currently on the Mandi Prices page.
STRICT RULE: Answer ONLY about the commodity prices currently shown.
- Explain the modal price, min/max prices, and what they mean for the farmer.
- Advise on the best time to sell based on the current price data.
- Do NOT discuss diseases or soil health unless explicitly asked.`,

  government: `PAGE CONTEXT: Government Schemes
You are currently on the Government Schemes page.
STRICT RULE: Answer ONLY about the scheme currently open or being viewed.
- If scheme data is provided below, explain ONLY that scheme's benefits, eligibility, and application process.
- Do NOT discuss other schemes unless the farmer asks to compare.
- Do NOT discuss crop diseases or soil health.`,

  kvk: `PAGE CONTEXT: KVK (Krishi Vigyan Kendra)
You are currently on the KVK page.
STRICT RULE: Answer ONLY about the KVK center currently shown.
- Explain the services offered, how to reach the center, and what help is available.
- Guide the farmer on how to book soil testing, get seeds, or attend training.`,

  farm_diary: `PAGE CONTEXT: Farm Diary (AI-FOS)
You are currently on the Farm Diary / AI Farm Operating System page.
STRICT RULE: Answer ONLY about the active crop and today's tasks shown.
- Explain today's scheduled tasks and why they are important.
- Advise on the current crop stage and what the farmer should do next.`,

  shop: `PAGE CONTEXT: Shop / Marketplace
You are currently on the Shop page.
STRICT RULE: Answer ONLY about the shop or products currently shown.
- Help the farmer understand product details, pricing, and how to contact the shop.`,

  admin: `PAGE CONTEXT: Admin Panel
You are currently in the Admin Panel.
Answer admin-related questions about managing the platform, users, and content.`,

  dashboard: `PAGE CONTEXT: Farmer Dashboard
You are on the main Farmer Dashboard.
Answer questions about any dashboard widget — weather, soil moisture, crop advisor, market snapshot, or disease scan.
You may answer broadly across all farming topics from this page.`,

  ui: `PAGE CONTEXT: General Platform
Answer any farming or platform question. You are not restricted to a specific page context.`,
};

// ─── Main context builder ─────────────────────────────────────────────────────

export function buildPageContextBlock(pageData: PageData, userMessage: string): string {
  const ctx = pageData.pageContext || 'ui';
  const instruction = PAGE_INSTRUCTIONS[ctx] || PAGE_INSTRUCTIONS.ui;

  // Detect intent from user message
  const intent = detectIntent(userMessage);
  const intentName = intentLabel(intent);

  let block = `\n\n${instruction}\nDETECTED USER INTENT: ${intentName}`;

  // Inject live page data
  if (ctx === 'disease' && pageData.diseaseResult) {
    const d = pageData.diseaseResult;
    block += `\n\nCURRENT SCAN RESULT ON PAGE:
Disease: ${d.diseaseName || 'Unknown'}
Crop: ${d.cropName || 'Unknown'}
Confidence: ${d.confidence ? Math.round(d.confidence * 100) + '%' : 'N/A'}
Severity: ${d.severity || 'N/A'}
Causes: ${d.causes || 'N/A'}
Organic Solution: ${d.organicSolution || 'N/A'}
Chemical Solution: ${d.chemicalSolution || 'N/A'}
Prevention: ${d.prevention || 'N/A'}
Answer ONLY about this specific disease result.`;
  }

  if (ctx === 'government' && pageData.schemeData) {
    const s = pageData.schemeData;
    block += `\n\nCURRENT SCHEME OPEN ON PAGE:
Title: ${s.title || 'N/A'}
Department: ${s.department || 'N/A'}
Summary: ${s.summary || 'N/A'}
Benefits: ${s.benefits?.join(', ') || 'N/A'}
Eligibility: ${s.eligibility || 'N/A'}
Application: ${s.applicationProcess || 'N/A'}
Answer ONLY about this specific scheme.`;
  }

  if (ctx === 'crop' && pageData.cropData) {
    const c = pageData.cropData;
    block += `\n\nCURRENT CROP ON PAGE:
Crop: ${c.cropName || 'N/A'}
Variety: ${c.variety || 'N/A'}
Stage: ${c.stage || 'N/A'}
Day: ${c.dayAge || 'N/A'}
Soil Type: ${c.soilType || 'N/A'}
Season: ${c.season || 'N/A'}
Answer ONLY about this specific crop.`;
  }

  if (ctx === 'soil' && pageData.soilData) {
    const s = pageData.soilData;
    block += `\n\nCURRENT SOIL REPORT ON PAGE:
Health Score: ${s.healthScore || 'N/A'}/100
Status: ${s.healthStatus || 'N/A'}
Nitrogen: ${s.nitrogen || 'N/A'}
Phosphorus: ${s.phosphorus || 'N/A'}
Potassium: ${s.potassium || 'N/A'}
pH: ${s.ph || 'N/A'}
Recommendations: ${s.recommendations || 'N/A'}
Answer ONLY about this specific soil report.`;
  }

  if (ctx === 'weather' && pageData.weatherData) {
    const w = pageData.weatherData;
    block += `\n\nCURRENT WEATHER ON PAGE:
Location: ${w.location || 'N/A'}
Condition: ${w.condition || 'N/A'}
Temperature: ${w.temp !== undefined ? w.temp + '°C' : 'N/A'}
Humidity: ${w.humidity !== undefined ? w.humidity + '%' : 'N/A'}
Rainfall: ${w.rainfall !== undefined ? w.rainfall + ' mm' : 'N/A'}
Answer farming advice based on this specific weather data.`;
  }

  if (ctx === 'market' && pageData.marketData) {
    const m = pageData.marketData;
    block += `\n\nCURRENT MARKET DATA ON PAGE:
Commodity: ${m.commodity || 'N/A'}
Market: ${m.market || 'N/A'}
State: ${m.state || 'N/A'}
Modal Price: ₹${m.modalPrice || 'N/A'}/quintal
Min Price: ₹${m.minPrice || 'N/A'}
Max Price: ₹${m.maxPrice || 'N/A'}
Answer ONLY about this specific commodity price.`;
  }

  if (ctx === 'kvk' && pageData.kvkData) {
    const k = pageData.kvkData;
    block += `\n\nCURRENT KVK ON PAGE:
Name: ${k.name || 'N/A'}
District: ${k.district || 'N/A'}
State: ${k.state || 'N/A'}
Services: ${k.services?.join(', ') || 'N/A'}
Distance: ${k.distance ? k.distance + ' km' : 'N/A'}`;
  }

  if (ctx === 'farm_diary' && pageData.farmDiaryData) {
    const f = pageData.farmDiaryData;
    block += `\n\nACTIVE CROP IN FARM DIARY:
Crop: ${f.cropName || 'N/A'}
Stage: ${f.stage || 'N/A'}
Day: ${f.dayAge || 'N/A'}
Today's Tasks: ${f.todayTasks?.join(', ') || 'None'}`;
  }

  return block;
}

/**
 * Validates that the user's intent matches the current page context.
 * Returns a warning string to inject if there's a mismatch, or empty string if OK.
 */
export function buildMismatchWarning(pageCtx: PageContextKey, intent: IntentType): string {
  // These intents are always allowed on any page
  const universalIntents: IntentType[] = ['general', 'navigation', 'voice_command'];
  if (universalIntents.includes(intent)) return '';

  const intentCtx = {
    disease: 'disease', crop: 'crop', soil: 'soil',
    weather: 'weather', market: 'market', government: 'government', kvk: 'kvk',
  } as Record<string, string>;

  const expectedCtx = intentCtx[intent];
  if (!expectedCtx || expectedCtx === pageCtx || pageCtx === 'dashboard' || pageCtx === 'ui') return '';

  return `\n\nCONTEXT MISMATCH WARNING: The user is asking about "${intentLabel(intent)}" but is currently on the "${pageCtx}" page. Answer the question but gently remind the farmer they can navigate to the ${intentLabel(intent)} page for full details. Do NOT ignore the current page context entirely.`;
}
