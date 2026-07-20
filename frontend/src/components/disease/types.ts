// Maps to DiseaseRecommendation (scan result) + DiseaseKnowledgeBase (enriched KB)
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

  // Description
  description: string;
  descriptionHindi?: string;

  // Symptoms — new + legacy fields
  symptoms?: string;
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

  // Organic treatment — new + legacy
  organicSolution?: string;
  organicTreatment?: string;
  organicTreatmentHindi?: string;
  preparationMethod?: string;
  usageInstructions?: string;
  frequency?: string;
  safetyNotes?: string;

  // Chemical treatment — new + legacy
  chemicalSolution?: string;
  chemicalTreatment?: string;
  chemicalTreatmentHindi?: string;
  treatmentDescription?: string;
  treatment?: string;
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

  // Prevention — new + legacy
  prevention?: string;
  preventionHindi?: string;
  preventionMethods?: string;
  preventionDescription?: string;
  beforeDisease?: string;
  duringDisease?: string;
  afterRecovery?: string;

  // Actions
  recommendedActions?: string;
  recommendedActionsHindi?: string;

  // Knowledge base enrichment
  recommendedProducts?: string;
  farmerAdvice?: string;
  urgentPrevention?: string;
  recoveryTips?: string;
  dos?: string;
  donts?: string;
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
};

export type HistoryItem = ScanResult & { createdAt: string };

// ─── Field resolvers — handle both old and new schema ─────────────────────────

export function resolveSymptoms(r: ScanResult): string {
  return [r.symptoms, r.symptomsDescription, r.leafSymptoms, r.stemSymptoms, r.rootSymptoms, r.fruitSymptoms]
    .filter(Boolean).join('\n') || '';
}

export function resolveOrganic(r: ScanResult): string {
  return r.organicSolution || r.organicTreatment || '';
}

export function resolveChemical(r: ScanResult): string {
  return r.chemicalSolution || r.chemicalTreatment || r.treatmentDescription || r.treatment || '';
}

export function resolvePrevention(r: ScanResult): string {
  return r.prevention || r.preventionMethods || r.preventionDescription || '';
}

export function resolveCauses(r: ScanResult): string {
  return r.causes || r.diseaseCause || '';
}
