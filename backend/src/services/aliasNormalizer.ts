/**
 * Alias Normalizer
 *
 * Fast in-memory alias dictionary for all farmer vocabulary.
 * Runs BEFORE detectIntent() to normalize raw input.
 *
 * Priority:
 *   1. Exact alias match → canonical English term
 *   2. Partial/substring match → canonical English term
 *   3. No match → return original (pass-through)
 *
 * Performance target: <5ms (pure in-memory, zero DB calls)
 *
 * Covers: greeting, disease, weather, government, market, crop,
 *         soil, fertilizer, seed, machinery, irrigation, emergency
 */

// ─── Alias map: normalized alias → canonical English ─────────────────────────

const ALIAS_MAP: Record<string, string> = {
  // ── Greeting ──────────────────────────────────────────────────────────────
  'hello':         'hello',
  'hi':            'hello',
  'hey':           'hello',
  'hii':           'hello',
  'helo':          'hello',
  'namaste':       'hello',
  'namaskar':      'hello',
  'namastey':      'hello',
  'ramram':        'hello',
  'ramramsa':      'hello',
  'ram ram':       'hello',
  'ram ram sa':    'hello',
  'khammaaghani':  'hello',
  'khamma ghani':  'hello',
  'kemcho':        'hello',
  'kem cho':       'hello',
  'satsriakal':    'hello',
  'sat sri akal':  'hello',
  'goodmorning':   'hello',
  'good morning':  'hello',
  'goodevening':   'hello',
  'good evening':  'hello',
  'suprabhat':     'hello',
  'shubhprabhat':  'hello',
  'adaab':         'hello',
  'salaam':        'hello',
  'vanakkam':      'hello',
  'pranam':        'hello',
  'pranaam':       'hello',

  // ── Disease ───────────────────────────────────────────────────────────────
  'rog':           'disease',
  'bimari':        'disease',
  'bimaari':       'disease',
  'keeda':         'pest',
  'kida':          'pest',
  'kide':          'pest',
  'pest':          'pest',
  'aphid':         'aphid pest',
  'virus':         'virus disease',
  'fungus':        'fungal disease',
  'jhulsa':        'blight disease',
  'pattijalna':    'leaf burn disease',
  'patta peela':   'yellow leaf disease',
  'patta pila':    'yellow leaf disease',
  'patta brown':   'brown leaf disease',
  'dhabbe':        'leaf spot disease',
  'dhaba':         'leaf spot disease',
  'ilaj':          'disease treatment',
  'ilaaj':         'disease treatment',
  'dawai':         'disease medicine',
  'dawa':          'disease medicine',
  'upchar':        'disease treatment',
  'upay':          'disease remedy',
  'organic upay':  'organic disease treatment',
  'jaivik upay':   'organic disease treatment',
  'rasaynik upay': 'chemical disease treatment',

  // ── Weather ───────────────────────────────────────────────────────────────
  'mosam':         'weather',
  'mausam':        'weather',
  'barish':        'rain weather',
  'baarish':       'rain weather',
  'rain':          'rain weather',
  'garmi':         'hot weather temperature',
  'sardi':         'cold weather temperature',
  'thand':         'cold weather frost',
  'pala':          'frost weather',
  'aandhi':        'storm weather wind',
  'toofan':        'storm weather',
  'badal':         'cloud weather',
  'dhoop':         'sunny weather',
  'humidity':      'humidity weather',
  'aardrata':      'humidity weather',
  'tapman':        'temperature weather',

  // ── Government ────────────────────────────────────────────────────────────
  'yojna':         'government scheme',
  'yojana':        'government scheme',
  'scheme':        'government scheme',
  'pmkisan':       'PM-KISAN government scheme',
  'pm kisan':      'PM-KISAN government scheme',
  'kcc':           'Kisan Credit Card government scheme',
  'kisancreditcard': 'Kisan Credit Card government scheme',
  'pmfby':         'PMFBY crop insurance government scheme',
  'fasalbima':     'crop insurance government scheme',
  'fasal bima':    'crop insurance government scheme',
  'subsidy':       'government subsidy scheme',
  'anudan':        'government subsidy scheme',
  'loan':          'government loan scheme',
  'rin':           'government loan scheme',
  'bima':          'insurance government scheme',
  'sarkar':        'government scheme',
  'sarkari':       'government scheme',
  'enam':          'eNAM market government scheme',
  'soilhealthcard': 'soil health card government scheme',
  'mitti card':    'soil health card government scheme',

  // ── Market ────────────────────────────────────────────────────────────────
  'mandi':         'mandi market price',
  'bhav':          'market price',
  'rate':          'market price rate',
  'price':         'market price',
  'bechna':        'sell market',
  'becho':         'sell market',
  'kharido':       'buy market',
  'anaj':          'grain market price',
  'modal':         'modal price market',
  'mandibhav':     'mandi market price',

  // ── Crop ──────────────────────────────────────────────────────────────────
  'fasal':         'crop',
  'fasalon':       'crops',
  'kheti':         'farming crop',
  'krishi':        'agriculture crop',
  'buwai':         'sowing crop',
  'katai':         'harvest crop',
  'ugao':          'grow crop',
  'paidavar':      'crop yield',
  'kism':          'crop variety',
  'variety':       'crop variety',

  // ── Soil ──────────────────────────────────────────────────────────────────
  'mitti':         'soil',
  'mittijach':     'soil test',
  'mitti jach':    'soil test',
  'ph':            'soil pH',
  'nitrogen':      'soil nitrogen',
  'naijrogen':     'soil nitrogen',
  'phosphorus':    'soil phosphorus',
  'potassium':     'soil potassium',
  'potash':        'soil potassium potash',
  'jaivik':        'organic soil',
  'compost':       'compost soil organic',
  'vermicompost':  'vermicompost soil organic',

  // ── Fertilizer ────────────────────────────────────────────────────────────
  'khad':          'fertilizer',
  'urea':          'urea fertilizer',
  'dap':           'DAP fertilizer',
  'npk':           'NPK fertilizer',
  'micronutrient': 'micronutrient fertilizer',
  'zinc':          'zinc fertilizer micronutrient',
  'boron':         'boron fertilizer micronutrient',

  // ── Seed ──────────────────────────────────────────────────────────────────
  'beej':          'seed',
  'bij':           'seed',
  'nursery':       'nursery seed',
  'paudha':        'seedling nursery',

  // ── Machinery ─────────────────────────────────────────────────────────────
  'tractor':       'tractor machinery',
  'sprayer':       'sprayer machinery',
  'rotavator':     'rotavator machinery',
  'thresher':      'thresher machinery',
  'harvester':     'harvester machinery',
  'pump':          'pump machinery irrigation',
  'yantra':        'machinery equipment',
  'machine':       'machinery',
  'equipment':     'machinery equipment',

  // ── Irrigation ────────────────────────────────────────────────────────────
  'pani':          'water irrigation',
  'sinchai':       'irrigation',
  'drip':          'drip irrigation',
  'sprinkler':     'sprinkler irrigation',
  'naali':         'canal irrigation',
  'boring':        'borewell irrigation',
  'kuan':          'well irrigation',
  'nalkoop':       'tubewell irrigation',

  // ── Emergency ─────────────────────────────────────────────────────────────
  'urgent':        'emergency urgent',
  'sos':           'emergency SOS',
  'bachao':        'emergency help',
  'madadkaro':     'emergency help',
  'madad karo':    'emergency help',
  'fasalkharab':   'emergency crop damage',
  'fasal kharab':  'emergency crop damage',
  'merifasalkharabhoagayi': 'emergency crop damage',
  'meri fasal kharab ho gayi': 'emergency crop damage',
  'nuksaan':       'emergency crop damage loss',
  'barbaad':       'emergency crop damage loss',
};

// ─── Normalize raw input key ──────────────────────────────────────────────────

function normalizeInput(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_\-।,!?.]+/g, '').trim();
}

// ─── Alias lookup result ──────────────────────────────────────────────────────

export interface AliasResult {
  matched:    boolean;
  alias:      string;
  canonical:  string;
  normalized: string;
}

/**
 * Normalize a raw user message using the in-memory alias dictionary.
 * Returns the canonical English form if matched, otherwise the original.
 *
 * Performance: <5ms (pure in-memory)
 */
export function normalizeAlias(raw: string): AliasResult {
  if (!raw?.trim()) {
    return { matched: false, alias: '', canonical: raw, normalized: raw };
  }

  const normalized = normalizeInput(raw);
  const noSpaceKey = normalizeKey(raw);

  // 1. Exact match on normalized (with spaces)
  if (ALIAS_MAP[normalized]) {
    return {
      matched:   true,
      alias:     normalized,
      canonical: ALIAS_MAP[normalized],
      normalized: ALIAS_MAP[normalized],
    };
  }

  // 2. Exact match on no-space key
  if (ALIAS_MAP[noSpaceKey]) {
    return {
      matched:   true,
      alias:     noSpaceKey,
      canonical: ALIAS_MAP[noSpaceKey],
      normalized: ALIAS_MAP[noSpaceKey],
    };
  }

  // 3. Check if any alias is a substring of the input (for multi-word messages)
  // Only check aliases that are >= 4 chars to avoid false positives
  for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
    if (alias.length >= 4 && normalized.includes(alias)) {
      return {
        matched:   true,
        alias,
        canonical,
        normalized: raw, // keep original for full context
      };
    }
  }

  return { matched: false, alias: '', canonical: raw, normalized: raw };
}

/**
 * Normalize a message for intent detection.
 * If an alias is matched, appends the canonical term to the original message
 * so the intent engine sees both the original and the canonical form.
 * This preserves full context while ensuring intent detection works.
 */
export function prepareForIntentDetection(raw: string): string {
  if (!raw?.trim()) return raw;

  const result = normalizeAlias(raw);
  if (!result.matched) return raw;

  // If the canonical is already in the message, no need to append
  const lower = raw.toLowerCase();
  if (lower.includes(result.canonical.toLowerCase())) return raw;

  // Append canonical term so intent engine can match it
  return `${raw} ${result.canonical}`;
}

/**
 * Get all aliases for a given domain (for logging/debugging).
 */
export function getAliasesForDomain(domain: string): string[] {
  return Object.entries(ALIAS_MAP)
    .filter(([, v]) => v.toLowerCase().includes(domain.toLowerCase()))
    .map(([k]) => k);
}
