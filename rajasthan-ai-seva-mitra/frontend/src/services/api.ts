import axios from 'axios';
import { useAppStore } from '../store/useAppStore';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAppStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  bookmarkScheme: (schemeId: string) => api.post(`/auth/bookmark/${schemeId}`),
};

export const schemeAPI = {
  getSchemes: (params?: any) => api.get('/schemes', { params }),
  getScheme: (id: string) => api.get(`/schemes/${id}`),
  getCategories: () => api.get('/schemes/categories'),
  getRecommended: () => api.get('/schemes/recommended'),
  checkEligibility: (id: string) => api.get(`/schemes/${id}/eligibility`),
};

export const aiAPI = {
  chat: (data: any) => api.post('/ai/chat', data),
  getSuggestions: () => api.get('/ai/suggestions'),
  getHistory: (sessionId: string) => api.get(`/ai/history/${sessionId}`),
};

export const applicationAPI = {
  create: (data: any) => api.post('/applications', data),
  getMyApplications: () => api.get('/applications/my'),
  getApplication: (id: string) => api.get(`/applications/${id}`),
  update: (id: string, data: any) => api.put(`/applications/${id}`, data),
  submit: (id: string) => api.post(`/applications/${id}/submit`),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
};

export default api;
