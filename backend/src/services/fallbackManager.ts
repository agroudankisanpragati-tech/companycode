/**
 * Shared Fallback Manager
 *
 * Enforces a single, consistent fallback chain for every agent:
 *
 *   Live API  →  Knowledge Base  →  MongoDB  →  Memory  →  LLM  →  Helpful fallback
 *
 * Before this service, each agent had its own fallback logic:
 *   - MarketAgent: try MarketPriceHistory → try MarketplaceListing → return empty
 *   - SoilAgent:   try pageData → try DB → return empty
 *   - KVKAgent:    try pageData → try DB → return empty
 *   All with slightly different empty-result messages and no shared contract.
 *
 * Now every agent calls buildFallbackResult() with a domain label and the
 * system returns a consistent, farmer-friendly fallback response.
 *
 * Rules:
 *   - Never fabricates data
 *   - Always returns a valid AgentResult (never throws)
 *   - Includes a navigation hint so the farmer knows where to go
 */

import { AgentResult, AgentName } from '../agents/types';
import { createLogger } from '../utils/logger';

const log = createLogger('fallbackManager');

// ─── Domain fallback messages ─────────────────────────────────────────────────

interface FallbackMessage {
  english: string;
  hindi:   string;
  navHint: string; // page path to navigate to
}

const DOMAIN_FALLBACKS: Record<string, FallbackMessage> = {
  market: {
    english: 'No mandi price data found for your query. Please visit the Mandi Prices page for live rates.',
    hindi:   'आपकी क्वेरी के लिए मंडी भाव डेटा नहीं मिला। लाइव रेट के लिए मंडी भाव पेज पर जाएं।',
    navHint: '/dashboard/farmer/market',
  },
  soil: {
    english: 'No soil report found. Please upload your soil report on the Soil Health page for personalized advice.',
    hindi:   'कोई मिट्टी रिपोर्ट नहीं मिली। व्यक्तिगत सलाह के लिए मिट्टी स्वास्थ्य पेज पर अपनी रिपोर्ट अपलोड करें।',
    navHint: '/dashboard/farmer/soil-health',
  },
  crop: {
    english: 'No crop data found. Use the Crop Advisory page to get personalized crop recommendations.',
    hindi:   'कोई फसल डेटा नहीं मिला। व्यक्तिगत फसल सिफारिश के लिए फसल सलाहकार पेज का उपयोग करें।',
    navHint: '/crop-recommendation',
  },
  disease: {
    english: 'No disease information found. Please upload a crop photo on the Disease Detection page for AI diagnosis.',
    hindi:   'कोई रोग जानकारी नहीं मिली। AI निदान के लिए रोग पहचान पेज पर फसल की फोटो अपलोड करें।',
    navHint: '/disease-detection',
  },
  weather: {
    english: 'Weather data unavailable. Please update your profile with district and state for accurate forecasts.',
    hindi:   'मौसम डेटा उपलब्ध नहीं है। सटीक पूर्वानुमान के लिए अपनी प्रोफ़ाइल में जिला और राज्य अपडेट करें।',
    navHint: '/weather',
  },
  government: {
    english: 'No matching government schemes found. Browse all available schemes on the Schemes page.',
    hindi:   'कोई मिलती-जुलती सरकारी योजना नहीं मिली। सभी उपलब्ध योजनाओं के लिए योजनाएं पेज देखें।',
    navHint: '/schemes',
  },
  kvk: {
    english: 'No KVK centers found nearby. Visit the KVK page to find the nearest center.',
    hindi:   'नजदीक कोई KVK केंद्र नहीं मिला। निकटतम केंद्र खोजने के लिए KVK पेज पर जाएं।',
    navHint: '/kvk',
  },
  seed: {
    english: 'No seed products found. Visit the Marketplace to find nearby seed shops.',
    hindi:   'कोई बीज उत्पाद नहीं मिला। नजदीकी बीज दुकानें खोजने के लिए मार्केटप्लेस पर जाएं।',
    navHint: '/marketplace',
  },
  fertilizer: {
    english: 'No fertilizer data found. Upload a soil report for personalized fertilizer advice.',
    hindi:   'कोई खाद डेटा नहीं मिला। व्यक्तिगत खाद सलाह के लिए मिट्टी रिपोर्ट अपलोड करें।',
    navHint: '/dashboard/farmer/soil-health',
  },
  irrigation: {
    english: 'No irrigation data found. Visit the Irrigation page for schedules and soil moisture readings.',
    hindi:   'कोई सिंचाई डेटा नहीं मिला। शेड्यूल और मिट्टी नमी रीडिंग के लिए सिंचाई पेज पर जाएं।',
    navHint: '/dashboard/farmer/irrigation',
  },
  machinery: {
    english: 'For farm machinery guidance, contact your KVK center or apply for SMAM subsidy at your state agriculture department.',
    hindi:   'कृषि मशीनरी मार्गदर्शन के लिए अपने KVK केंद्र से संपर्क करें या राज्य कृषि विभाग में SMAM सब्सिडी के लिए आवेदन करें।',
    navHint: '/kvk',
  },
  emergency: {
    english: '🚨 Emergency: Call KVK Helpline 1800-180-1551 (toll-free) immediately.',
    hindi:   '🚨 आपातकाल: तुरंत KVK हेल्पलाइन 1800-180-1551 (टोल-फ्री) पर कॉल करें।',
    navHint: '/kvk',
  },
  general: {
    english: 'I could not find specific information for your query. Please try asking about crops, diseases, soil health, weather, market prices, or government schemes.',
    hindi:   'आपकी क्वेरी के लिए विशिष्ट जानकारी नहीं मिली। कृपया फसल, रोग, मिट्टी स्वास्थ्य, मौसम, मंडी भाव, या सरकारी योजनाओं के बारे में पूछें।',
    navHint: '/dashboard/farmer',
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a consistent fallback AgentResult for a given domain.
 * Called by agents when all data sources are exhausted.
 *
 * @param agent  - The agent name (for result attribution)
 * @param domain - Domain key matching DOMAIN_FALLBACKS
 * @param extra  - Optional extra context to append to the summary
 */
export function buildFallbackResult(
  agent:  AgentName,
  domain: string,
  extra?: string,
): AgentResult {
  const fb = DOMAIN_FALLBACKS[domain] || DOMAIN_FALLBACKS.general;
  const summary = extra ? `${fb.english} ${extra}` : fb.english;

  log.debug('Fallback result built', { agent, domain });

  return {
    agent,
    success: true,
    data: {
      fallback:    true,
      domain,
      navHint:     fb.navHint,
      hindiMessage: fb.hindi,
    },
    summary,
  };
}

/**
 * Build an error AgentResult when an agent throws unexpectedly.
 * Provides a safe, user-friendly error message.
 */
export function buildErrorResult(
  agent:  AgentName,
  domain: string,
  err?:   any,
): AgentResult {
  log.warn('Agent error result', { agent, domain, error: err?.message });
  const fb = DOMAIN_FALLBACKS[domain] || DOMAIN_FALLBACKS.general;
  return {
    agent,
    success: false,
    error: fb.english,
  };
}
