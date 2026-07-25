/**
 * Local Response Composer
 *
 * Composes structured, farmer-friendly responses entirely from local agent data.
 * Zero external API calls. Zero LLM dependency.
 *
 * Called by PragatiAIController BEFORE any fallback LLM is considered.
 * If this returns a non-null response, the LLM is never called.
 *
 * Rules:
 * - Only uses data already fetched by the local agents.
 * - Never fabricates data not present in agent results.
 * - Returns null when local data is insufficient to answer confidently.
 * - Multilingual output: native + hindi + english fields always populated.
 */

import { AgentResult } from '../agents/types';
import { IntentType } from './intentEngine';

export interface LocalResponse {
  english: string;
  hindi: string;
  native: string;
  source: 'local';
  intent: IntentType;
  agentsUsed: string[];
  confidence: 'high' | 'medium' | 'low';
}

// ─── Language name map ────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi',
  bn: 'Bengali', as: 'Assamese', or: 'Odia', te: 'Telugu', ta: 'Tamil',
  kn: 'Kannada', ml: 'Malayalam', ur: 'Urdu', sa: 'Sanskrit',
  raj: 'Rajasthani', mai: 'Maithili', ne: 'Nepali',
};

// ─── Hindi translations for common labels ────────────────────────────────────

const H = {
  crop:           'फसल',
  disease:        'रोग/कीट',
  soil:           'मिट्टी',
  weather:        'मौसम',
  market:         'मंडी भाव',
  scheme:         'सरकारी योजना',
  kvk:            'कृषि विज्ञान केंद्र',
  seed:           'बीज',
  fertilizer:     'खाद/उर्वरक',
  farm:           'खेत',
  score:          'स्कोर',
  season:         'मौसम',
  water:          'पानी',
  duration:       'अवधि',
  days:           'दिन',
  temp:           'तापमान',
  humidity:       'आर्द्रता',
  wind:           'हवा',
  modal:          'मोडल मूल्य',
  min:            'न्यूनतम',
  max:            'अधिकतम',
  quintal:        'क्विंटल',
  benefits:       'लाभ',
  eligibility:    'पात्रता',
  apply:          'आवेदन',
  symptoms:       'लक्षण',
  organic:        'जैविक उपचार',
  chemical:       'रासायनिक उपचार',
  prevention:     'बचाव',
  nitrogen:       'नाइट्रोजन',
  phosphorus:     'फास्फोरस',
  potassium:      'पोटेशियम',
  deficiency:     'कमी',
  recommendation: 'सिफारिश',
  tasks:          'कार्य',
  active:         'सक्रिय',
  noData:         'जानकारी उपलब्ध नहीं है।',
  notFound:       'मुझे इस विषय पर स्थानीय जानकारी नहीं मिली।',
  guide:          'मार्गदर्शन',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bullet(items: string[]): string {
  return items.filter(Boolean).map(i => `• ${i}`).join('\n');
}

function section(title: string, content: string): string {
  if (!content?.trim()) return '';
  return `\n**${title}**\n${content}`;
}

function fmt(label: string, value: any): string {
  if (value === undefined || value === null || value === '') return '';
  return `• ${label}: ${value}`;
}

// ─── Intent-specific composers ────────────────────────────────────────────────

function composeDiseaseResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'DiseaseAgent' && r.success && r.data);
  if (!agent?.data) return null;
  const d = agent.data as any;

  // Use pre-built structured response from responseGenerator if available
  if (d.structuredResponse?.english) return d.structuredResponse.english;

  // Need at least disease name or symptoms to give a useful answer
  if (!d.diseaseName && !d.symptoms && !d.organicSolution) return null;

  const lines: string[] = [];
  if (d.diseaseName) lines.push(`🌿 **Disease/Pest:** ${d.diseaseName} on ${d.cropName || 'your crop'}`);
  if (d.symptoms)    lines.push(section(`${H.symptoms}`, d.symptoms));
  if (d.organicSolution || d.organicTreatment)
    lines.push(section(`${H.organic}`, d.organicSolution || d.organicTreatment));
  if (d.chemicalSolution || d.chemicalTreatment)
    lines.push(section(`${H.chemical}`, d.chemicalSolution || d.chemicalTreatment));
  if (d.prevention)  lines.push(section(`${H.prevention}`, d.prevention));
  if (d.dos)         lines.push(section('✅ Do', d.dos));
  if (d.donts)       lines.push(section('❌ Don\'t', d.donts));
  if (d.recoveryTips) lines.push(section('💊 Recovery Tips', d.recoveryTips));

  return lines.filter(Boolean).join('\n');
}

function composeCropResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'CropAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.cropName && !d.lastRequestSoilType) return null;

  const lines: string[] = [];
  if (d.cropName) {
    lines.push(`🌾 **${H.crop}: ${d.cropName}**`);
    lines.push(bullet([
      fmt(`${H.season}`, d.season),
      fmt(`${H.water}`, d.waterRequirement),
      fmt(`${H.duration}`, d.growingDuration ? `${d.growingDuration} ${H.days}` : ''),
      fmt('Yield', d.estimatedYield),
      fmt('Market Demand', d.marketDemand),
      fmt('Risk', d.riskLevel),
    ].filter(Boolean)));
    if (d.whySuitable) lines.push(section('Why Suitable', d.whySuitable));
    if (d.cultivationGuide) lines.push(section('Cultivation Guide', d.cultivationGuide));
    if (d.fertilizerPlan) lines.push(section(`${H.fertilizer} Plan`, d.fertilizerPlan));
  } else if (d.lastRequestSoilType) {
    lines.push(`📋 Your last crop request: ${d.lastRequestSoilType} soil, ${d.lastRequestSeason} season in ${d.lastRequestDistrict}, ${d.lastRequestState}.`);
    lines.push('Use the Crop Advisory page (/crop-recommendation) for personalized recommendations.');
  }

  return lines.filter(Boolean).join('\n');
}

function composeSoilResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'SoilAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.healthScore && !d.ph && !d.nitrogen) return null;

  const lines: string[] = [];
  lines.push(`🌱 **${H.soil} Health Score: ${d.healthScore || 'N/A'}/100 (${d.healthStatus || 'N/A'})**`);
  lines.push(bullet([
    fmt('pH', d.ph),
    fmt(H.nitrogen, d.nitrogen),
    fmt(H.phosphorus, d.phosphorus),
    fmt(H.potassium, d.potassium),
    fmt('Organic Carbon', d.organicCarbon),
  ].filter(Boolean)));

  if (d.deficiencies?.length) {
    lines.push(section(`⚠️ ${H.deficiency}`, bullet(d.deficiencies.map((def: any) => def.nutrient || def))));
  }
  if (d.organicRecommendations?.length) {
    lines.push(section(`🌿 Organic ${H.recommendation}`, bullet(d.organicRecommendations)));
  }
  if (d.fertilizerRecommendations?.length) {
    lines.push(section(`💊 Fertilizer ${H.recommendation}`, bullet(d.fertilizerRecommendations)));
  }
  if (d.reasoning) lines.push(section('Analysis', d.reasoning));

  return lines.filter(Boolean).join('\n');
}

function composeWeatherResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'WeatherAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.condition && !d.temp) return null;

  const lines: string[] = [];
  lines.push(`🌤️ **${H.weather}: ${d.location || 'Your Location'}**`);
  lines.push(bullet([
    fmt('Condition', d.condition),
    fmt(`${H.temp}`, d.temp !== undefined ? `${d.temp}°C` : ''),
    fmt(`${H.humidity}`, d.humidity !== undefined ? `${d.humidity}%` : ''),
    fmt(`${H.wind}`, d.windKph !== undefined ? `${d.windKph} km/h` : ''),
  ].filter(Boolean)));

  if (d.forecast?.length) {
    const forecastLines = d.forecast.slice(0, 3).map((f: any) =>
      `  ${f.date || ''}: ${f.condition || ''}, ${f.maxTemp || ''}°C / ${f.minTemp || ''}°C, Rain: ${f.rainChance || 0}%`
    );
    lines.push(section('3-Day Forecast', forecastLines.join('\n')));
  }

  // Farming advisory based on weather
  const advice: string[] = [];
  if (d.humidity > 80) advice.push('High humidity — watch for fungal diseases on crops.');
  if (d.temp > 40)     advice.push('Extreme heat — irrigate in early morning or evening.');
  if (d.temp < 10)     advice.push('Cold weather — protect sensitive crops from frost.');
  if (d.forecast?.some((f: any) => f.rainChance > 60))
    advice.push('Rain expected — delay pesticide application.');
  if (advice.length) lines.push(section('🌾 Farming Advisory', bullet(advice)));

  return lines.filter(Boolean).join('\n');
}

function composeMarketResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'MarketAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.commodity && !d.modalPrice) return null;

  const lines: string[] = [];
  lines.push(`📊 **${H.market}: ${d.commodity || 'N/A'}**`);
  lines.push(bullet([
    fmt('Market', d.market),
    fmt('State', d.state),
    fmt(`${H.modal}`, d.modalPrice ? `₹${d.modalPrice}/${H.quintal}` : ''),
    fmt(`${H.min}`, d.minPrice ? `₹${d.minPrice}` : ''),
    fmt(`${H.max}`, d.maxPrice ? `₹${d.maxPrice}` : ''),
    fmt('Date', d.arrivalDate),
  ].filter(Boolean)));

  if (d.modalPrice) {
    const advice = d.modalPrice > 2000
      ? 'Current price is good. Consider selling now.'
      : 'Price is moderate. You may wait for better rates or sell in bulk.';
    lines.push(`\n💡 ${advice}`);
  }

  return lines.filter(Boolean).join('\n');
}

function composeGovernmentResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'GovernmentAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  const schemes: any[] = d.schemes || (d.title ? [d] : []);
  if (schemes.length === 0) return null;

  const lines: string[] = [];
  lines.push(`🏛️ **${H.scheme}**`);

  for (const s of schemes.slice(0, 2)) {
    lines.push(`\n📋 **${s.title}**`);
    if (s.summary)    lines.push(s.summary);
    if (s.benefits?.length) lines.push(section(`✅ ${H.benefits}`, bullet(s.benefits)));
    if (s.eligibility) lines.push(section(`📌 ${H.eligibility}`, s.eligibility));
    if (s.applicationProcess) lines.push(section(`📝 ${H.apply}`, s.applicationProcess));
    if (s.applicationLink) lines.push(`🔗 Apply: ${s.applicationLink}`);
  }

  return lines.filter(Boolean).join('\n');
}

function composeKVKResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'KVKAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  const kvks: any[] = d.kvks || (d.name ? [d] : []);
  if (kvks.length === 0) return null;

  const lines: string[] = [];
  lines.push(`🏫 **${H.kvk}**`);

  for (const k of kvks.slice(0, 2)) {
    lines.push(`\n📍 **${k.name}**`);
    lines.push(bullet([
      fmt('District', k.district),
      fmt('State', k.state),
      fmt('Phone', k.phone),
      fmt('Email', k.email),
    ].filter(Boolean)));
    if (k.services?.length) lines.push(section('Services', bullet(k.services)));
  }

  return lines.filter(Boolean).join('\n');
}

function composeIrrigationResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'IrrigationAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.irrigationMethod && !d.soilMoisturePercent && !d.recommendation) return null;

  const lines: string[] = [];
  if (d.cropName) lines.push(`💧 **Irrigation — ${d.cropName}**`);
  else lines.push('💧 **Irrigation Advisory**');

  if (d.irrigationMethod) {
    lines.push(bullet([
      fmt('Method', d.irrigationMethod),
      fmt('Interval', d.intervalDays ? `${d.intervalDays} days` : ''),
      fmt('Water Amount', d.waterAmount),
      fmt('Growth Stage', d.growthStage),
    ].filter(Boolean)));
    if (d.notes) lines.push(`\n📋 Note: ${d.notes}`);
  }

  if (d.soilMoisturePercent !== undefined) {
    lines.push(bullet([
      fmt('Soil Moisture', `${d.soilMoisturePercent}% (${d.soilMoistureStatus || 'N/A'})`),
    ].filter(Boolean)));
    if (d.recommendation) lines.push(`\n💡 ${d.recommendation}`);
  }

  return lines.filter(Boolean).join('\n');
}

function composeEmergencyResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'EmergencyAgent' && r.success && r.data);
  if (!agent?.summary) return null;
  return agent.summary;
}

function composeMachineryResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'MachineryAgent' && r.success && r.data);
  if (!agent?.summary) return null;
  return agent.summary;
}

function composeFarmDiaryResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'FarmDiaryAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.cropName) return null;

  const lines: string[] = [];
  lines.push(`🌾 **${H.active} ${H.crop}: ${d.cropName}**`);
  lines.push(bullet([
    fmt('Day', d.dayAge),
    fmt('Stage', d.status || d.stage),
    fmt('Sowing Date', d.sowingDate ? new Date(d.sowingDate).toLocaleDateString('en-IN') : ''),
    fmt('Expected Harvest', d.expectedHarvestDate ? new Date(d.expectedHarvestDate).toLocaleDateString('en-IN') : ''),
    fmt('Field Area', d.fieldArea ? `${d.fieldArea} acres` : ''),
  ].filter(Boolean)));

  if (d.todayTasks?.length) {
    const taskLines = d.todayTasks.map((t: any) =>
      typeof t === 'string' ? t : `${t.title}${t.description ? ': ' + t.description : ''}`
    );
    lines.push(section(`📋 Today's ${H.tasks}`, bullet(taskLines)));
  }

  if (d.allActiveCrops?.length > 1) {
    lines.push(`\n📌 Other active crops: ${d.allActiveCrops.slice(1).join(', ')}`);
  }

  return lines.filter(Boolean).join('\n');
}

function composeFertilizerResponse(results: AgentResult[]): string | null {
  const agent = results.find(r => r.agent === 'FertilizerAgent' && r.success && r.data);
  if (!agent?.data || Object.keys(agent.data).length === 0) return null;
  const d = agent.data as any;

  if (!d.products?.length && !d.soilContext) return null;

  const lines: string[] = [];
  lines.push(`💊 **${H.fertilizer} ${H.recommendation}**`);

  if (d.soilContext) {
    const sc = d.soilContext;
    lines.push(bullet([
      fmt(H.nitrogen, sc.nitrogenStatus),
      fmt(H.phosphorus, sc.phosphorusStatus),
      fmt(H.potassium, sc.potassiumStatus),
    ].filter(Boolean)));
    if (sc.fertilizerRecommendations?.length)
      lines.push(section('Recommended', bullet(sc.fertilizerRecommendations)));
    if (sc.organicRecommendations?.length)
      lines.push(section(`🌿 Organic`, bullet(sc.organicRecommendations)));
  }

  if (d.products?.length) {
    const productLines = d.products.slice(0, 3).map((p: any) =>
      `${p.name} (${p.type || ''}) — ${p.nutrientContent || ''} — ₹${p.price || 'N/A'}`
    );
    lines.push(section('Available Products', bullet(productLines)));
  }

  return lines.filter(Boolean).join('\n');
}

// ─── General / cross-domain composer ────────────────────────────────────────
// Tries every domain composer in priority order and merges whatever is available.
// Used for 'general', 'navigation', 'voice_command' intents AND as the final
// fallback for any intent whose primary composer returned null.

function composeAllAvailableData(results: AgentResult[]): { text: string; agents: string[] } {
  const parts: string[] = [];
  const agents: string[] = [];

  const tryAdd = (text: string | null, agent: string) => {
    if (text?.trim()) { parts.push(text); agents.push(agent); }
  };

  tryAdd(composeFarmDiaryResponse(results),   'FarmDiaryAgent');
  tryAdd(composeWeatherResponse(results),      'WeatherAgent');
  tryAdd(composeSoilResponse(results),         'SoilAgent');
  tryAdd(composeFertilizerResponse(results),   'FertilizerAgent');
  tryAdd(composeCropResponse(results),         'CropAgent');
  tryAdd(composeMarketResponse(results),       'MarketAgent');
  tryAdd(composeGovernmentResponse(results),   'GovernmentAgent');
  tryAdd(composeDiseaseResponse(results),      'DiseaseAgent');
  tryAdd(composeKVKResponse(results),          'KVKAgent');
  tryAdd(composeIrrigationResponse(results),   'IrrigationAgent');
  tryAdd(composeEmergencyResponse(results),    'EmergencyAgent');
  tryAdd(composeMachineryResponse(results),    'MachineryAgent');

  return { text: parts.join('\n\n'), agents };
}
// Simple structural translation using known label mappings.
// For full translation, the LLM fallback or translateObject is used.

function toHindi(english: string, langCode: string): string {
  // If user is already in Hindi/Devanagari, return as-is
  if (langCode === 'hi' || langCode === 'raj' || langCode === 'mai') return english;
  // For other languages we return the English text as hindi field
  // (full translation happens in the route layer via translateObject if key available)
  return english;
}

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Attempt to compose a complete response from local agent data.
 * Returns null if local data is insufficient — caller should use LLM fallback.
 */
export function composeLocalResponse(
  intent: IntentType,
  results: AgentResult[],
  langCode: string,
  userMessage: string,
): LocalResponse | null {
  const successfulAgents = results.filter(r => r.success);
  if (successfulAgents.length === 0) return null;

  let english: string | null = null;
  const agentsUsed: string[] = [];

  // Try intent-specific composer first
  switch (intent) {
    case 'disease':
      english = composeDiseaseResponse(results);
      if (english) agentsUsed.push('DiseaseAgent');
      break;
    case 'crop':
      english = composeCropResponse(results);
      if (english) agentsUsed.push('CropAgent');
      break;
    case 'soil': {
      english = composeSoilResponse(results);
      if (english) agentsUsed.push('SoilAgent');
      break;
    }
    case 'weather':
      english = composeWeatherResponse(results);
      if (english) agentsUsed.push('WeatherAgent');
      break;
    case 'market':
      english = composeMarketResponse(results);
      if (english) agentsUsed.push('MarketAgent');
      break;
    case 'government':
      english = composeGovernmentResponse(results);
      if (english) agentsUsed.push('GovernmentAgent');
      break;
    case 'kvk':
      english = composeKVKResponse(results);
      if (english) agentsUsed.push('KVKAgent');
      break;
    case 'irrigation':
      english = composeIrrigationResponse(results);
      if (english) agentsUsed.push('IrrigationAgent');
      break;
    case 'emergency':
      english = composeEmergencyResponse(results);
      if (english) agentsUsed.push('EmergencyAgent');
      break;
    case 'machinery':
      english = composeMachineryResponse(results);
      if (english) agentsUsed.push('MachineryAgent');
      break;
    case 'general':
    case 'navigation':
    case 'voice_command': {
      // Scan ALL available agent data — never call LLM just because intent is general
      const all = composeAllAvailableData(results);
      if (all.text) { english = all.text; agentsUsed.push(...all.agents); }
      break;
    }
  }

  // If the intent-specific composer returned nothing, do a full cross-domain scan
  // before giving up. This prevents falling through to the LLM when other agents
  // have perfectly valid data (e.g. weather agent answered a 'general' query).
  if (!english?.trim()) {
    const all = composeAllAvailableData(results);
    if (all.text) { english = all.text; agentsUsed.push(...all.agents); }
  }

  if (!english?.trim()) return null;

  const hindi = toHindi(english, langCode);
  const native = langCode === 'en' ? english : hindi;

  // Determine confidence based on data richness
  const confidence: 'high' | 'medium' | 'low' =
    agentsUsed.length >= 2 ? 'high' :
    agentsUsed.length === 1 ? 'medium' : 'low';

  return { english, hindi, native, source: 'local', intent, agentsUsed, confidence };
}

/**
 * Build a "not found in local KB" response — used when fallback LLM is disabled.
 */
export function buildNotFoundResponse(langCode: string): LocalResponse {
  const english = "I couldn't find this information in the current knowledge base. Please try asking about crops, diseases, soil health, weather, market prices, or government schemes. You can also visit the relevant page on the platform for detailed information.";
  const hindi   = "मुझे इस विषय पर स्थानीय ज्ञान आधार में जानकारी नहीं मिली। कृपया फसल, रोग, मिट्टी स्वास्थ्य, मौसम, मंडी भाव, या सरकारी योजनाओं के बारे में पूछें।";
  const native  = langCode === 'en' ? english : hindi;
  return { english, hindi, native, source: 'local', intent: 'general', agentsUsed: [], confidence: 'low' };
}
