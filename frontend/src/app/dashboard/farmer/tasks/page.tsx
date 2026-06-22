'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import FarmerSidebar from '@/components/FarmerSidebar';
import FarmerFooter from '@/components/FarmerFooter';
import ProtectedRoute from '@/components/ProtectedRoute';
import { aiFosService, FosDashboard, CropTask, CropDashboardEntry } from '@/services/aiFos';
import {
  FaRobot, FaSeedling, FaCheckCircle, FaClock, FaExclamationTriangle,
  FaLeaf, FaSpinner, FaChevronDown, FaChevronUp, FaTrophy,
} from 'react-icons/fa';

const taskTypeIcon: Record<string, string> = {
  irrigation: '💧', fertilizer: '🌿', pesticide: '🐛',
  weeding: '✂️', monitoring: '👁️', harvest: '🌾', general: '📋',
};

const stageColors: Record<string, string> = {
  'Germination':      'bg-lime-100 text-lime-700',
  'Nursery':          'bg-lime-100 text-lime-700',
  'Tillering':        'bg-emerald-100 text-emerald-700',
  'Vegetative':       'bg-emerald-100 text-emerald-700',
  'Flowering':        'bg-pink-100 text-pink-700',
  'Panicle Init':     'bg-pink-100 text-pink-700',
  'Heading':          'bg-amber-100 text-amber-700',
  'Grain Filling':    'bg-orange-100 text-orange-700',
  'Pod Formation':    'bg-orange-100 text-orange-700',
  'Maturity':         'bg-red-100 text-red-700',
  'Harvest Ready':    'bg-red-100 text-red-700',
  'Land Preparation': 'bg-slate-100 text-slate-600',
};

export default function TasksPage() {
  return <ProtectedRoute><TasksContent /></ProtectedRoute>;
}

function TasksContent() {
  const [data, setData] = useState<FosDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [schemes, setSchemes] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<Record<string, CropTask[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, schemeRes] = await Promise.all([
        aiFosService.getDashboard(),
        aiFosService.getRecommendedSchemes().catch(() => ({ data: [] })),
      ]);
      setData(dashRes.data);
      setSchemes(schemeRes.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadAllTasks(activeCropId: string) {
    if (allTasks[activeCropId]) return;
    const res = await aiFosService.getTasksForCrop(activeCropId);
    setAllTasks((prev) => ({ ...prev, [activeCropId]: res.data }));
  }

  async function markTask(taskId: string, status: 'done' | 'skipped' | 'pending') {
    setUpdating(taskId);
    try {
      await aiFosService.updateTaskStatus(taskId, status);
      await load();
    } finally { setUpdating(null); }
  }

  async function markHarvested(id: string) {
    if (!confirm('Mark this crop as harvested?')) return;
    await aiFosService.markHarvested(id);
    await load();
  }

  function toggleExpand(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    if (!expanded[id]) loadAllTasks(id);
  }

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50">
      <FarmerSidebar open onClose={() => undefined} />
      <div className="flex-1 flex items-center justify-center">
        <FaSpinner className="animate-spin text-emerald-500 text-3xl" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FarmerSidebar open onClose={() => undefined} />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                <FaRobot className="text-emerald-600" /> AI Farm Manager
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Your AI-powered daily farm operating system</p>
            </div>
            <Link
              href="/dashboard/farmer/my-crops"
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <FaSeedling /> Activate Crop
            </Link>
          </div>

          {/* No crops state */}
          {!data || data.cropData.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-5xl mb-3">🌱</p>
              <p className="text-lg font-bold text-slate-700">No active crops</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Go to My Crops, select a crop and click "Activate" to start your AI farm plan.</p>
              <Link href="/dashboard/farmer/my-crops" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <FaSeedling /> Open My Crops
              </Link>
            </div>
          ) : (
            <div className="space-y-6">

              {/* AI Recommendation Banner */}
              {data.aiRecommendation && (
                <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white shadow-md">
                  <div className="flex items-start gap-3">
                    <FaRobot className="text-white text-xl flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-100 mb-1">AI Daily Insight</div>
                      <p className="text-sm leading-relaxed">{data.aiRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Context snapshot */}
              <div className="grid grid-cols-3 gap-3">
                <SnapCard label="Soil Moisture" value={data.contextSnapshot.moisture ? `${data.contextSnapshot.moisture.pct}% · ${data.contextSnapshot.moisture.status}` : 'No data'} icon="💧" />
                <SnapCard label="Soil Health"   value={data.contextSnapshot.soilScore   ? `Score ${data.contextSnapshot.soilScore}/100`  : 'No report'} icon="🌍" />
                <SnapCard label="Mandi Price"   value={data.contextSnapshot.marketPrice  ? `₹${data.contextSnapshot.marketPrice.price.toLocaleString('en-IN')} · ${data.contextSnapshot.marketPrice.crop}` : 'No data'} icon="📈" />
              </div>

              {/* Crop cards */}
              {data.cropData.map((entry) => (
                <CropCard
                  key={entry.activeCrop._id}
                  entry={entry}
                  updating={updating}
                  expanded={!!expanded[entry.activeCrop._id]}
                  allTasks={allTasks[entry.activeCrop._id] || []}
                  onToggle={() => toggleExpand(entry.activeCrop._id)}
                  onMark={markTask}
                  onHarvest={() => markHarvested(entry.activeCrop._id)}
                />
              ))}

              {/* Scheme recommendations */}
              {schemes.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span>🏛️</span> Recommended Government Schemes
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {schemes.slice(0, 4).map((s) => (
                      <Link key={s._id} href={`/schemes/${s.slug}`}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-emerald-50 hover:border-emerald-200 transition"
                      >
                        <div className="text-sm font-semibold text-slate-800 truncate">{s.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.summary}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
        <FarmerFooter />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SnapCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xs font-semibold text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}

function CropCard({ entry, updating, expanded, allTasks, onToggle, onMark, onHarvest }: {
  entry: CropDashboardEntry;
  updating: string | null;
  expanded: boolean;
  allTasks: CropTask[];
  onToggle: () => void;
  onMark: (id: string, s: 'done' | 'skipped' | 'pending') => void;
  onHarvest: () => void;
}) {
  const { activeCrop, dayAge, todayTasks, upcomingTasks, overdueTasks } = entry;
  const stageClass = stageColors[activeCrop.currentStage] || 'bg-slate-100 text-slate-600';
  const daysLeft = Math.max(0, activeCrop.growingDurationDays - dayAge);

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Crop header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-2xl">🌾</div>
            <div>
              <div className="font-bold text-slate-900">{activeCrop.cropName}</div>
              <div className="text-xs text-slate-500">{activeCrop.fieldLabel} · Day {dayAge} of {activeCrop.growingDurationDays}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stageClass}`}>{activeCrop.currentStage}</span>
            <span className="text-sm font-bold text-emerald-700">{activeCrop.progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all" style={{ width: `${activeCrop.progressPercent}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>Sowing: {new Date(activeCrop.sowingDate).toLocaleDateString('en-IN')}</span>
          <span>{daysLeft} days to harvest</span>
        </div>
      </div>

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-xs text-red-700">
          <FaExclamationTriangle className="flex-shrink-0" />
          <span className="font-medium">{overdueTasks.length} overdue: </span>
          {overdueTasks.slice(0, 2).map((t) => t.title).join(', ')}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Today's tasks */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Today's Tasks</div>
          {todayTasks.length === 0
            ? <p className="text-xs text-slate-400">No tasks scheduled for today — your crop is on track.</p>
            : todayTasks.map((task) => <TaskRow key={task._id} task={task} updating={updating} onMark={onMark} />)
          }
        </div>

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Upcoming (next 7 days)</div>
            {upcomingTasks.map((task) => (
              <div key={task._id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                <FaClock className="text-amber-500 flex-shrink-0" />
                <span>{taskTypeIcon[task.taskType] || '📋'} {task.title}</span>
                <span className="ml-auto text-slate-400">
                  {new Date(task.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Full timeline toggle */}
        <button onClick={onToggle} className="w-full flex items-center justify-center gap-1 text-xs text-emerald-600 hover:underline pt-1">
          {expanded ? <><FaChevronUp /> Hide full timeline</> : <><FaChevronDown /> Show full timeline ({allTasks.length || '…'} tasks)</>}
        </button>

        {expanded && allTasks.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-1 max-h-72 overflow-y-auto">
            {allTasks.map((task) => <TaskRow key={task._id} task={task} updating={updating} onMark={onMark} compact />)}
          </div>
        )}

        {/* Harvest button */}
        {activeCrop.progressPercent >= 80 && (
          <button
            onClick={onHarvest}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
          >
            <FaTrophy /> Mark as Harvested
          </button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, updating, onMark, compact }: {
  task: CropTask;
  updating: string | null;
  onMark: (id: string, s: 'done' | 'skipped' | 'pending') => void;
  compact?: boolean;
}) {
  const isDone = task.status === 'done';
  return (
    <div className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition ${isDone ? 'opacity-50' : 'hover:bg-gray-50'}`}>
      <span className="flex-shrink-0 mt-0.5">{taskTypeIcon[task.taskType] || '📋'}</span>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-slate-800 ${isDone ? 'line-through' : ''}`}>{task.title}</div>
        {!compact && task.description && (
          <div className="text-slate-500 mt-0.5 leading-relaxed">{task.description}</div>
        )}
        <div className="text-slate-400 mt-0.5">Day {task.dayNumber} · {new Date(task.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
      </div>
      <button
        onClick={() => onMark(task._id, isDone ? 'pending' : 'done')}
        disabled={updating === task._id}
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition ${
          isDone
            ? 'border-emerald-300 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
            : 'border-gray-300 text-slate-500 bg-white hover:border-emerald-400 hover:text-emerald-600'
        }`}
      >
        {updating === task._id
          ? <FaSpinner className="animate-spin text-[10px]" />
          : isDone ? <FaCheckCircle /> : '○'
        }
      </button>
    </div>
  );
}
