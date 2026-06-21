"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsDefaults = exports.UserSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
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
exports.settingsDefaults = defaults;
const schema = new mongoose_1.Schema({
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
    aiResponseMode: { type: String, enum: ['basic', 'standard', 'advanced'], default: defaults.aiResponseMode },
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
    theme: { type: String, enum: ['light', 'dark', 'system'], default: defaults.theme },
    interfaceDensity: { type: String, enum: ['compact', 'comfortable'], default: defaults.interfaceDensity },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: defaults.fontSize },
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
}, { timestamps: true });
exports.UserSettings = mongoose_1.default.model('UserSettings', schema);
//# sourceMappingURL=UserSettings.js.map