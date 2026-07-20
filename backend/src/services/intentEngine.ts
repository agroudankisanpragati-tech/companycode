/**
 * Intent Engine
 *
 * Classifies user messages into one of the defined intent types.
 * Pure function — no DB, no AI call, no side effects.
 * Used by the Root AI chat handler to route context correctly.
 *
 * Intent types:
 *   disease | crop | soil | weather | market | government | kvk |
 *   navigation | voice_command | general
 */

export type IntentType =
  | 'greeting'
  | 'disease'
  | 'crop'
  | 'soil'
  | 'weather'
  | 'market'
  | 'government'
  | 'kvk'
  | 'irrigation'
  | 'machinery'
  | 'emergency'
  | 'navigation'
  | 'voice_command'
  | 'general';

interface IntentRule {
  intent: IntentType;
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'greeting',
    patterns: [
      /\b(hello|hi|hey|hii|helo|howdy|greetings|good\s*(morning|afternoon|evening|night))\b/i,
      /\b(namaste|namaskar|namaskara|namastey|namasthe)\b/i,
      /\b(ram\s*ram|jai\s*shree?\s*ram|jai\s*shri\s*krishna|radhe\s*radhe|khamma\s*ghani|sat\s*sri\s*akal|sasriyakal|adaab|salaam|vanakkam|nomoshkar|pranam|pranaam)\b/i,
      /\b(suprabhat|shubh\s*prabhat|shubh\s*din|kya\s*haal|kaise\s*ho|kaisa\s*hai)\b/i,
    ],
  },
  {
    intent: 'soil',
    patterns: [
      /\bsoil\b|mitti|\bph\b|\bnitrogen\b|\bphosphorus\b|\bpotassium\b|fertilizer|khad|urea|dap|npk|organic|compost|health.*report|soil.*health|deficien/i,
      /मिट्टी|खाद|यूरिया|डीएपी|जैविक|कम्पोस्ट|स्वास्थ्य/,
    ],
  },
  {
    intent: 'disease',
    patterns: [
      /disease|bimari|rog|infection|fungus|pest|insect|kida|jhulsa|\brust\b|blight|\bwilt\b|\brot\b|mildew|symptom|\bleaf\b|patta|\byellow\b|\bbrown\b|\bspot\b|scan|detect|diagnos/i,
      /बीमारी|रोग|कीड़ा|झुलसा|पत्ती|पीला|भूरा|धब्बा|संक्रमण/,
    ],
  },
  {
    intent: 'crop',
    patterns: [
      /crop|fasal|kheti|seed|beej|sow|plant|harvest|katai|buwai|variety|kism|recommend|suggest|grow|ugao|yield|paidavar/i,
      /फसल|खेती|बीज|बुवाई|कटाई|किस्म|उगाओ|पैदावार/,
    ],
  },
  {
    intent: 'weather',
    patterns: [
      /weather|mausam|rain|barish|temperature|tapman|humidity|aardrata|forecast|wind|hawa|drought|flood|frost|pala/i,
      /मौसम|बारिश|तापमान|आर्द्रता|पूर्वानुमान|हवा|सूखा|बाढ़|पाला/,
    ],
  },
  {
    intent: 'market',
    patterns: [
      /price|bhav|mandi|market|rate|sell|becho|buy|kharido|modal|minimum|maximum|commodity|grain|anaj/i,
      /भाव|मंडी|बाजार|दर|बेचो|खरीदो|अनाज/,
    ],
  },
  {
    intent: 'government',
    patterns: [
      /scheme|yojana|yojna|subsidy|anudan|pm.kisan|kcc|pmfby|loan|rin|insurance|bima|government|sarkar|benefit|labh|eligib|apply|form/i,
      /योजना|सब्सिडी|अनुदान|ऋण|बीमा|सरकार|लाभ|पात्रता|आवेदन/,
    ],
  },
  {
    intent: 'kvk',
    patterns: [
      /kvk|krishi vigyan|kendra|center|training|prashikshan|nearest|nazdik|soil test|seed distribut/i,
      /कृषि विज्ञान केंद्र|प्रशिक्षण|नजदीक/,
    ],
  },
  {
    intent: 'navigation',
    patterns: [
      /go to|open|navigate|kahan|where is|kaise jaun|show me|le jao|page|section|feature|dashboard/i,
      /कहाँ|कैसे जाऊं|दिखाओ|ले जाओ/,
    ],
  },
  {
    intent: 'irrigation',
    patterns: [
      /irrigation|sinchai|drip|sprinkler|pani|water.*crop|crop.*water|nalkoop|boring|kuan|naali|canal|pump|moisture|nami/i,
      /सिंचाई|पानी|ड्रिप|स्प्रिंकलर|नमी|नलकूप/,
    ],
  },
  {
    intent: 'machinery',
    patterns: [
      /tractor|sprayer|rotavator|thresher|harvester|machine|yantra|equipment|pump.*engine|engine.*pump|reaper|cultivator/i,
      /ट्रैक्टर|स्प्रेयर|रोटावेटर|थ्रेशर|मशीन|यंत्र/,
    ],
  },
  {
    intent: 'emergency',
    patterns: [
      /emergency|urgent|sos|help.*fasal|fasal.*kharab|crop.*damage|damage.*crop|bachao|madad.*karo|nuksaan|barbaad|flood.*crop|fire.*crop|hail|olavristi/i,
      /आपातकाल|जरूरी|मदद|फसल खराब|नुकसान|बर्बाद|बचाओ/,
    ],
  },
  {
    intent: 'voice_command',
    patterns: [
      /^(stop|pause|resume|play|repeat|louder|softer|mute|unmute|read|sun|ruk|chalu|band|dobara)/i,
    ],
  },
];

/**
 * Detect the primary intent from a user message.
 * Returns 'general' if no specific intent matches.
 */
export function detectIntent(message: string): IntentType {
  if (!message?.trim()) return 'general';
  for (const { intent, patterns } of INTENT_RULES) {
    if (patterns.some(p => p.test(message))) return intent;
  }
  return 'general';
}

/**
 * Returns the page context that best matches a given intent.
 * Used to cross-validate: if intent doesn't match page context, AI is warned.
 */
export function intentToPageContext(intent: IntentType): string {
  const map: Record<IntentType, string> = {
    greeting:      'ui',
    disease:       'disease',
    crop:          'crop',
    soil:          'soil',
    weather:       'weather',
    market:        'market',
    government:    'government',
    kvk:           'kvk',
    irrigation:    'ui',
    machinery:     'ui',
    emergency:     'ui',
    navigation:    'ui',
    voice_command: 'ui',
    general:       'ui',
  };
  return map[intent];
}

/**
 * Returns a human-readable label for an intent type.
 */
export function intentLabel(intent: IntentType): string {
  const labels: Record<IntentType, string> = {
    greeting:      'Greeting',
    disease:       'Disease Detection',
    crop:          'Crop Advisory',
    soil:          'Soil Health',
    weather:       'Weather',
    market:        'Market Prices',
    government:    'Government Schemes',
    kvk:           'KVK Centers',
    irrigation:    'Irrigation',
    machinery:     'Machinery',
    emergency:     'Emergency',
    navigation:    'Navigation',
    voice_command: 'Voice Command',
    general:       'General',
  };
  return labels[intent];
}
