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

export type GovtScheme = {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  department: string;
  audience: string;
  benefits: string[];
  applicationLink?: string;
  coverImage?: string;
  tags: string[];
  status: 'draft' | 'published';
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

export type DiseaseRecord = {
  _id: string;
  cropName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: DiseaseSeverity;
  description: string;
  leafSymptoms?: string;
  stemSymptoms?: string;
  rootSymptoms?: string;
  fruitSymptoms?: string;
  symptomsDescription?: string;
  organicTreatment?: string;
  chemicalTreatment?: string;
  recommendedProducts?: string;
  treatmentDescription?: string;
  preventionMethods?: string;
  preventionDescription?: string;
  diseaseImages: string[];
  healthyImages: string[];
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
