function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export interface UserSettings {
  _id?: string;
  userId?: string;
  appLanguage: string;
  voiceLanguage: string;
  dateFormat: string;
  timeFormat: string;
  measurementUnit: string;
  aiEnabled: boolean;
  voiceResponses: boolean;
  textResponses: boolean;
  smartSuggestions: boolean;
  autoRecommendations: boolean;
  personalizedInsights: boolean;
  aiResponseMode: 'basic' | 'standard' | 'advanced';
  saveConversationHistory: boolean;
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
  theme: 'light' | 'dark' | 'system';
  interfaceDensity: 'compact' | 'comfortable';
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  publicActivity: boolean;
  communityVisibility: boolean;
  marketplaceVisibility: boolean;
  allowAIAnalysis: boolean;
  allowPersonalization: boolean;
  allowAnalytics: boolean;
  marketplaceBuyerMode: boolean;
  marketplaceSellerMode: boolean;
  marketplaceRadius: number;
  marketplaceCategories: string[];
  notifNewBuyerRequests: boolean;
  notifNewSellerListings: boolean;
  notifPriceChanges: boolean;
  notifSchemeRecommendations: boolean;
  notifEligibility: boolean;
  notifNewSchemes: boolean;
  prefStateSchemes: boolean;
  prefCentralSchemes: boolean;
  prefAgriDeptUpdates: boolean;
  notifCourses: boolean;
  notifVideoRecs: boolean;
  notifFarmingTips: boolean;
  learningCategories: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
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

export async function getSettings(): Promise<UserSettings> {
  const res = await fetch('/api/settings', { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load settings');
  return json.data;
}

export async function saveSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save settings');
  return json.data;
}

export async function resetSettings(): Promise<UserSettings> {
  const res = await fetch('/api/settings/reset', { method: 'POST', headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to reset settings');
  return json.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/settings/change-password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to change password');
}
