function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
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
}

export interface CropRecord {
  _id?: string;
  cropName: string;
  season: string;
  sowingDate: string;
  harvestDate: string;
  yieldKg: number;
  marketPrice: number;
  profit: number;
  notes?: string;
}

export interface ExtProfile {
  village: string;
  pincode: string;
  dateOfBirth: string;
  gender: string;
  experience: number;
  farmName: string;
  totalArea: number;
  farmingType: string;
  farmingMethod: string;
  irrigationType: string;
  waterAvailability: string;
  soilType: string;
  landParcels: LandParcel[];
  cropHistory: CropRecord[];
}

export interface FullProfile {
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    farmSize?: number;
    soilType?: string;
    waterSource?: string;
    location?: { state: string; district: string; village?: string; country?: string; coordinates?: { latitude: number; longitude: number } };
    points?: number;
    crops?: string[];
    avatar?: string;
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
