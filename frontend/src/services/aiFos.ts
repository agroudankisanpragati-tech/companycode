const API = '/api/ai-fos';

function h(): HeadersInit {
  const t = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
           : { 'Content-Type': 'application/json' };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...h(), ...(init?.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export interface ActiveCrop {
  _id:                 string;
  farmerId:            string;
  myCropId:            string;
  cropName:            string;
  fieldLabel:          string;
  sowingDate:          string;
  growingDurationDays: number;
  currentStage:        string;
  progressPercent:     number;
  isHarvested:         boolean;
  harvestDate?:        string;
  createdAt:           string;
}

export interface CropTask {
  _id:           string;
  activeCropId:  string;
  cropName:      string;
  dayNumber:     number;
  scheduledDate: string;
  title:         string;
  description:   string;
  taskType:      string;
  status:        'pending' | 'done' | 'skipped';
  completedAt?:  string;
}

export interface CropDashboardEntry {
  activeCrop:    ActiveCrop;
  dayAge:        number;
  todayTasks:    CropTask[];
  upcomingTasks: CropTask[];
  overdueTasks:  CropTask[];
}

export interface FosDashboard {
  cropData:        CropDashboardEntry[];
  aiRecommendation: string;
  activeCropId:    string | null;
  contextSnapshot: {
    moisture:    { pct: number; status: string } | null;
    soilScore:   number | null;
    marketPrice: { crop: string; price: number } | null;
  };
}

export const aiFosService = {
  activate: (myCropId: string, sowingDate: string, fieldLabel: string) =>
    req<{ success: boolean; data: { activeCrop: ActiveCrop; taskCount: number } }>('/activate', {
      method: 'POST',
      body: JSON.stringify({ myCropId, sowingDate, fieldLabel }),
    }),

  getDashboard: () =>
    req<{ success: boolean; data: FosDashboard }>('/dashboard'),

  getActiveCrops: () =>
    req<{ success: boolean; data: ActiveCrop[] }>('/active-crops'),

  updateTaskStatus: (taskId: string, status: 'done' | 'skipped' | 'pending') =>
    req<{ success: boolean; data: CropTask }>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getTasksForCrop: (activeCropId: string) =>
    req<{ success: boolean; data: CropTask[] }>(`/tasks/${activeCropId}`),

  markHarvested: (activeCropId: string) =>
    req<{ success: boolean }>(`/active-crops/${activeCropId}`, { method: 'DELETE' }),

  getRecommendedSchemes: () =>
    req<{ success: boolean; data: any[] }>('/schemes'),

  translateRecommendation: (activeCropId: string, language: string) =>
    req<{ success: boolean; cached: boolean; language: string; data: { aiRecommendation: string } }>('/translate', {
      method: 'POST',
      body: JSON.stringify({ activeCropId, language }),
    }),
};
