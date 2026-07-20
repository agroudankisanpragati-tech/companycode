import type { FullProfile } from '@/services/farmerProfile';
import type { FarmerAddress } from '@/services/addressService';

export type { FullProfile, FarmerAddress };

export const FARMER_CATEGORIES = [
  'Small Farmer', 'Marginal Farmer', 'Medium Farmer',
  'Large Farmer', 'Tenant Farmer', 'Organic Farmer',
];

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
];

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

export function avatarUrl(src?: string | null): string | null {
  if (!src) return null;
  return src.startsWith('/uploads') ? `${API_BASE}${src}` : src;
}

export function nameInitials(name?: string | null): string {
  if (!name) return 'KP';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function completionFields(profile: FullProfile): { label: string; done: boolean }[] {
  return [
    { label: 'Photo', done: !!profile.user.profileImage },
    { label: 'Phone', done: !!profile.user.phone },
    { label: 'Email', done: !!profile.user.email },
    { label: 'Gender', done: !!profile.ext.gender },
    { label: 'Date of Birth', done: !!profile.ext.dateOfBirth },
    { label: 'Farmer Category', done: !!profile.ext.farmingType },
    { label: 'Language', done: !!profile.ext.languagePreference },
    {
      label: 'Address',
      done: !!(
        profile.user.location?.state &&
        profile.user.location?.district &&
        profile.ext.village &&
        profile.ext.pincode
      ),
    },
  ];
}
