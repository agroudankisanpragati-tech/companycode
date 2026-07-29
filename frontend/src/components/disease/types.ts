// Maps to DiseaseRecommendation (scan result) enriched from Disease & Pest Management
export type ScanResult = {
  // Core identity
  _id?: string;
  knowledgeBaseId?: string;
  cropName: string;
  cropNameHindi?: string;
  diseaseName: string;
  diseaseNameHindi?: string;
  scientificName?: string;
  diseaseType: string;
  cropCategory?: string;

  // Prediction metadata
  confidenceScore?: number;
  similarityScore?: number;
  source?: 'cache' | 'knowledge_base' | 'ai' | string;
  imageUrl?: string;
  createdAt?: string;

  // Severity
  severityLevel: string;
  affectedPlantPart?: string;

  // Description — stored as { en, hi } object OR legacy plain string
  description: any;
  descriptionHindi?: string;

  // Symptoms — { en, hi } object OR legacy plain string
  symptoms?: any;
  symptomsHindi?: string;
  leafSymptoms?: string;
  stemSymptoms?: string;
  rootSymptoms?: string;
  fruitSymptoms?: string;
  symptomsDescription?: string;

  // Cause & spread
  causes?: string;
  diseaseCause?: string;
  spreadPattern?: string;
  earlyWarningSigns?: string;
  weatherConditions?: string;
  highRiskConditions?: string;
  suitableClimate?: string;

  // Organic treatment — { en, hi } object OR legacy plain string
  organicSolution?: any;
  organicTreatment?: any;
  organicTreatmentHindi?: string;
  preparationMethod?: string;
  usageInstructions?: string;
  frequency?: string;
  safetyNotes?: string;

  // Chemical treatment — { en, hi } object OR legacy plain string
  chemicalSolution?: any;
  chemicalTreatment?: any;
  chemicalTreatmentHindi?: string;
  treatmentDescription?: any;
  treatment?: any;
  chemicalName?: string;
  activeIngredient?: string;
  dosage?: string;
  mixingMethod?: string;
  sprayTiming?: string;
  sprayInterval?: string;
  waitingPeriod?: string;
  safetyInstructions?: string;
  protectiveEquipment?: string;
  applicationMethod?: string;
  precautions?: string;

  // Prevention — { en, hi } object OR legacy plain string
  prevention?: any;
  preventionHindi?: string;
  preventionMethods?: any;
  preventionDescription?: any;
  beforeDisease?: string;
  duringDisease?: string;
  afterRecovery?: string;

  // Actions — { en, hi } object OR legacy plain string
  recommendedActions?: any;
  recommendedActionsHindi?: string;

  // Knowledge base enrichment — { en, hi } objects OR legacy plain strings
  recommendedProducts?: any;
  farmerAdvice?: any;
  urgentPrevention?: any;
  recoveryTips?: any;
  dos?: any;
  donts?: any;
  governmentAdvisory?: string;
  referenceLinks?: string[];

  // Farmer guidance
  bestTimeToSpray?: string;
  weatherWarning?: string;
  waterRequirement?: string;
  cropCareTips?: string;
  recoveryTime?: string;
  suitableWeather?: string;
  farmingPractices?: string;
  importantNotes?: string;

  // Related diseases
  relatedDiseases?: string;

  // FAQs
  faqs?: string;

  // Nearby shop (optional, from backend)
  nearbyShop?: {
    name?: string;
    distance?: string;
    phone?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };

  // Media
  diseaseImages?: string[];
  healthyImages?: string[];
  imageGallery?: string[];
  videoLinks?: string[];

  // Tags
  tags?: string[];

  // Feedback
  feedback?: 'helpful' | 'not_helpful' | null;

  crop_mismatch_warning?: string | null;
};

export type HistoryItem = ScanResult & { createdAt: string };

// ─── Language picker ──────────────────────────────────────────────────────────
// Resolves { en, hi } objects OR legacy plain strings.
// Rule: langCode === 'en' → .en  |  anything else → .hi (fallback to .en)
// Never translates. Never mixes. Reads exactly what is stored in MongoDB.
export function pickField(field: any, langCode: string): string {
  if (!field) return '';
  if (typeof field === 'string') return field;         // legacy plain string
  if (typeof field !== 'object') return String(field);
  if (langCode === 'en') return field.en || '';
  return field.hi || field.en || '';                   // non-English → hi, fallback en
}

// ─── Field resolvers — language-aware, handle both old and new schema ─────────

export function resolveSymptoms(r: ScanResult, langCode = 'en'): string {
  const main = pickField(r.symptoms, langCode);
  if (main) return main;
  // Legacy fallback fields (always plain English strings)
  return [r.symptomsDescription, r.leafSymptoms, r.stemSymptoms, r.rootSymptoms, r.fruitSymptoms]
    .filter(Boolean).join('\n') || '';
}

export function resolveOrganic(r: ScanResult, langCode = 'en'): string {
  return pickField(r.organicSolution, langCode) || pickField(r.organicTreatment, langCode) || '';
}

export function resolveChemical(r: ScanResult, langCode = 'en'): string {
  return (
    pickField(r.chemicalSolution, langCode) ||
    pickField(r.chemicalTreatment, langCode) ||
    pickField(r.treatmentDescription, langCode) ||
    pickField(r.treatment, langCode) ||
    ''
  );
}

export function resolvePrevention(r: ScanResult, langCode = 'en'): string {
  return (
    pickField(r.prevention, langCode) ||
    pickField(r.preventionMethods, langCode) ||
    pickField(r.preventionDescription, langCode) ||
    ''
  );
}

export function resolveCauses(r: ScanResult): string {
  return r.causes || r.diseaseCause || '';
}
