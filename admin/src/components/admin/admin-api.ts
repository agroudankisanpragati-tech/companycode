import type { Overview, AdminUser, Recommendation, Listing, SessionUser, GovtScheme, GalleryItem, UserSummary, UserPagination, CropKnowledge, CropKnowledgeSummary, DiseaseRecord, DiseaseKnowledgeSummary, FarmerStory, FarmerStorySummary, BlogPost } from './admin-types';

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

