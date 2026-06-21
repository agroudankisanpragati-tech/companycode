'use client';
import { useEffect, useState, useCallback } from 'react';
import { aiFosService, FosDashboard, CropTask } from '@/services/aiFos';
import { FaSeedling, FaCheckCircle, FaClock, FaExclamationTriangle, FaRobot, FaSpinner, FaChevronRight } from 'react-icons/fa';
import Link from 'next/link';

const taskTypeIcon: Record<string, string> = {
  irrigation: '💧', fertilizer: '🌿', pesticide: '🐛',
  weeding: '✂️', monitoring: '👁️', harvest: '🌾', general: '📋',
};

const statusColor: Record<string, string> = {
  pending: 'text-amber-600 bg-amber-50 border-amber-200',
  done:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  skipped: 'text-slate-400 bg-slate-50 border-slate-200',
};

export default function TasksCard() {
  const [data, setData] = useState<FosDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await aiFosService.getDashboard();
      setData(res.data);
    } catch { /* silent — user may not have active crops yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markDone(task: CropTask) {
    if (task.status === 'done') return;
    setUpdating(task._id);
    try {
      await aiFosService.updateTaskStatus(task._id, 'done');
      await load();
    } finally { setUpdating(null); }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center justify-center h-40">
        <FaSpinner className="animate-spin text-emerald-500 text-xl" />
      </div>
    );
  }

  if (!data || data.cropData.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FaRobot className="text-emerald-600" /> AI Farm Manager
          </h4>
        </div>
        <div className="text-center py-6">
          <p className="text-3xl mb-2">🌱</p>
          <p className="text-sm font-medium text-slate-600">No active crops yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">Activate a crop to get daily AI-guided tasks</p>
          <Link
            href="/dashboard/farmer/my-crops"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <FaSeedling /> Go to My Crops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <FaRobot className="text-emerald-600" /> AI Farm Manager
        </h4>
        <Link href="/dashboard/farmer/tasks" className="text-xs text-emerald-600 flex items-center gap-1 hover:underline">
          Full View <FaChevronRight className="text-[10px]" />
        </Link>
      </div>

      {/* AI Recommendation */}
      {data.aiRecommendation && (
        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-800 leading-relaxed">
          🤖 {data.aiRecommendation}
        </div>
      )}

      {/* Crop cards */}
      <div className="divide-y divide-gray-50">
        {data.cropData.slice(0, 2).map(({ activeCrop, dayAge, todayTasks, upcomingTasks, overdueTasks }) => (
          <div key={activeCrop._id} className="p-4">
            {/* Crop header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🌾</span>
                <div>
                  <div className="text-sm font-bold text-slate-800">{activeCrop.cropName}</div>
                  <div className="text-xs text-slate-500">Day {dayAge} · {activeCrop.currentStage}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-700">{activeCrop.progressPercent}%</div>
                <div className="w-16 h-1.5 rounded-full bg-gray-200 mt-1">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${activeCrop.progressPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Overdue alert */}
            {overdueTasks.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-2 py-1.5 text-xs text-red-700">
                <FaExclamationTriangle className="flex-shrink-0" />
                {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}: {overdueTasks[0].title}
              </div>
            )}

            {/* Today's tasks */}
            {todayTasks.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Today</div>
                {todayTasks.slice(0, 3).map((task) => (
                  <div key={task._id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${statusColor[task.status]}`}>
                    <span>{taskTypeIcon[task.taskType] || '📋'}</span>
                    <span className={`flex-1 font-medium ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                      {task.title}
                    </span>
                    {task.status !== 'done' && (
                      <button
                        onClick={() => markDone(task)}
                        disabled={updating === task._id}
                        className="ml-auto flex-shrink-0 rounded-full bg-white border border-current px-2 py-0.5 text-[10px] font-semibold hover:opacity-80 disabled:opacity-50"
                      >
                        {updating === task._id ? <FaSpinner className="animate-spin text-[10px]" /> : <FaCheckCircle />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-1">No tasks scheduled for today.</div>
            )}

            {/* Upcoming */}
            {upcomingTasks.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <FaClock className="text-amber-500 flex-shrink-0" />
                Next: {upcomingTasks[0].title} in {Math.max(1, Math.ceil((new Date(upcomingTasks[0].scheduledDate).getTime() - Date.now()) / 86400000))} day{Math.ceil((new Date(upcomingTasks[0].scheduledDate).getTime() - Date.now()) / 86400000) > 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {data.cropData.length > 2 && (
        <div className="px-4 py-2 text-xs text-center text-slate-400 border-t border-gray-50">
          +{data.cropData.length - 2} more crops · <Link href="/dashboard/farmer/tasks" className="text-emerald-600 hover:underline">View all</Link>
        </div>
      )}
    </div>
  );
}
