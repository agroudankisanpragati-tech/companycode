import type { Overview, AdminUser, Recommendation, Listing, SessionUser, GovtScheme, GalleryItem, UserSummary, UserPagination, CropKnowledge, CropKnowledgeSummary, DiseaseRecord, DiseaseKnowledgeSummary, PestRecord, PestKnowledgeSummary, FarmerStory, FarmerStorySummary, BlogPost, DPKRecord, DPKListResponse, SchemeApplication, SchemeApplicationListResponse } from './admin-types';

// In development the Next.js rewrite proxy forwards /api/* → http://localhost:4000/api/*
// In production NEXT_PUBLIC_API_URL points to the live backend.
// Using a relative /api path in development means no port mis-match can cause "Failed to fetch".
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/api' : 'http://localhost:4000/api');
export const ASSET_BASE = API_BASE.replace(/\/api$/, '');
export const TOKEN_KEY = 'kisan-unnati-admin-token';

// Wraps fetch with a 10-second timeout so a hanging request never blocks the UI forever
const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const requestJson = async <T,>(path: string, token: string, init: RequestInit = {}) => {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out: ${path}`);
    }
    throw new Error(`Network error: ${err?.message || 'Cannot reach server'}`);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (HTTP ${response.status})`);
  }

  return payload as T;
};

export const requestFormData = async <T,>(path: string, token: string, formData: FormData, method = 'POST') => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload as T;
};

export type UsersResponse = {
  success: boolean;
  data: AdminUser[];
  pagination: UserPagination;
  summary: UserSummary;
};

export const fetchAdminUsers = async (
  token: string,
  params: { page?: number; limit?: number; search?: string; role?: string; verified?: string } = {}
) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.verified !== undefined) query.set('verified', params.verified);
  const qs = query.toString();
  return requestJson<UsersResponse>(`/admin/users${qs ? '?' + qs : ''}`, token);
};

export const loadAdminWorkspace = async (authToken: string) => {
  // Use allSettled so one failing endpoint never blocks the whole workspace load
  const [overviewResult, usersResult, recommendationsResult, listingsResult] = await Promise.allSettled([
    requestJson<{ success: boolean; data: Overview }>('/admin/overview', authToken),
    requestJson<UsersResponse>('/admin/users', authToken),
    requestJson<{ success: boolean; data: Recommendation[] }>('/admin/recommendations', authToken),
    requestJson<{ success: boolean; data: Listing[] }>('/admin/listings', authToken),
  ]);

  if (overviewResult.status === 'rejected') {
    throw new Error(`Failed to load overview: ${overviewResult.reason?.message || 'Unknown error'}`);
  }
  if (usersResult.status === 'rejected') {
    throw new Error(`Failed to load users: ${usersResult.reason?.message || 'Unknown error'}`);
  }

  return {
    overview: overviewResult.value.data,
    users: usersResult.value.data,
    userSummary: usersResult.value.summary,
    recommendations: recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.data : [],
    listings: listingsResult.status === 'fulfilled' ? listingsResult.value.data : [],
  };
};

export const restoreSessionFromToken = async (authToken: string) => {
  const resp = await requestJson<{ success: boolean; data: any }>('/auth/me', authToken);

  const u = resp.data || {};

  // Normalize backend user shape to SessionUser expected by admin UI
  const sessionUser: SessionUser = {
    id: u.id || u._id || '',
    name: u.name || '',
    email: u.email || '',
    role: u.role || 'farmer',
    verified: Boolean(u.verified),
  };

  return { success: true, data: sessionUser };
};

export const formatDate = (value?: string) => {
  if (!value) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

export const updateGovtScheme = async (token: string, schemeId: string, data: Partial<GovtScheme>) => {
  return requestJson<{ success: boolean; data: GovtScheme }>(`/schemes/admin/${schemeId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteGovtScheme = async (token: string, schemeId: string) => {
  return requestJson<{ success: boolean; message: string }>(`/schemes/admin/${schemeId}`, token, {
    method: 'DELETE',
  });
};

export const uploadSchemeMedia = async (token: string, formData: FormData) => {
  return requestFormData<{ success: boolean; data: { images: string[]; videos: string[] } }>(
    '/schemes/admin/upload-media', token, formData
  );
};

export const fetchSchemesFromAPI = async (token: string, schemeType: string, state?: string) => {
  return requestJson<{ success: boolean; message: string }>('/schemes/admin/fetch-from-api', token, {
    method: 'POST',
    body: JSON.stringify({ schemeType, state }),
  });
};

export const loadGalleryItems = async (token: string) => {
  return requestJson<{ success: boolean; data: GalleryItem[] }>('/gallery/admin/all', token);
};

export const uploadGalleryItem = async (token: string, formData: FormData) => {
  return requestFormData<{ success: boolean; data: GalleryItem }>('/gallery/admin/upload', token, formData);
};

export const deleteGalleryItem = async (token: string, itemId: string) => {
  return requestJson<{ success: boolean; message: string }>(`/gallery/admin/${itemId}`, token, {
    method: 'DELETE',
  });
};

export const setGalleryItemFeatured = async (token: string, itemId: string, featured: boolean) => {
  return requestJson<{ success: boolean; data: GalleryItem }>(`/gallery/admin/${itemId}/feature`, token, {
    method: 'PATCH',
    body: JSON.stringify({ featured }),
  });
};

export { fetchWithTimeout };

// ─── Crop Knowledge Base API ─────────────────────────────────────────

export type CropKnowledgeResponse = {
  success: boolean;
  data: CropKnowledge[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: CropKnowledgeSummary;
};

export const fetchCropKnowledge = (
  token: string,
  params: { page?: number; limit?: number; search?: string; category?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  if (params.category) q.set('category', params.category);
  const qs = q.toString();
  return requestJson<CropKnowledgeResponse>(`/admin/crop-knowledge${qs ? '?' + qs : ''}`, token);
};

export const createCrop = (token: string, data: Partial<CropKnowledge>) =>
  requestJson<{ success: boolean; data: CropKnowledge }>('/admin/crop-knowledge', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCrop = (token: string, id: string, data: Partial<CropKnowledge>) =>
  requestJson<{ success: boolean; data: CropKnowledge }>(`/admin/crop-knowledge/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteCrop = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/admin/crop-knowledge/${id}`, token, { method: 'DELETE' });

// ─── Disease Knowledge Base API ───────────────────────────────────────────

export type DiseaseKnowledgeResponse = {
  success: boolean;
  data: DiseaseRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: DiseaseKnowledgeSummary;
};

export const fetchDiseaseRecords = (
  token: string,
  params: { page?: number; limit?: number; search?: string; category?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  if (params.category) q.set('category', params.category);
  const qs = q.toString();
  return requestJson<DiseaseKnowledgeResponse>(`/disease/admin/knowledge-base${qs ? '?' + qs : ''}`, token);
};

export const createDiseaseRecord = (token: string, formData: FormData) => {
  return requestFormData<{ success: boolean; data: DiseaseRecord }>('/disease/admin/knowledge-base', token, formData);
};

export const updateDiseaseRecord = (token: string, id: string, formData: FormData) =>
  fetch(`${API_BASE}/disease/admin/knowledge-base/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  }).then(r => r.json());

export const deleteDiseaseRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/disease/admin/knowledge-base/${id}`, token, { method: 'DELETE' });

// ─── Farmer Stories API ─────────────────────────────────────────────────────

export type FarmerStoriesResponse = {
  success: boolean;
  data: FarmerStory[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: FarmerStorySummary;
};

export const fetchAdminStories = (
  token: string,
  params: { page?: number; limit?: number; status?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return requestJson<FarmerStoriesResponse>(`/farmer-stories/admin/all${qs ? '?' + qs : ''}`, token);
};

export const adminUploadStory = (token: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: FarmerStory }>('/farmer-stories/admin/upload', token, formData);

export const updateAdminStory = (token: string, id: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: FarmerStory }>(`/farmer-stories/admin/${id}`, token, formData, 'PUT');

export const updateStoryStatus = (token: string, id: string, status: string) =>
  requestJson<{ success: boolean; data: FarmerStory }>(`/farmer-stories/admin/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const toggleStoryFeatured = (token: string, id: string, featured: boolean) =>
  requestJson<{ success: boolean; data: FarmerStory }>(`/farmer-stories/admin/${id}/feature`, token, {
    method: 'PATCH',
    body: JSON.stringify({ featured }),
  });

export const deleteAdminStory = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/farmer-stories/admin/${id}`, token, { method: 'DELETE' });

// ─── Blog Posts API ──────────────────────────────────────────────────────────

export const fetchAdminBlogs = (token: string) =>
  requestJson<{ success: boolean; data: BlogPost[] }>('/blogs/admin/all', token);

export const fetchAdminBlog = (token: string, id: string) =>
  requestJson<{ success: boolean; data: BlogPost }>(`/blogs/admin/${id}`, token);

export const createBlog = (token: string, data: Partial<BlogPost>) =>
  requestJson<{ success: boolean; data: BlogPost }>('/blogs/admin', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateBlog = (token: string, id: string, data: Partial<BlogPost>) =>
  requestJson<{ success: boolean; data: BlogPost }>(`/blogs/admin/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteBlog = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/blogs/admin/${id}`, token, { method: 'DELETE' });

export const uploadBlogCover = async (token: string, file: File): Promise<string> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await requestFormData<{ success: boolean; data: { coverImage: string } }>(
    '/blogs/admin/upload-cover', token, fd
  );
  return res.data.coverImage;
};

// ─── Pest Knowledge Base API ─────────────────────────────────────────────────

export type PestKnowledgeResponse = {
  success: boolean;
  data: PestRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: PestKnowledgeSummary;
};

export const fetchPestRecords = (
  token: string,
  params: { page?: number; limit?: number; search?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return requestJson<PestKnowledgeResponse>(`/admin/pest-knowledge${qs ? '?' + qs : ''}`, token);
};

export const createPestRecord = (token: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: PestRecord }>('/admin/pest-knowledge', token, formData);

export const updatePestRecord = (token: string, id: string, formData: FormData) =>
  fetch(`${API_BASE}/admin/pest-knowledge/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  }).then(r => r.json());

export const deletePestRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/admin/pest-knowledge/${id}`, token, { method: 'DELETE' });

// ─── KVK Management API ──────────────────────────────────────────────────────

import type { KVKRecord, KVKListResponse } from './admin-types';

// ─── Language Dictionary API ────────────────────────────────────────────────────────────────

import type { DictionaryEntry, DictionaryListResponse, ReviewQueueResponse } from './admin-types';

export const fetchDictionaryEntries = (
  token: string,
  params: { page?: number; limit?: number; search?: string; category?: string; approved?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  if (params.search)   q.set('search',   params.search);
  if (params.category) q.set('category', params.category);
  if (params.approved !== undefined) q.set('approved', params.approved);
  const qs = q.toString();
  return requestJson<DictionaryListResponse>(`/language-engine/dictionary${qs ? '?' + qs : ''}`, token);
};

export const createDictionaryEntry = (token: string, data: Partial<DictionaryEntry>) =>
  requestJson<{ success: boolean; data: DictionaryEntry }>('/language-engine/dictionary', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateDictionaryEntry = (token: string, id: string, data: Partial<DictionaryEntry>) =>
  requestJson<{ success: boolean; data: DictionaryEntry }>(`/language-engine/dictionary/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteDictionaryEntry = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/language-engine/dictionary/${id}`, token, { method: 'DELETE' });

export const fetchReviewQueue = (
  token: string,
  params: { page?: number; limit?: number; status?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page)   q.set('page',   String(params.page));
  if (params.limit)  q.set('limit',  String(params.limit));
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return requestJson<ReviewQueueResponse>(`/language-engine/review-queue${qs ? '?' + qs : ''}`, token);
};

export const approveQueueItem = (
  token: string,
  id: string,
  data: { english: string; hindi: string; category: string; reviewNote?: string } & Record<string, string>
) =>
  requestJson<{ success: boolean; data: DictionaryEntry }>(`/language-engine/review-queue/${id}/approve`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const rejectQueueItem = (token: string, id: string, reviewNote?: string) =>
  requestJson<{ success: boolean; message: string }>(`/language-engine/review-queue/${id}/reject`, token, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  });

export const mergeQueueItem = (token: string, id: string, targetId: string, reviewNote?: string) =>
  requestJson<{ success: boolean; data: DictionaryEntry }>(`/language-engine/review-queue/${id}/merge`, token, {
    method: 'POST',
    body: JSON.stringify({ targetId, reviewNote }),
  });


export const fetchKVKList = (
  token: string,
  params: { page?: number; limit?: number; search?: string; state?: string; district?: string; isActive?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  if (params.search)   q.set('search',   params.search);
  if (params.state)    q.set('state',    params.state);
  if (params.district) q.set('district', params.district);
  if (params.isActive !== undefined) q.set('isActive', params.isActive);
  const qs = q.toString();
  return requestJson<KVKListResponse>(`/kvk/admin${qs ? '?' + qs : ''}`, token);
};

export const fetchKVKById = (token: string, id: string) =>
  requestJson<{ success: boolean; data: KVKRecord }>(`/kvk/admin/${id}`, token);

export const createKVK = (token: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: KVKRecord }>('/kvk/admin', token, formData);

export const updateKVK = (token: string, id: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: KVKRecord }>(`/kvk/admin/${id}`, token, formData, 'PUT');

export const toggleKVKStatus = (token: string, id: string) =>
  requestJson<{ success: boolean; data: KVKRecord }>(`/kvk/admin/${id}/toggle`, token, { method: 'PATCH' });

export const deleteKVK = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/kvk/admin/${id}`, token, { method: 'DELETE' });

// ─── Disease & Pest Knowledge Management API ──────────────────────────────────

import type { DKRecord, DKListResponse } from './admin-types';

export const fetchDKRecords = (
  token: string,
  params: { page?: number; limit?: number; search?: string; category?: string; severity?: string; status?: string; cropName?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  if (params.search)   q.set('search',   params.search);
  if (params.category) q.set('category', params.category);
  if (params.severity) q.set('severity', params.severity);
  if (params.status)   q.set('status',   params.status);
  if (params.cropName) q.set('cropName', params.cropName);
  const qs = q.toString();
  return requestJson<DKListResponse>(`/disease/admin/disease-pest-knowledge${qs ? '?' + qs : ''}`, token);
};

export const fetchDKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; data: DKRecord }>(`/disease/admin/disease-pest-knowledge/${id}`, token);

export const createDKRecord = (token: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: DKRecord; existingId?: string }>('/disease/admin/disease-pest-knowledge', token, formData);

export const updateDKRecord = (token: string, id: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: DKRecord }>(`/disease/admin/disease-pest-knowledge/${id}`, token, formData, 'PUT');

export const deleteDKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`/disease/admin/disease-pest-knowledge/${id}`, token, { method: 'DELETE' });

export const bulkDeleteDKRecords = (token: string, ids: string[]) =>
  requestJson<{ success: boolean; deleted: number }>('/disease/admin/disease-pest-knowledge/bulk-delete', token, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

export const duplicateDKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; data: DKRecord }>(`/disease/admin/disease-pest-knowledge/${id}/duplicate`, token, { method: 'POST' });

export const exportDKRecords = (token: string, params: { cropName?: string; status?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.cropName) q.set('cropName', params.cropName);
  if (params.status)   q.set('status',   params.status);
  const qs = q.toString();
  return requestJson<any>(`/disease/admin/disease-pest-knowledge/export/json${qs ? '?' + qs : ''}`, token);
};

export const importDKRecords = (token: string, data: any[]) =>
  requestJson<{ success: boolean; created: number; updated: number; errors: number; total: number }>(
    '/disease/admin/disease-pest-knowledge/import/json', token,
    { method: 'POST', body: JSON.stringify({ data }) }
  );


export const fetchSchemeApplications = (
  token: string,
  params: { page?: number; limit?: number; status?: string; search?: string } = {}
) => {
  const q = new URLSearchParams();
  if (params.page)   q.set('page',   String(params.page));
  if (params.limit)  q.set('limit',  String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return requestJson<SchemeApplicationListResponse>(`/schemes/application/admin/all${qs ? '?' + qs : ''}`, token);
};

export const updateApplicationStatus = (token: string, id: string, status: string) =>
  requestJson<{ success: boolean; data: SchemeApplication }>(`/schemes/application/admin/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// ─── Disease & Pest Solutions (Unified) API ----------------------------------

const DPK_BASE = '/disease/admin/disease-pest-knowledge';

export const fetchDPKRecords = (
  token: string,
  params: { page?: number; limit?: number; search?: string; category?: string; severity?: string; status?: string; cropName?: string } = {}
): Promise<DPKListResponse> => {
  const q = new URLSearchParams();
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  if (params.search)   q.set('search',   params.search);
  if (params.category) q.set('category', params.category);
  if (params.severity) q.set('severity', params.severity);
  if (params.status)   q.set('status',   params.status);
  if (params.cropName) q.set('cropName', params.cropName);
  const qs = q.toString();
  return requestJson<DPKListResponse>(`${DPK_BASE}${qs ? '?' + qs : ''}`, token);
};

export const fetchDPKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; data: DPKRecord }>(`${DPK_BASE}/${id}`, token);

export const createDPKRecord = (token: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: DPKRecord; existingId?: string }>(`${DPK_BASE}`, token, formData);

export const updateDPKRecord = (token: string, id: string, formData: FormData) =>
  requestFormData<{ success: boolean; data: DPKRecord }>(`${DPK_BASE}/${id}`, token, formData, 'PUT');

export const deleteDPKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; message: string }>(`${DPK_BASE}/${id}`, token, { method: 'DELETE' });

export const bulkDeleteDPKRecords = (token: string, ids: string[]) =>
  requestJson<{ success: boolean; deleted: number }>(`${DPK_BASE}/bulk-delete`, token, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

export const duplicateDPKRecord = (token: string, id: string) =>
  requestJson<{ success: boolean; data: DPKRecord }>(`${DPK_BASE}/${id}/duplicate`, token, { method: 'POST' });

export const exportDPKJson = (token: string, params: { cropName?: string; status?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.cropName) q.set('cropName', params.cropName);
  if (params.status)   q.set('status',   params.status);
  const qs = q.toString();
  return requestJson<any>(`${DPK_BASE}/export/json${qs ? '?' + qs : ''}`, token);
};

export const importDPKJson = (token: string, records: any[]) =>
  requestJson<{ success: boolean; created: number; updated: number; errors: number }>(
    `${DPK_BASE}/import/json`, token, { method: 'POST', body: JSON.stringify({ data: records }) }
  );

