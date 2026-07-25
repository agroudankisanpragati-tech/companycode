/**
 * Entity Extractor — Shared Service
 *
 * Single source of truth for all entity extraction across every agent.
 * Replaces the 7+ independent extractCropFromMessage / extractCommodityFromMessage
 * / extractDiseaseFromMessage functions that previously lived inside each agent.
 *
 * Supports:
 *   crop, commodity, disease, pest, scheme, state, district,
 *   season, machinery, fertilizer, weather, language
 *
 * All lookups are case-insensitive and support:
 *   - English names
 *   - Hindi / Hinglish romanised names
 *   - Marwari / Rajasthani variants
 *   - Common farmer misspellings
 *
 * Returns a single ExtractedEntities object — agents read from it,
 * they never re-parse the raw message.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedEntities {
  crop:       string;   // canonical English crop name or ''
  commodity:  string;   // canonical English commodity name or ''
  disease:    string;   // disease/pest name or ''
  pest:       string;   // pest name or ''
  scheme:     string;   // scheme keyword or ''
  state:      string;   // state name or ''
  district:   string;   // district name or ''
  village:    string;   // village name or ''
  season:     string;   // 'Kharif' | 'Rabi' | 'Zaid' | ''
  machinery:  string;   // machine type or ''
  fertilizer: string;   // fertilizer type or ''
  weather:    string;   // weather keyword or ''
  language:   string;   // detected language hint or ''
  irrigation: string;   // irrigation type or ''
  emergency:  string;   // emergency category or ''
  rawMessage: string;   // original message preserved
}

// ─── Crop / Commodity table ───────────────────────────────────────────────────
// Maps every known alias → canonical English name.
// Commodity and crop share the same table because they overlap heavily.

const CROP_ALIAS_MAP: Record<string, string> = {
  // ── Wheat ──
  wheat: 'wheat', gehu: 'wheat', gehun: 'wheat', gahu: 'wheat',
  gehum: 'wheat', gehu_ki_fasal: 'wheat',

  // ── Rice / Paddy ──
  rice: 'rice', paddy: 'rice', dhan: 'rice', chawal: 'rice',
  dhaan: 'rice', bhat: 'rice',

  // ── Maize / Corn ──
  maize: 'maize', corn: 'maize', makka: 'maize', makkai: 'maize',
  corn_maize: 'maize', bhutta: 'maize',

  // ── Cotton ──
  cotton: 'cotton', kapas: 'cotton', narma: 'cotton', karpas: 'cotton',

  // ── Sugarcane ──
  sugarcane: 'sugarcane', ganna: 'sugarcane', ikhu: 'sugarcane',
  ikh: 'sugarcane',

  // ── Mustard ──
  mustard: 'mustard', sarson: 'mustard', rai: 'mustard',
  sarso: 'mustard', toria: 'mustard',

  // ── Soybean ──
  soybean: 'soybean', soya: 'soybean', soyabean: 'soybean',
  bhatmas: 'soybean',

  // ── Groundnut ──
  groundnut: 'groundnut', mungfali: 'groundnut', moongfali: 'groundnut',
  peanut: 'groundnut',

  // ── Gram / Chickpea ──
  gram: 'gram', chana: 'gram', chane: 'gram', chickpea: 'gram',
  bengal_gram: 'gram',

  // ── Moong / Green gram ──
  moong: 'moong', mung: 'moong', green_gram: 'moong', mungbean: 'moong',

  // ── Urad / Black gram ──
  urad: 'urad', udad: 'urad', black_gram: 'urad', urd: 'urad',

  // ── Arhar / Pigeon pea ──
  arhar: 'arhar', tur: 'arhar', toor: 'arhar', pigeon_pea: 'arhar',
  lal_arhar: 'arhar',

  // ── Masoor / Lentil ──
  masoor: 'masoor', lentil: 'masoor', lal_masoor: 'masoor',

  // ── Bajra / Pearl millet ──
  bajra: 'bajra', pearl_millet: 'bajra', bajri: 'bajra',

  // ── Jowar / Sorghum ──
  jowar: 'jowar', sorghum: 'jowar', jwar: 'jowar',

  // ── Sunflower ──
  sunflower: 'sunflower', surajmukhi: 'sunflower',

  // ── Potato ──
  potato: 'potato', aloo: 'potato', alu: 'potato',

  // ── Onion ──
  onion: 'onion', pyaz: 'onion', pyaaz: 'onion', kanda: 'onion',

  // ── Tomato ──
  tomato: 'tomato', tamatar: 'tomato', tamaatar: 'tomato',

  // ── Chilli ──
  chilli: 'chilli', mirch: 'chilli', lal_mirch: 'chilli', chili: 'chilli',

  // ── Brinjal ──
  brinjal: 'brinjal', baingan: 'brinjal', eggplant: 'brinjal',

  // ── Turmeric ──
  turmeric: 'turmeric', haldi: 'turmeric',

  // ── Ginger ──
  ginger: 'ginger', adrak: 'ginger',

  // ── Cucumber ──
  cucumber: 'cucumber', kheera: 'cucumber', kakdi: 'cucumber',

  // ── Pumpkin ──
  pumpkin: 'pumpkin', kaddu: 'pumpkin',

  // ── Garlic ──
  garlic: 'garlic', lahsun: 'garlic',
};

// ─── Disease table ────────────────────────────────────────────────────────────

const DISEASE_ALIAS_MAP: Record<string, string> = {
  blight: 'blight', jhulsa: 'blight', jhulsan: 'blight',
  rust: 'rust', zang: 'rust',
  wilt: 'wilt', murjhana: 'wilt',
  rot: 'rot', sadna: 'rot', galana: 'rot',
  mildew: 'mildew', powdery_mildew: 'powdery mildew',
  mosaic: 'mosaic', yellow_mosaic: 'yellow mosaic virus',
  leaf_spot: 'leaf spot', dhabbe: 'leaf spot', dhaba: 'leaf spot',
  bacterial: 'bacterial blight',
  fungus: 'fungal disease', phaphoond: 'fungal disease',
  virus: 'virus disease',
  blast: 'blast',
  tikka: 'tikka disease',
  smut: 'smut',
  downy_mildew: 'downy mildew',
  late_blight: 'late blight',
  early_blight: 'early blight',
};

// ─── Pest table ───────────────────────────────────────────────────────────────

const PEST_ALIAS_MAP: Record<string, string> = {
  aphid: 'aphid', maahu: 'aphid', mahu: 'aphid',
  whitefly: 'whitefly', safed_makhi: 'whitefly',
  stem_borer: 'stem borer', tana_borer: 'stem borer',
  caterpillar: 'caterpillar', sundi: 'caterpillar', illi: 'caterpillar',
  locust: 'locust', tiddi: 'locust',
  mite: 'mite', spider_mite: 'spider mite',
  thrips: 'thrips',
  jassid: 'jassid',
  bollworm: 'bollworm',
  nematode: 'nematode',
  grasshopper: 'grasshopper', tidda: 'grasshopper',
  keeda: 'pest', kida: 'pest', keet: 'pest',
};

// ─── Scheme table ─────────────────────────────────────────────────────────────

const SCHEME_ALIAS_MAP: Record<string, string> = {
  'pm-kisan': 'PM-KISAN', pmkisan: 'PM-KISAN', 'pm kisan': 'PM-KISAN',
  kcc: 'KCC', 'kisan credit card': 'KCC', 'kisan credit': 'KCC',
  pmfby: 'PMFBY', 'fasal bima': 'PMFBY', 'crop insurance': 'PMFBY',
  'soil health card': 'soil health card', 'mitti card': 'soil health card',
  enam: 'eNAM', 'e-nam': 'eNAM',
  subsidy: 'subsidy', anudan: 'subsidy',
  loan: 'loan', rin: 'loan', karz: 'loan',
  insurance: 'insurance', bima: 'insurance',
  yojana: 'scheme', yojna: 'scheme', scheme: 'scheme',
};

// ─── Season table ─────────────────────────────────────────────────────────────

const SEASON_MAP: Record<string, string> = {
  kharif: 'Kharif', monsoon: 'Kharif', rainy: 'Kharif', sawan: 'Kharif',
  rabi: 'Rabi', winter: 'Rabi', sardi: 'Rabi',
  zaid: 'Zaid', summer: 'Zaid', garmi: 'Zaid',
};

// ─── Machinery table ──────────────────────────────────────────────────────────

const MACHINERY_MAP: Record<string, string> = {
  tractor: 'tractor', trektar: 'tractor',
  sprayer: 'sprayer', chhidkav: 'sprayer',
  rotavator: 'rotavator', rotovator: 'rotavator',
  thresher: 'thresher',
  harvester: 'harvester', combine: 'harvester',
  reaper: 'reaper',
  cultivator: 'cultivator',
  pump: 'pump',
  plough: 'plough', hal: 'plough',
  drone: 'drone',
  transplanter: 'transplanter',
};

// ─── Fertilizer table ─────────────────────────────────────────────────────────

const FERTILIZER_MAP: Record<string, string> = {
  urea: 'urea',
  dap: 'DAP',
  npk: 'NPK',
  potash: 'potash', mop: 'potash',
  compost: 'compost', gobar_khad: 'compost',
  vermicompost: 'vermicompost',
  organic: 'organic',
  micronutrient: 'micronutrient',
  zinc: 'zinc',
  boron: 'boron',
  iron: 'iron',
  sulphur: 'sulphur',
  khad: 'fertilizer', khaad: 'fertilizer',
};

// ─── Irrigation table ─────────────────────────────────────────────────────────

const IRRIGATION_MAP: Record<string, string> = {
  drip: 'drip', 'drip irrigation': 'drip',
  sprinkler: 'sprinkler',
  flood: 'flood',
  furrow: 'furrow',
  surface: 'surface',
  subsurface: 'subsurface',
  canal: 'canal', nahar: 'canal',
  borewell: 'borewell', boring: 'borewell', nalkoop: 'borewell',
  well: 'well', kuan: 'well',
};

// ─── State table (major Indian states) ───────────────────────────────────────

const STATE_MAP: Record<string, string> = {
  rajasthan: 'Rajasthan', raj: 'Rajasthan',
  'uttar pradesh': 'Uttar Pradesh', up: 'Uttar Pradesh',
  'madhya pradesh': 'Madhya Pradesh', mp: 'Madhya Pradesh',
  maharashtra: 'Maharashtra',
  punjab: 'Punjab',
  haryana: 'Haryana',
  gujarat: 'Gujarat',
  bihar: 'Bihar',
  'west bengal': 'West Bengal',
  odisha: 'Odisha',
  telangana: 'Telangana',
  'andhra pradesh': 'Andhra Pradesh', ap: 'Andhra Pradesh',
  karnataka: 'Karnataka',
  'tamil nadu': 'Tamil Nadu',
  kerala: 'Kerala',
  assam: 'Assam',
  jharkhand: 'Jharkhand',
  chhattisgarh: 'Chhattisgarh',
  uttarakhand: 'Uttarakhand',
  himachal: 'Himachal Pradesh',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s_\-।,!?.]+/g, ' ').trim();
}

/**
 * Scan a normalised message for the first matching key in a lookup map.
 * Returns the canonical value or ''.
 */
function findInMap(msg: string, map: Record<string, string>): string {
  // Sort keys longest-first so "yellow mosaic" matches before "mosaic"
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (msg.includes(key)) return map[key];
  }
  return '';
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Extract all entities from a raw user message in a single pass.
 * Called once per request in pragatiAIController and stored on ctx.entities.
 * Every agent reads from ctx.entities — no agent re-parses the message.
 */
export function extractEntities(rawMessage: string): ExtractedEntities {
  if (!rawMessage?.trim()) {
    return {
      crop: '', commodity: '', disease: '', pest: '', scheme: '',
      state: '', district: '', village: '', season: '', machinery: '', fertilizer: '',
      weather: '', language: '', irrigation: '', emergency: '', rawMessage: rawMessage || '',
    };
  }

  const msg = normalise(rawMessage);

  const crop       = findInMap(msg, CROP_ALIAS_MAP);
  const commodity  = crop; // commodity and crop share the same table
  const disease    = findInMap(msg, DISEASE_ALIAS_MAP);
  const pest       = findInMap(msg, PEST_ALIAS_MAP);
  const scheme     = findInMap(msg, SCHEME_ALIAS_MAP);
  const state      = findInMap(msg, STATE_MAP);
  const season     = findInMap(msg, SEASON_MAP);
  const machinery  = findInMap(msg, MACHINERY_MAP);
  const fertilizer = findInMap(msg, FERTILIZER_MAP);
  const irrigation = findInMap(msg, IRRIGATION_MAP);

  // District: simple heuristic — word after "district" or "jila"
  let district = '';
  const districtMatch = msg.match(/(?:district|jila|zila)\s+([a-z]+)/i);
  if (districtMatch?.[1]) district = districtMatch[1];

  // Village: simple heuristic — word after "village" or "gaon"
  let village = '';
  const villageMatch = msg.match(/(?:village|gaon|gram)\s+([a-z]+)/i);
  if (villageMatch?.[1]) village = villageMatch[1];

  // Weather keyword
  const weatherKeywords = ['weather', 'mausam', 'barish', 'rain', 'temperature', 'tapman', 'humidity', 'forecast'];
  const weather = weatherKeywords.find(w => msg.includes(w)) || '';

  const emergencyKeywords = [
    ['poison', 'poison'],
    ['toxic', 'poison'],
    ['pesticide', 'poison'],
    ['flood', 'flood'],
    ['waterlog', 'flood'],
    ['waterlogging', 'flood'],
    ['drought', 'flood'],
    ['pest', 'pest'],
    ['insect', 'pest'],
    ['locust', 'pest'],
    ['कीट', 'pest'],
    ['बाढ़', 'flood'],
    ['जलभराव', 'flood'],
    ['विष', 'poison'],
  ] as const;
  const emergency = emergencyKeywords.find(([needle]) => msg.includes(needle))?.[1] || '';

  // Language hint from script
  const hasDevanagari = /[\u0900-\u097F]/.test(rawMessage);
  const language = hasDevanagari ? 'hi' : 'en';

  return {
    crop, commodity, disease, pest, scheme,
    state, district, village, season, machinery, fertilizer,
    weather, language, irrigation, emergency, rawMessage,
  };
}
