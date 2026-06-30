const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const tok = () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : '');
const authHeaders = () => ({ Authorization: `Bearer ${tok()}` });
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() });

export const shopkeeperApi = {
  getProfile: () =>
    fetch(`${API}/shopkeeper/profile`, { headers: authHeaders() }).then(r => r.json()),

  selectType: (shopType: string) =>
    fetch(`${API}/shopkeeper/select-type`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ shopType }),
    }).then(r => r.json()),

  submitVerification: () =>
    fetch(`${API}/shopkeeper/submit-verification`, { method: 'POST', headers: authHeaders() }).then(r => r.json()),

  // Fertilizer products
  getFertilizerProducts: () =>
    fetch(`${API}/shopkeeper/fertilizer-products`, { headers: authHeaders() }).then(r => r.json()),

  createFertilizerProduct: (fd: FormData) =>
    fetch(`${API}/shopkeeper/fertilizer-products`, { method: 'POST', headers: authHeaders(), body: fd }).then(r => r.json()),

  updateFertilizerProduct: (id: string, fd: FormData) =>
    fetch(`${API}/shopkeeper/fertilizer-products/${id}`, { method: 'PUT', headers: authHeaders(), body: fd }).then(r => r.json()),

  deleteFertilizerProduct: (id: string) =>
    fetch(`${API}/shopkeeper/fertilizer-products/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  // Nursery products
  getNurseryProducts: () =>
    fetch(`${API}/shopkeeper/nursery-products`, { headers: authHeaders() }).then(r => r.json()),

  createNurseryProduct: (fd: FormData) =>
    fetch(`${API}/shopkeeper/nursery-products`, { method: 'POST', headers: authHeaders(), body: fd }).then(r => r.json()),

  updateNurseryProduct: (id: string, fd: FormData) =>
    fetch(`${API}/shopkeeper/nursery-products/${id}`, { method: 'PUT', headers: authHeaders(), body: fd }).then(r => r.json()),

  deleteNurseryProduct: (id: string) =>
    fetch(`${API}/shopkeeper/nursery-products/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  // Marketplace — enhanced with location & search
  getMarketplace: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API}/shopkeeper/marketplace?${qs}`).then(r => r.json());
  },

  getMarketplaceShop: (id: string) =>
    fetch(`${API}/shopkeeper/marketplace/${id}`).then(r => r.json()),

  // AI Crop Advisory seed integration
  // Returns shops + seed products matching a recommended crop name
  // Supports full 6-level proximity: village → tehsil → district → state → GPS
  searchSeedsByByCrop: (crop: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ crop, ...params }).toString();
    return fetch(`${API}/shopkeeper/seed-search?${qs}`).then(r => r.json());
  },

  // AI Crop Advisory full product enrichment
  // Returns ALL product categories (seeds, fertilizers, pesticides, fungicides, etc.) for a crop
  // Grouped by subcategory with proximity scoring
  getCropProducts: (crop: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ crop, ...params }).toString();
    return fetch(`${API}/shopkeeper/crop-products?${qs}`).then(r => r.json());
  },
};
