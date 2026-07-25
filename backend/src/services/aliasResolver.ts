/**
 * Unified Alias Resolver
 *
 * Single source of truth for alias → canonical English mapping.
 * Replaces the fragmented alias logic that previously existed in:
 *   - aliasNormalizer.ts  (TypeScript, in-memory)
 *   - intent_alias_resolver.py (Python, separate table)
 *
 * Rules:
 *   1. Exact full-message match → return canonical immediately
 *   2. Whole-word substring match (word boundary aware) → append canonical
 *   3. No match → return original unchanged
 *
 * The false-positive bug from aliasNormalizer.ts is fixed:
 *   OLD: alias.length >= 4 && normalized.includes(alias)
 *        → "rate" matched inside "irrigate", "moderate"
 *   NEW: whole-word boundary check prevents partial-word matches
 *
 * Performance: <5ms — pure in-memory, zero DB calls.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('aliasResolver');

// ─── Alias table ──────────────────────────────────────────────────────────────
// Maps normalised alias → canonical English term used by intent engine + agents.
// Covers: Hindi, English, Hinglish, Marwari, Rajasthani, common misspellings.

const ALIAS_TABLE: Record<string, string> = {

  // ── Greeting ──────────────────────────────────────────────────────────────
  namaste: 'hello', namaskar: 'hello', namastey: 'hello', namasthe: 'hello',
  'ram ram': 'hello', 'ram ram sa': 'hello', 'jai shree ram': 'hello',
  'khamma ghani': 'hello', 'kem cho': 'hello', 'sat sri akal': 'hello',
  suprabhat: 'hello', 'shubh prabhat': 'hello', adaab: 'hello',
  salaam: 'hello', vanakkam: 'hello', pranam: 'hello', pranaam: 'hello',
  'good morning': 'hello', 'good evening': 'hello', 'good night': 'hello',

  // ── Disease ───────────────────────────────────────────────────────────────
  rog: 'disease', bimari: 'disease', bimaari: 'disease',
  keeda: 'pest disease', kida: 'pest disease', kide: 'pest disease',
  jhulsa: 'blight disease', jhulsan: 'blight disease',
  'patta peela': 'yellow leaf disease', 'patta pila': 'yellow leaf disease',
  'patta brown': 'brown leaf disease',
  dhabbe: 'leaf spot disease', dhaba: 'leaf spot disease',
  ilaj: 'disease treatment', ilaaj: 'disease treatment',
  dawai: 'disease medicine', dawa: 'disease medicine',
  upchar: 'disease treatment', upay: 'disease remedy',
  'organic upay': 'organic disease treatment',
  'jaivik upay': 'organic disease treatment',

  // ── Weather ───────────────────────────────────────────────────────────────
  mosam: 'weather', mausam: 'weather',
  barish: 'rain weather', baarish: 'rain weather',
  garmi: 'hot weather temperature', sardi: 'cold weather temperature',
  thand: 'cold weather frost', pala: 'frost weather',
  aandhi: 'storm weather wind', toofan: 'storm weather',
  badal: 'cloud weather', dhoop: 'sunny weather',
  aardrata: 'humidity weather', tapman: 'temperature weather',
  kohra: 'fog weather', dhund: 'fog weather',

  // ── Government ────────────────────────────────────────────────────────────
  yojna: 'government scheme', yojana: 'government scheme',
  pmkisan: 'PM-KISAN government scheme', 'pm kisan': 'PM-KISAN government scheme',
  kcc: 'Kisan Credit Card government scheme',
  pmfby: 'PMFBY crop insurance government scheme',
  'fasal bima': 'crop insurance government scheme',
  subsidy: 'government subsidy scheme', anudan: 'government subsidy scheme',
  loan: 'government loan scheme', rin: 'government loan scheme',
  bima: 'insurance government scheme',
  sarkar: 'government scheme', sarkari: 'government scheme',
  enam: 'eNAM market government scheme',
  'soil health card': 'soil health card government scheme',
  'mitti card': 'soil health card government scheme',

  // ── Market ────────────────────────────────────────────────────────────────
  mandi: 'mandi market price', 'mandi bhav': 'mandi market price',
  bhav: 'market price', bhaav: 'market price',
  mandibhav: 'mandi market price',
  bechna: 'sell market', becho: 'sell market',
  kharido: 'buy market',
  anaj: 'grain market price',
  modal: 'modal price market',
  bajar: 'market price', bazar: 'market price',

  // ── Crop ──────────────────────────────────────────────────────────────────
  fasal: 'crop', fasalon: 'crops',
  kheti: 'farming crop', krishi: 'agriculture crop',
  buwai: 'sowing crop', katai: 'harvest crop',
  ugao: 'grow crop', paidavar: 'crop yield',
  kism: 'crop variety',

  // ── Soil ──────────────────────────────────────────────────────────────────
  mitti: 'soil', 'mitti jach': 'soil test', 'mitti test': 'soil test',
  naijrogen: 'soil nitrogen',
  jaivik: 'organic soil',

  // ── Fertilizer ────────────────────────────────────────────────────────────
  khad: 'fertilizer', khaad: 'fertilizer',
  urea: 'urea fertilizer', dap: 'DAP fertilizer', npk: 'NPK fertilizer',

  // ── Seed ──────────────────────────────────────────────────────────────────
  beej: 'seed', bij: 'seed',
  nursery: 'nursery seed', paudha: 'seedling nursery',

  // ── Machinery ─────────────────────────────────────────────────────────────
  yantra: 'machinery equipment',

  // ── Irrigation ────────────────────────────────────────────────────────────
  pani: 'water irrigation', sinchai: 'irrigation',
  naali: 'canal irrigation', boring: 'borewell irrigation',
  kuan: 'well irrigation', nalkoop: 'tubewell irrigation',

  // ── Emergency ─────────────────────────────────────────────────────────────
  urgent: 'emergency urgent', sos: 'emergency SOS',
  bachao: 'emergency help', 'madad karo': 'emergency help',
  'fasal kharab': 'emergency crop damage',
  nuksaan: 'emergency crop damage loss',
  barbaad: 'emergency crop damage loss',
};

// ─── Normalise helper ─────────────────────────────────────────────────────────

function normalise(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Whole-word boundary check ────────────────────────────────────────────────
// Prevents "rate" from matching inside "irrigate" or "moderate".

function containsWholeWord(text: string, word: string): boolean {
  // Escape special regex chars in the word
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|[\\s,।.!?;:])${escaped}(?:[\\s,।.!?;:]|$)`, 'i');
  return pattern.test(text);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AliasResolveResult {
  matched:   boolean;
  alias:     string;
  canonical: string;
}

/**
 * Resolve a raw user message against the unified alias table.
 *
 * Returns:
 *   matched=true  → alias and canonical term found
 *   matched=false → no alias match, original message unchanged
 */
export function resolveAlias(raw: string): AliasResolveResult {
  if (!raw?.trim()) {
    return { matched: false, alias: '', canonical: raw };
  }

  const normed = normalise(raw);

  // 1. Exact full-message match (fastest path)
  if (ALIAS_TABLE[normed]) {
    return { matched: true, alias: normed, canonical: ALIAS_TABLE[normed] };
  }

  // 2. Whole-word match — sorted longest-first to prefer specific matches
  const keys = Object.keys(ALIAS_TABLE).sort((a, b) => b.length - a.length);
  for (const alias of keys) {
    if (alias.length < 3) continue; // skip single-char noise
    if (containsWholeWord(normed, alias)) {
      return { matched: true, alias, canonical: ALIAS_TABLE[alias] };
    }
  }

  return { matched: false, alias: '', canonical: raw };
}

/**
 * Prepare a message for intent detection.
 * If an alias is matched, appends the canonical term so the intent engine
 * sees both the original context and the canonical English form.
 * The original message is preserved — no destructive replacement.
 */
export function prepareForIntentDetection(raw: string): string {
  if (!raw?.trim()) return raw;

  const result = resolveAlias(raw);
  if (!result.matched) return raw;

  // If canonical is already present in the message, no need to append
  if (normalise(raw).includes(normalise(result.canonical))) return raw;

  return `${raw} ${result.canonical}`;
}

/**
 * Get all aliases registered for a given domain keyword (for diagnostics).
 */
export function getAliasesForDomain(domain: string): string[] {
  const lower = domain.toLowerCase();
  return Object.entries(ALIAS_TABLE)
    .filter(([, v]) => v.toLowerCase().includes(lower))
    .map(([k]) => k);
}

log.debug('Alias resolver loaded', { aliasCount: Object.keys(ALIAS_TABLE).length });
