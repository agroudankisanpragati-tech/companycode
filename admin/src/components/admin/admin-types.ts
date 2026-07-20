export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  verified?: boolean;
};

export type Overview = {
  totals: {
    users: number;
    admins: number;
    cropRecommendations: number;
    marketplaceListings: number;
    blogPosts: number;
    govtSchemes: number;
  };
  recentUsers: AdminUser[];
  recentRecommendations: Recommendation[];
  recentListings: Listing[];
};

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  farmSize?: number;
  location?: {
    state?: string;
    district?: string;
    village?: string;
  };
  role: 'farmer' | 'vendor' | 'admin';
  verified: boolean;
  isActive: boolean;
  points?: number;
  crops?: string[];
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserSummary = {
  total: number;
  farmers: number;
  admins: number;
  verified: number;
  active: number;
};

export type UserPagination = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type Recommendation = {
  _id: string;
  userId: string;
  crop: string;
  variety?: string;
  profitPotential?: number;
  waterRequirement?: string;
  marketDemand?: string;
  createdAt?: string;
};

export type Listing = {
  _id: string;
  sellerId: string;
  cropName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  location: {
    state: string;
    district: string;
  };
  status: 'available' | 'sold' | 'pending';
  organic?: boolean;
  createdAt?: string;
};

export type SchemeType = 'central' | 'state';

export type GovtScheme = {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  department: string;
  audience: string;
  benefits: string[];
  eligibility?: string;
  requiredDocuments?: string[];
  applicationProcess?: string;
  applicationLink?: string;
  officialLink?: string;
  coverImage?: string;
  images: string[];
  videos: string[];
  tags: string[];
  keywords: string[];
  schemeType: SchemeType;
  state?: string;
  status: 'draft' | 'published';
  source: 'admin' | 'api';
  createdBy?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CropCategory = 'Traditional' | 'Medicinal' | 'Fruit' | 'Vegetable';
export type LevelType = 'low' | 'medium' | 'high';

export type CropKnowledge = {
  _id: string;
  cropName: string;
  cropCategory: CropCategory;
  suitableSoilTypes: string[];
  minPH: number;
  maxPH: number;
  minRainfall: number;
  maxRainfall: number;
  minTemperature: number;
  maxTemperature: number;
  waterRequirement: LevelType;
  suitableSeasons: string[];
  suitableIrrigationTypes: string[];
  growingDuration: number;
  averageYield: number;
  averageMarketPrice: number;
  estimatedProfit: number;
  cultivationCost: number;
  riskLevel: LevelType;
  description: string;
  cultivationProcess: string;
  marketDemand: LevelType;
  farmingTypes: string[];
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  // AI-generated fields
  soilType?: string;
  soilPH?: number;
  waterAvailability?: string;
  district?: string;
  state?: string;
  season?: string;
  suitabilityScore?: number;
  aiRecommendation?: string;
  expectedYield?: string;
  marketPrice?: number;
  diseaseRisks?: string;
  sourceType?: 'AI' | 'Manual';
  source?: 'database' | 'openai' | 'admin';
  status?: 'active' | 'disabled' | 'archived';
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CropKnowledgeSummary = {
  total: number;
  traditional: number;
  medicinal: number;
  fruit: number;
  vegetable: number;
};

// ─── Disease Knowledge Base Types ───────────────────────────────────────────

export type DiseaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type KnowledgeStatus = 'draft' | 'published' | 'archived';

export type DiseaseRecord = {
  _id: string;
  cropName: string;
  diseaseName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseType: string;
  slug?: string;
  // Content
  description: string;
  symptoms?: string;
  causes?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  prevention?: string;
  // Legacy fields (kept for AI backward compat)
  leafSymptoms?: string;
  stemSymptoms?: string;
  rootSymptoms?: string;
  fruitSymptoms?: string;
  symptomsDescription?: string;
  organicTreatment?: string;
  chemicalTreatment?: string;
  treatmentDescription?: string;
  preventionMethods?: string;
  preventionDescription?: string;
  recommendedActions?: string;
  // Classification
  severityLevel: DiseaseSeverity;
  affectedPlantPart?: string;
  status: KnowledgeStatus;
  // Media
  diseaseImages: string[];
  healthyImages: string[];
  imageGallery: string[];
  videoLinks: string[];
  // Enrichment
  recommendedProducts?: string;
  governmentAdvisory?: string;
  referenceLinks: string[];
  // Meta
  languages: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DiseaseKnowledgeSummary = {
  totalRecords: number;
  totalCrops: number;
  totalDiseaseImages: number;
  totalHealthyImages: number;
  totalRecommendations: number;
};

// ─── Pest Knowledge Base Types ────────────────────────────────────────────────

export type PestRecord = {
  _id: string;
  cropName: string;
  pestName: string;
  scientificName?: string;
  slug?: string;
  description: string;
  symptoms?: string;
  damageSymptoms?: string;
  organicControl?: string;
  chemicalControl?: string;
  biologicalControl?: string;
  preventiveMeasures?: string;
  lifeCycle?: string;
  affectedPlantPart?: string;
  status: KnowledgeStatus;
  images: string[];
  videos: string[];
  recommendedProducts?: string;
  governmentAdvisory?: string;
  references: string[];
  languages: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PestKnowledgeSummary = {
  totalRecords: number;
  totalCrops: number;
  totalImages: number;
};

// ─── Farmer Stories Types ──────────────────────────────────────────────────────

export type StoryStatus = 'pending' | 'approved' | 'rejected';
export type StoryCategory =
  | 'Success Story' | 'Organic Farming' | 'Medicinal Farming'
  | 'High Profit Farming' | 'Innovation' | 'Water Saving' | 'Technology Adoption';

export type FarmerStory = {
  _id: string;
  farmerName: string;
  village?: string;
  district?: string;
  state?: string;
  cropName?: string;
  title: string;
  caption?: string;
  successDescription?: string;
  category: StoryCategory;
  videoUrl: string;
  thumbnailUrl?: string;
  status: StoryStatus;
  featured: boolean;
  uploadedBy?: string;
  uploadedByAdmin: boolean;
  likes: number;
  views: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FarmerStorySummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type BlogPostStatus = 'draft' | 'published';

export type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentJson?: string;
  coverImage?: string;
  tags: string[];
  status: BlogPostStatus;
  authorId?: string;
  authorName?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GalleryMediaType = 'photo' | 'video';

export type GalleryItem = {
  _id: string;
  title: string;
  caption?: string;
  mediaType: GalleryMediaType;
  mediaUrl: string;
  fileName: string;
  mimeType: string;
  featured?: boolean;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

// ─── Disease & Pest Knowledge Management Types ──────────────────────────────

export type DPKRecord = {
  _id: string;
  cropName: string;
  diseaseName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseType: string; // Disease | Pest | Deficiency | Healthy
  severityLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'published' | 'archived';
  description: string;
  symptoms?: string;
  causes?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  prevention?: string;
  urgentPrevention?: string;
  recoveryTips?: string;
  dos?: string;
  donts?: string;
  recommendedProducts?: string;
  recommendedFertilizer?: string;
  recommendedBioProduct?: string;
  recommendedOrganicProduct?: string;
  extraFarmerAdvice?: string;
  suitableWeather?: string;
  adminNotes?: string;
  diseaseImages: string[];
  imageGallery: string[];
  tags: string[];
  seoKeywords: string[];
  source: 'admin' | 'ai_auto' | 'ai_verified';
  confidenceScore: number;
  scanCount: number;
  helpfulCount: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DPKSummary = {
  total: number;
  totalCrops: number;
  totalPublished: number;
  totalDraft: number;
  totalAI: number;
};

export type DPKListResponse = {
  success: boolean;
  data: DPKRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: DPKSummary;
};



export type DKCategory = 'Disease' | 'Pest' | 'Deficiency' | 'Healthy';
export type DKSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DKStatus   = 'draft' | 'published' | 'archived';
export type DKSource   = 'admin' | 'ai_auto' | 'ai_verified';

export type DKRecord = {
  _id: string;
  cropName: string;
  diseaseName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseType: string;
  slug?: string;
  description: string;
  symptoms?: string;
  causes?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  prevention?: string;
  urgentPrevention?: string;
  recoveryTips?: string;
  dos?: string;
  donts?: string;
  recommendedProducts?: string;
  recommendedFertilizer?: string;
  recommendedBioProduct?: string;
  recommendedOrganicProduct?: string;
  extraFarmerAdvice?: string;
  suitableWeather?: string;
  adminNotes?: string;
  severityLevel: DKSeverity;
  affectedPlantPart?: string;
  status: DKStatus;
  source: DKSource;
  diseaseImages: string[];
  imageGallery: string[];
  healthyImages: string[];
  tags: string[];
  seoKeywords: string[];
  confidenceScore?: number;
  scanCount?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DKSummary = {
  total: number;
  totalCrops: number;
  totalPublished: number;
  totalDraft: number;
  totalAI: number;
};

export type DKListResponse = {
  success: boolean;
  data: DKRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: DKSummary;
};

// ─── Language Dictionary Types ──────────────────────────────────────────────

export type DictionaryCategory =
  | 'crops' | 'diseases' | 'pests' | 'fertilizers'
  | 'soil' | 'weather' | 'government' | 'agriculture' | 'ui';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export type DictionaryEntry = {
  _id: string;
  normalizedKey: string;
  english: string;
  hindi: string;
  marwari?: string;
  mewari?: string;
  dhundhari?: string;
  hadoti?: string;
  shekhawati?: string;
  bagri?: string;
  wagdi?: string;
  mewati?: string;
  godwari?: string;
  ahirwati?: string;
  malvi?: string;
  category: DictionaryCategory;
  aliases: string[];
  confidence: number;
  approved: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DictionaryListResponse = {
  success: boolean;
  data: DictionaryEntry[];
  pagination: { total: number; page: number; limit: number; pages: number };
};

export type ReviewQueueItem = {
  _id: string;
  rawInput: string;
  normalizedKey: string;
  suggestedEnglish?: string;
  detectedLang?: string;
  pageContext?: DictionaryCategory;
  status: ReviewStatus;
  mergeTargetId?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReviewQueueResponse = {
  success: boolean;
  data: ReviewQueueItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
  pendingCount: number;
};

// ─── KVK Types ────────────────────────────────────────────────────────────────

export type KVKRecord = {
  _id: string;
  name: string;
  address: string;
  village?: string;
  district: string;
  state: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  altPhone?: string;
  email?: string;
  website?: string;
  officeTimings?: string;
  servicesOffered?: string[];
  notes?: string;
  photoUrl?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KVKSummary = {
  total: number;
  active: number;
  inactive: number;
  districtCount: number;
};

export type KVKListResponse = {
  success: boolean;
  data: KVKRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: KVKSummary;
};
