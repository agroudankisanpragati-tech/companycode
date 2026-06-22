function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function authToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : '';
}

export interface LandParcel {
  _id?: string;
  name: string;
  area: number;
  unit: 'acres' | 'hectares' | 'bigha';
  soilType: string;
  waterSource: string;
  latitude: number;
  longitude: number;
  ownershipType: 'owned' | 'leased' | 'shared';
  khasraNumber?: string;
  soilHealthStatus?: string;
}

export interface CropRecord {
  _id?: string;
  cropName: string;
  season: string;
  year?: number;
  sowingDate: string;
  harvestDate: string;
  yieldKg: number;
  marketPrice: number;
  profit: number;
  production?: number;
  remarks?: string;
  notes?: string;
}

export interface FarmDetail {
  _id?: string;
  farmName: string;
  farmSize: number;
  farmSizeUnit: 'acres' | 'hectares' | 'bigha';
  irrigationType: string;
  soilType: string;
  farmingCategory: string;
  organicCertified: boolean;
  waterSource?: string;
}

export interface ExtProfile {
  village: string;
  pincode: string;
  dateOfBirth: string;
  gender: string;
  age?: number;
  education?: string;
  experience: number;
  address?: string;
  district?: string;
  state?: string;
  languagePreference?: string;
  farmName: string;
  totalArea: number;
  farmingType: string;
  farmingMethod: string;
  irrigationType: string;
  waterAvailability: string;
  soilType: string;
  organicCertified?: boolean;
  farmDetails: FarmDetail[];
  landParcels: LandParcel[];
  cropHistory: CropRecord[];
  appLanguage?: string;
  voiceEnabled?: boolean;
  notificationLanguage?: string;
}

export interface FullProfile {
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    profileImage?: string;
    farmSize?: number;
    soilType?: string;
    waterSource?: string;
    location?: {
      state: string;
      district: string;
      village?: string;
      country?: string;
      coordinates?: { latitude: number; longitude: number };
    };
    points?: number;
    crops?: string[];
  };
  ext: ExtProfile;
}

export async function getFullProfile(): Promise<FullProfile> {
  const res = await fetch('/api/farmer-profile', { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load profile');
  return json.data;
}

export async function saveFullProfile(payload: Record<string, any>): Promise<FullProfile> {
  const res = await fetch('/api/farmer-profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save profile');
  return json.data;
}

export async function uploadAvatar(file: File): Promise<{ profileImage: string }> {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch('/api/farmer-profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken()}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to upload avatar');
  return json.data;
}

export async function removeAvatar(): Promise<void> {
  const res = await fetch('/api/farmer-profile/avatar', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to remove avatar');
}

// ── Farm Details ──────────────────────────────────────────────────────────

export async function addFarm(farm: Omit<FarmDetail, '_id'>): Promise<FarmDetail[]> {
  const res = await fetch('/api/farmer-profile/farm', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(farm),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to add farm');
  return json.data;
}

export async function updateFarm(id: string, farm: Partial<FarmDetail>): Promise<FarmDetail[]> {
  const res = await fetch(`/api/farmer-profile/farm/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(farm),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update farm');
  return json.data;
}

export async function deleteFarm(id: string): Promise<FarmDetail[]> {
  const res = await fetch(`/api/farmer-profile/farm/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete farm');
  return json.data;
}

// ── Land Parcels ──────────────────────────────────────────────────────────

export async function addLand(parcel: Omit<LandParcel, '_id'>): Promise<LandParcel[]> {
  const res = await fetch('/api/farmer-profile/land', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(parcel),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to add land');
  return json.data;
}

export async function updateLand(id: string, parcel: Partial<LandParcel>): Promise<LandParcel[]> {
  const res = await fetch(`/api/farmer-profile/land/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(parcel),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update land');
  return json.data;
}

export async function deleteLand(id: string): Promise<LandParcel[]> {
  const res = await fetch(`/api/farmer-profile/land/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete land');
  return json.data;
}

// ── Crop History ──────────────────────────────────────────────────────────

export async function addCropRecord(record: Omit<CropRecord, '_id'>): Promise<CropRecord[]> {
  const res = await fetch('/api/farmer-profile/crop', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(record),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to add crop record');
  return json.data;
}

export async function updateCropRecord(id: string, record: Partial<CropRecord>): Promise<CropRecord[]> {
  const res = await fetch(`/api/farmer-profile/crop/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(record),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update crop record');
  return json.data;
}

export async function deleteCropRecord(id: string): Promise<CropRecord[]> {
  const res = await fetch(`/api/farmer-profile/crop/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete crop record');
  return json.data;
}

// ── Account ───────────────────────────────────────────────────────────────

export async function deleteAccount(password: string): Promise<void> {
  const res = await fetch('/api/farmer-profile/account', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete account');
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

export async function getSettings(): Promise<any> {
  const res = await fetch('/api/settings', { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load settings');
  return json.data;
}

export async function saveSettings(settings: Record<string, any>): Promise<any> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save settings');
  return json.data;
}
