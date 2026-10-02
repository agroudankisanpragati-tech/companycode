import { readFile } from 'fs/promises';
import path from 'path';

export interface WebsiteRagEvidence {
  document_id: string;
  title: string;
  section_path: string;
  source: string;
  review_status: string;
  distance: number;
  text: string;
}

interface WebsiteRagResponse {
  results?: WebsiteRagEvidence[];
}

export type WebsiteNavigationTarget =
  | 'home'
  | 'crop_recommendation'
  | 'crop_history'
  | 'disease_detection'
  | 'soil_health'
  | 'soil_moisture'
  | 'fertilizer_calculator'
  | 'my_crops'
  | 'farmer_tasks'
  | 'farmer_activities'
  | 'farmer_recommendations'
  | 'farmer_rewards'
  | 'farmer_crop_health'
  | 'farmer_soil_health'
  | 'profile'
  | 'edit_profile'
  | 'settings'
  | 'login'
  | 'register'
  | 'role_select'
  | 'weather'
  | 'market_prices'
  | 'market_dashboard'
  | 'kvk'
  | 'dashboard'
  | 'marketplace'
  | 'shops'
  | 'shopkeeper_products'
  | 'shopkeeper_nursery'
  | 'shopkeeper_fertilizer'
  | 'shopkeeper_profile'
  | 'shopkeeper_complete_profile'
  | 'farmer_ai_suggestions'
  | 'schemes'
  | 'seva_mitra'
  | 'ai_assistant'
  | 'farmer_stories'
  | 'about'
  | 'contact'
  | 'gallery'
  | 'blog'
  | 'careers'
  | 'rajasthan_portal';
  
  

export interface WebsiteNavigationAction {
  target: WebsiteNavigationTarget;
  mode: 'navigate' | 'guide' | 'offer';
  alreadyOnPage?: boolean;
}

const GUIDE_DOCUMENT_IDS: Record<WebsiteNavigationTarget, string> = {
  home: 'website-overview',
  crop_recommendation: 'website-crop-recommendation',
  crop_history: 'website-crop-recommendation',
  disease_detection: 'website-disease-detection',
  soil_health: 'website-soil-health',
  soil_moisture: 'website-farmer-dashboard',
  login: 'website-account-access',
  register: 'website-account-access',
  role_select: 'website-account-access',
  dashboard: 'website-navigation',
  profile: 'website-navigation',
  edit_profile: 'website-navigation',
  settings: 'website-navigation',
  fertilizer_calculator: 'website-navigation',
  my_crops: 'website-farmer-dashboard',
  farmer_tasks: 'website-farmer-dashboard',
  farmer_activities: 'website-farmer-dashboard',
  farmer_recommendations: 'website-farmer-dashboard',
  farmer_rewards: 'website-farmer-dashboard',
  farmer_crop_health: 'website-farmer-dashboard',
  farmer_soil_health: 'website-soil-health',
  weather: 'website-navigation',
  market_prices: 'website-navigation',
  market_dashboard: 'website-navigation',
  kvk: 'website-navigation',
  marketplace: 'website-navigation',
  shops: 'website-navigation',
  shopkeeper_products: 'website-navigation',
  shopkeeper_nursery: 'website-navigation',
  shopkeeper_fertilizer: 'website-navigation',
  shopkeeper_profile: 'website-navigation',
  shopkeeper_complete_profile: 'website-navigation',
  farmer_ai_suggestions: 'website-farmer-dashboard',
  schemes: 'website-navigation',
  seva_mitra: 'website-navigation',
  ai_assistant: 'website-overview',
  farmer_stories: 'website-overview',
  about: 'website-overview',
  contact: 'website-overview',
  gallery: 'website-overview',
  blog: 'website-overview',
  careers: 'website-overview',
  rajasthan_portal: 'website-navigation',
};
const PAGE_CONTEXT_TARGETS: Record<string, WebsiteNavigationTarget> = {
  home: 'home',
  crop: 'crop_recommendation',
  disease: 'disease_detection',
  soil: 'soil_health',
  weather: 'weather',
  market: 'market_prices',
  kvk: 'kvk',
  dashboard: 'dashboard',
  ui: 'dashboard',
  fertilizer: 'fertilizer_calculator',
  shop: 'marketplace',
  government: 'schemes',
};

export function getWebsiteGuideDocumentId(target: WebsiteNavigationTarget): string {
  return GUIDE_DOCUMENT_IDS[target];
}

/** Load the exact repository guide for a resolved page target. This is a
 * reliable local fallback when Chroma or the Python bridge is unavailable. */
export async function loadWebsiteGuideEvidence(documentId: string): Promise<WebsiteRagEvidence | null> {
  const knownDocumentIds = new Set(Object.values(GUIDE_DOCUMENT_IDS));
  if (!knownDocumentIds.has(documentId)) return null;

  const slug = documentId.replace(/^website-/, '');
  const sourcePath = path.resolve(__dirname, '../../../knowledge/website', `${slug}.md`);
  try {
    const source = await readFile(sourcePath, 'utf8');
    const text = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || slug.replace(/-/g, ' ');
    return {
      document_id: documentId,
      title,
      section_path: 'Website guide',
      source: `knowledge/website/${slug}.md`,
      review_status: 'draft',
      distance: 0,
      text,
    };
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
    return null;
  }
}

export function isWebsitePageContextTarget(pageContext: string | undefined, target: WebsiteNavigationTarget): boolean {
  return !!pageContext && PAGE_CONTEXT_TARGETS[pageContext] === target;
}

const DEFAULT_BRIDGE_URL = 'http://localhost:8001';
const MAX_DISTANCE = Number(process.env.WEBSITE_RAG_MAX_DISTANCE || '0.35');

export function isWebsiteRagEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.WEBSITE_RAG_ENABLED === 'true';
}

export function isWebsiteHelpQuestion(intent: string, question: string): boolean {
  if (/\b(my|this|current|latest|uploaded)\b.{0,50}\b(result|report|score|recommendation|price|weather|scan|crop result|soil values)\b|\bwhat did my\b|\bwhat does my\b|\bwhat is my current\b/i.test(question)) return false;
  if (resolveWebsiteNavigation(question)) return true;
  if (intent === 'navigation') return true;
  return /\b(website|web site|site|platform|app|application|dashboard|navigation|menu|page|feature|login|log in|sign in|account|where can i find|where is|how do i open|how to open)\b|वेबसाइट|साइट|प्लेटफ़ॉर्म|प्लेटफॉर्म|ऐप|डैशबोर्ड|मेनू|पेज|पृष्ठ|सुविधा|लॉग.?इन|खोल|कहाँ|कहां/i.test(question);
}

function asksForWebsiteGuidance(question: string): boolean {
  return /\bhow\s+(?:do|can)\s+i\b|\bhow\s+to\b|\bwhat\s+(?:should|do)\s+i\b|\b(?:which|what)\s+(?:checkbox|field|button|option)\b|\bsteps?\s+(?:to|for)\b|\bguide\s+me\b|\bhelp\s+me\b|\bwalk\s+me\s+through\b/i.test(question);
}

/** Normalize common Hindi-script speech spellings of English page names and commands. */
function normalizeSpokenWebsiteCommand(question: string): string {
  return question.normalize('NFC')
    .replace(/(?:डिज़ीज़|डिजीज|डिसीज|डीज़ीज|डीजीज)\s*डिटेक्शन/giu, ' disease detection ')
    .replace(/(?:रोग|बीमारी)\s*(?:की\s*)?पहचान/gu, ' disease detection ')
    .replace(/(?:क्रॉप|फसल)\s*(?:की\s*)?(?:रिकमेंडेशन|रेकमेंडेशन|सिफारिश|एडवाइजरी|सलाह)/gu, ' crop recommendation ')
    .replace(/(?:सॉइल|सोइल)\s*(?:हेल्थ|रिपोर्ट)/gu, ' soil health ')
    .replace(/डैशबोर्ड/gu, ' dashboard ')
    .replace(/(?:ओपन|ओपेन|खोलो|खोलें|खोलिए|खोल\s*दो|खोल\s*दीजिए)/gu, ' open ')
    .replace(/गो\s*टू/gu, ' go to ')
    .replace(/(?:हाउ|हो)\s*(?:टू|तो)/gu, ' how to ')
    .replace(/कैसे/gu, ' how to ')
    .replace(/(?:दिखाओ|दिखाइए)/gu, ' show me ')
    .replace(/कहाँ\s*(?:है|मिलेगा|मिलेगी|जाऊँ|जाऊं)/gu, ' where is ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveWebsiteNavigation(question: string): WebsiteNavigationAction | null {
  const matchingQuestion = normalizeSpokenWebsiteCommand(question);
  const targetRules: Array<{ target: WebsiteNavigationTarget; pattern: RegExp }> = [
    { target: 'farmer_recommendations', pattern: /\b(my|farmer)\s+(recommendations|crop recommendations)\b/i },
    { target: 'dashboard', pattern: /\b(my|user|signed[ -]?in)?\s*dashboard\b/i },
    { target: 'shopkeeper_products', pattern: /\b(shopkeeper products|product inventory|my products)\b/i },
    { target: 'shopkeeper_nursery', pattern: /\b(nursery products?|plants inventory)\b/i },
    { target: 'shopkeeper_fertilizer', pattern: /\b(fertilizer products?|fertiliser products?|fertilizer inventory)\b/i },
    { target: 'shopkeeper_profile', pattern: /\b(shopkeeper|vendor|business) profile\b/i },
    { target: 'shopkeeper_complete_profile', pattern: /\b(complete|finish) (my )?(shopkeeper|vendor|business) profile\b/i },
    { target: 'market_dashboard', pattern: /\b(my market|dashboard market|market on (my )?dashboard)\b/i },
    { target: 'crop_history', pattern: /\b(crop recommendation history|crop history|past crop recommendations)\b/i },
    { target: 'farmer_tasks', pattern: /\b(my tasks|farmer tasks|farm tasks)\b/i },
    { target: 'farmer_activities', pattern: /\b(my activities|farm activities|activity history)\b/i },
    { target: 'farmer_rewards', pattern: /\b(my rewards|farmer rewards|rewards page)\b/i },
    { target: 'fertilizer_calculator', pattern: /\b(fertilizer calculator|fertiliser calculator|fertilizer tool)\b/i },
    { target: 'my_crops', pattern: /\b(my crops|crop portfolio|saved crops)\b/i },
    { target: 'register', pattern: /\b(register|sign up|create (an )?account)\b/i },
    { target: 'role_select', pattern: /\b(choose|select) (an? )?(account )?(role|account type)\b/i },
    { target: 'edit_profile', pattern: /\b(edit|update|change) (my )?profile\b/i },
    { target: 'profile', pattern: /\b(my )?profile\b/i },
    { target: 'farmer_ai_suggestions', pattern: /\b(ai suggestions|farm ai suggestions|my ai suggestions)\b/i },
    { target: 'settings', pattern: /\b(settings|preferences)\b/i },
    { target: 'crop_recommendation', pattern: /\b(crop recommendation|crop advisory|ai advisor|crop advice page)\b|फसल सिफारिश|फसल सलाहकार/i },
    { target: 'disease_detection', pattern: /\b(disease detection|disease scan|crop disease page)\b|रोग पहचान|बीमारी जांच|बीमारी जाँच/i },
    { target: 'soil_moisture', pattern: /\bsoil moisture\b|मिट्टी की नमी|मृदा नमी/i },
    { target: 'soil_health', pattern: /\b(soil health|soil report|soil test page)\b|मिट्टी स्वास्थ्य|मिट्टी की रिपोर्ट|मृदा स्वास्थ्य/i },
    { target: 'login', pattern: /\b(login|log in|sign in|sign-in|account access)\b|लॉग.?इन|साइन.?इन/i },
    { target: 'weather', pattern: /\b(weather page|weather forecast page)\b|मौसम पेज/i },
    { target: 'market_prices', pattern: /\b(mandi prices?|market prices?|market page)\b|मंडी भाव|बाजार भाव/i },
    { target: 'kvk', pattern: /\b(kvk|krishi vigyan kendra)\b|कृषि विज्ञान केंद्र/i },
    { target: 'dashboard', pattern: /\b(farmer dashboard|dashboard page)\b|किसान डैशबोर्ड/i },
    { target: 'marketplace', pattern: /\b(marketplace|buy farm inputs|sell farm products)\b/i },
    { target: 'shops', pattern: /\b(shop directory|all shops|browse shops|nearby shops)\b/i },
    { target: 'schemes', pattern: /\b(government schemes|scheme list|schemes page)\b/i },
    { target: 'seva_mitra', pattern: /\b(seva mitra|scheme assistant)\b/i },
    { target: 'ai_assistant', pattern: /\b(ai assistant page|assistant page|pragati ai page)\b/i },
    { target: 'farmer_stories', pattern: /\b(farmer stories|farmer story)\b/i },
    { target: 'about', pattern: /\b(about us|about page)\b/i },
    { target: 'contact', pattern: /\b(contact us|contact page)\b/i },
    { target: 'gallery', pattern: /\b(gallery|photo gallery)\b/i },
    { target: 'blog', pattern: /\b(blog|articles)\b/i },
    { target: 'careers', pattern: /\b(careers|jobs|job openings)\b/i },
    { target: 'rajasthan_portal', pattern: /\b(rajasthan portal|rajasthan farmer portal)\b/i },
    { target: 'home', pattern: /\b(home page|homepage|go home)\b/i },
    { target: 'farmer_crop_health', pattern: /\b(crop health|crop health dashboard)\b/i },
    { target: 'farmer_soil_health', pattern: /\b(dashboard soil health|my soil health)\b/i },
    { target: 'weather', pattern: /\b(weather|forecast)\b/i },
    { target: 'market_prices', pattern: /\b(mandi|market rates?)\b/i },
    { target: 'my_crops', pattern: /\b(crops page|my crop list|my saved crops)\b/i },
    { target: 'market_prices', pattern: /\bmarket\b/i },
    { target: 'soil_health', pattern: /\bsoil( health| report)?\b/i },
    { target: 'schemes', pattern: /\bschemes\b/i },
    { target: 'shops', pattern: /\bshops?\b/i },
    { target: 'ai_assistant', pattern: /\b(ai assistant|assistant)\b/i },
    { target: 'about', pattern: /\babout\b/i },
    { target: 'contact', pattern: /\bcontact\b/i },
    { target: 'gallery', pattern: /\bgallery\b/i },
    { target: 'blog', pattern: /\bblog\b/i },
    { target: 'careers', pattern: /\bcareers?\b/i },
  ];
  const target = targetRules.find(rule => rule.pattern.test(matchingQuestion))?.target;
  if (!target) return null;

  const asksForGuidance = asksForWebsiteGuidance(matchingQuestion);
  const directCommand = /\b(navigate me|take me|go to|open|show me|bring me to|navigate to|register|sign up|create (?:an )?account|choose|select|edit (?:my )?profile|update (?:my )?profile|change (?:my )?profile)\b|मुझे.{0,15}(ले चलो|खोलो|दिखाओ)|सीधे.{0,10}(जाओ|खोलो)/i.test(question)
    || /\b(open|go to|show me|take me to|how to)\b/i.test(matchingQuestion);
  const asksForAccess = /\b(where can i|where is|access|find|view|check|upload|details on|tell me about)\b|कहाँ|कहां/i.test(matchingQuestion);
  if (asksForGuidance) return { target, mode: 'guide' };
  if (!directCommand && !asksForAccess) return null;
  return { target, mode: directCommand ? 'navigate' : 'offer' };
}

export function resolveContextualWebsiteGuide(
  question: string,
  pageContext?: string,
): WebsiteNavigationAction | null {
  const target = pageContext ? PAGE_CONTEXT_TARGETS[pageContext] : undefined;
  if (!target) return null;

  const matchingQuestion = normalizeSpokenWebsiteCommand(question);
  const asksForSteps = asksForWebsiteGuidance(matchingQuestion);
  const refersToCurrentPage = /\b(this|that|these|those|it|here|form|page|screen|field|checkbox|button)\b|इस|यह|ये|यहाँ|पेज|फॉर्म|फील्ड|बटन/iu.test(matchingQuestion);
  const asksAboutAControl = /\b(fill|enter|select|choose|upload|submit|run|scan|complete|use|checkbox|field|button)\b|भर|दर्ज|चुन|अपलोड|जमा|चलाएँ|स्कैन|इस्तेमाल|उपयोग/iu.test(matchingQuestion);
  if (!asksForSteps || (!refersToCurrentPage && !asksAboutAControl)) return null;
  return { target, mode: 'guide', alreadyOnPage: true };
}

export async function retrieveWebsiteEvidence(query: string, topK = 5, documentId?: string): Promise<WebsiteRagEvidence[]> {
  const baseUrl = (process.env.PRAGATI_AI_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/rag/website/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: Math.max(1, Math.min(topK, 10)), ...(documentId ? { document_id: documentId } : {}) }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Website RAG bridge returned ${response.status}`);
  const payload = await response.json() as WebsiteRagResponse;
  return (payload.results || []).filter((item) =>
    item.review_status === 'draft'
    && Number.isFinite(item.distance)
    && (documentId || item.distance <= MAX_DISTANCE)
    && typeof item.text === 'string'
    && item.text.trim().length > 0,
  );
}
