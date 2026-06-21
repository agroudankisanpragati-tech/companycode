import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: string;
  // Language
  appLanguage: string;
  voiceLanguage: string;
  dateFormat: string;
  timeFormat: string;
  measurementUnit: string;
  // AI Assistant
  aiEnabled: boolean;
  voiceResponses: boolean;
  textResponses: boolean;
  smartSuggestions: boolean;
  autoRecommendations: boolean;
  personalizedInsights: boolean;
  aiResponseMode: 'basic' | 'standard' | 'advanced';
  saveConversationHistory: boolean;
  // Notifications
  notifWeather: boolean;
  notifRain: boolean;
  notifMarketPrice: boolean;
  notifDisease: boolean;
  notifGovtScheme: boolean;
  notifCommunity: boolean;
  notifLearning: boolean;
  notifMarketplace: boolean;
  notifTaskReminders: boolean;
  notifPush: boolean;
  notifEmail: boolean;
  notifSMS: boolean;
  // Appearance
  theme: 'light' | 'dark' | 'system';
  interfaceDensity: 'compact' | 'comfortable';
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  // Privacy
  publicActivity: boolean;
  communityVisibility: boolean;
  marketplaceVisibility: boolean;
  allowAIAnalysis: boolean;
  allowPersonalization: boolean;
  allowAnalytics: boolean;
  // Marketplace
  marketplaceBuyerMode: boolean;
  marketplaceSellerMode: boolean;
  marketplaceRadius: number;
  marketplaceCategories: string[];
  notifNewBuyerRequests: boolean;
  notifNewSellerListings: boolean;
  notifPriceChanges: boolean;
  // Schemes
  notifSchemeRecommendations: boolean;
  notifEligibility: boolean;
  notifNewSchemes: boolean;
  prefStateSchemes: boolean;
  prefCentralSchemes: boolean;
  prefAgriDeptUpdates: boolean;
  // Learning
  notifCourses: boolean;
  notifVideoRecs: boolean;
  notifFarmingTips: boolean;
  learningCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

const defaults = {
  appLanguage: 'English', voiceLanguage: 'Hindi', dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h', measurementUnit: 'metric',
  aiEnabled: true, voiceResponses: true, textResponses: true,
  smartSuggestions: true, autoRecommendations: true, personalizedInsights: true,
  aiResponseMode: 'standard', saveConversationHistory: true,
  notifWeather: true, notifRain: true, notifMarketPrice: true, notifDisease: true,
  notifGovtScheme: true, notifCommunity: false, notifLearning: false,
  notifMarketplace: false, notifTaskReminders: true,
  notifPush: true, notifEmail: false, notifSMS: false,
  theme: 'light', interfaceDensity: 'comfortable', fontSize: 'medium', highContrast: false,
  publicActivity: false, communityVisibility: true, marketplaceVisibility: true,
  allowAIAnalysis: true, allowPersonalization: true, allowAnalytics: false,
  marketplaceBuyerMode: true, marketplaceSellerMode: false, marketplaceRadius: 50,
  marketplaceCategories: [], notifNewBuyerRequests: true,
  notifNewSellerListings: true, notifPriceChanges: true,
  notifSchemeRecommendations: true, notifEligibility: true, notifNewSchemes: true,
  prefStateSchemes: true, prefCentralSchemes: true, prefAgriDeptUpdates: true,
  notifCourses: true, notifVideoRecs: false, notifFarmingTips: true,
  learningCategories: [],
};

const schema = new Schema<IUserSettings>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    appLanguage: { type: String, default: defaults.appLanguage },
    voiceLanguage: { type: String, default: defaults.voiceLanguage },
    dateFormat: { type: String, default: defaults.dateFormat },
    timeFormat: { type: String, default: defaults.timeFormat },
    measurementUnit: { type: String, default: defaults.measurementUnit },
    aiEnabled: { type: Boolean, default: defaults.aiEnabled },
    voiceResponses: { type: Boolean, default: defaults.voiceResponses },
    textResponses: { type: Boolean, default: defaults.textResponses },
    smartSuggestions: { type: Boolean, default: defaults.smartSuggestions },
    autoRecommendations: { type: Boolean, default: defaults.autoRecommendations },
    personalizedInsights: { type: Boolean, default: defaults.personalizedInsights },
    aiResponseMode: { type: String, enum: ['basic', 'standard', 'advanced'], default: defaults.aiResponseMode } as any,
    saveConversationHistory: { type: Boolean, default: defaults.saveConversationHistory },
    notifWeather: { type: Boolean, default: defaults.notifWeather },
    notifRain: { type: Boolean, default: defaults.notifRain },
    notifMarketPrice: { type: Boolean, default: defaults.notifMarketPrice },
    notifDisease: { type: Boolean, default: defaults.notifDisease },
    notifGovtScheme: { type: Boolean, default: defaults.notifGovtScheme },
    notifCommunity: { type: Boolean, default: defaults.notifCommunity },
    notifLearning: { type: Boolean, default: defaults.notifLearning },
    notifMarketplace: { type: Boolean, default: defaults.notifMarketplace },
    notifTaskReminders: { type: Boolean, default: defaults.notifTaskReminders },
    notifPush: { type: Boolean, default: defaults.notifPush },
    notifEmail: { type: Boolean, default: defaults.notifEmail },
    notifSMS: { type: Boolean, default: defaults.notifSMS },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: defaults.theme } as any,
    interfaceDensity: { type: String, enum: ['compact', 'comfortable'], default: defaults.interfaceDensity } as any,
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: defaults.fontSize } as any,
    highContrast: { type: Boolean, default: defaults.highContrast },
    publicActivity: { type: Boolean, default: defaults.publicActivity },
    communityVisibility: { type: Boolean, default: defaults.communityVisibility },
    marketplaceVisibility: { type: Boolean, default: defaults.marketplaceVisibility },
    allowAIAnalysis: { type: Boolean, default: defaults.allowAIAnalysis },
    allowPersonalization: { type: Boolean, default: defaults.allowPersonalization },
    allowAnalytics: { type: Boolean, default: defaults.allowAnalytics },
    marketplaceBuyerMode: { type: Boolean, default: defaults.marketplaceBuyerMode },
    marketplaceSellerMode: { type: Boolean, default: defaults.marketplaceSellerMode },
    marketplaceRadius: { type: Number, default: defaults.marketplaceRadius },
    marketplaceCategories: { type: [String], default: defaults.marketplaceCategories },
    notifNewBuyerRequests: { type: Boolean, default: defaults.notifNewBuyerRequests },
    notifNewSellerListings: { type: Boolean, default: defaults.notifNewSellerListings },
    notifPriceChanges: { type: Boolean, default: defaults.notifPriceChanges },
    notifSchemeRecommendations: { type: Boolean, default: defaults.notifSchemeRecommendations },
    notifEligibility: { type: Boolean, default: defaults.notifEligibility },
    notifNewSchemes: { type: Boolean, default: defaults.notifNewSchemes },
    prefStateSchemes: { type: Boolean, default: defaults.prefStateSchemes },
    prefCentralSchemes: { type: Boolean, default: defaults.prefCentralSchemes },
    prefAgriDeptUpdates: { type: Boolean, default: defaults.prefAgriDeptUpdates },
    notifCourses: { type: Boolean, default: defaults.notifCourses },
    notifVideoRecs: { type: Boolean, default: defaults.notifVideoRecs },
    notifFarmingTips: { type: Boolean, default: defaults.notifFarmingTips },
    learningCategories: { type: [String], default: defaults.learningCategories },
  },
  { timestamps: true }
);

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', schema);
export { defaults as settingsDefaults };
