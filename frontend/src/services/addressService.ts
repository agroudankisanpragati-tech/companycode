/**
 * Shared Address Service
 * Single source of truth for farmer address.
 * All modules (KVK, Disease Detection, Nearest Shops, etc.) consume this.
 */

export interface FarmerAddress {
  state: string;
  district: string;
  tehsil?: string;
  village: string;
  pincode: string;
  address?: string; // full street address
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/** Read address from cached profile data */
export function getAddressFromCache(): FarmerAddress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('farmerAddress');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist address to localStorage cache */
export function cacheAddress(addr: FarmerAddress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('farmerAddress', JSON.stringify(addr));
  window.dispatchEvent(new CustomEvent('farmer-address-changed', { detail: addr }));
}

/** Save address to backend (updates both User.location and FarmerProfileData) */
export async function saveAddress(addr: FarmerAddress): Promise<void> {
  const payload = {
    location: {
      state: addr.state,
      district: addr.district,
      village: addr.village,
    },
    village: addr.village,
    district: addr.district,
    state: addr.state,
    pincode: addr.pincode,
    address: addr.address || '',
    ...(addr.tehsil ? { tehsil: addr.tehsil } : {}),
  };

  const res = await fetch('/api/farmer-profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save address');
  cacheAddress(addr);
}

/** Check if address is complete */
export function isAddressComplete(addr: FarmerAddress | null): boolean {
  if (!addr) return false;
  return !!(addr.state && addr.district && addr.village && addr.pincode);
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
