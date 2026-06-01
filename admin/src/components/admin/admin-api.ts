import type { Overview, AdminUser, Recommendation, Listing, SessionUser, AdminBlogPost, GovtScheme, GalleryItem } from './admin-types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.agroudankisanpragati.com/api';
export const ASSET_BASE = API_BASE.replace(/\/api$/, '');
export const TOKEN_KEY = 'kisan-unnati-admin-token';

export const requestJson = async <T,>(path: string, token: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload as T;
};

export const requestFormData = async <T,>(path: string, token: string, formData: FormData) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
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

export const loadAdminWorkspace = async (authToken: string) => {
  const [overviewResponse, usersResponse, recommendationsResponse, listingsResponse] = await Promise.all([
    requestJson<{ success: boolean; data: Overview }>('/admin/overview', authToken),
    requestJson<{ success: boolean; data: AdminUser[] }>('/admin/users', authToken),
    requestJson<{ success: boolean; data: Recommendation[] }>('/admin/recommendations', authToken),
    requestJson<{ success: boolean; data: Listing[] }>('/admin/listings', authToken),
  ]);

  return {
    overview: overviewResponse.data,
    users: usersResponse.data,
    recommendations: recommendationsResponse.data,
    listings: listingsResponse.data,
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

export const updateBlogPost = async (token: string, postId: string, data: Partial<AdminBlogPost>) => {
  return requestJson<{ success: boolean; data: AdminBlogPost }>(`/blogs/admin/${postId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteBlogPost = async (token: string, postId: string) => {
  return requestJson<{ success: boolean; message: string }>(`/blogs/admin/${postId}`, token, {
    method: 'DELETE',
  });
};

export const fetchAdminBlogs = async (token: string) => {
  return requestJson<{ success: boolean; data: any[] }>('/blogs/admin/all', token);
};

export const fetchAdminBlogById = async (token: string, id: string) => {
  return requestJson<{ success: boolean; data: any }>(`/blogs/admin/${id}`, token);
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
