'use client';

import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FarmerSidebar from '@/components/FarmerSidebar';
import FarmerFooter from '@/components/FarmerFooter';
import { useAuth } from '@/context/AuthContext';
import {
  uploadSoilReport,
  getSoilHistory,
  getSoilReport,
  deleteSoilReport,
  SoilReport,
  SoilHistoryItem,
} from '@/services/soilHealth';
import AILanguageSelector from '@/components/AILanguageSelector';
import {
  FaUpload, FaLeaf, FaFlask, FaChartBar, FaExclamationTriangle,
  FaCheckCircle, FaSeedling, FaHistory, FaDownload, FaSpinner,
  FaArrowLeft, FaFilePdf, FaFileImage, FaTint, FaBolt, FaFire,
  FaTrash,
} from 'react-icons/fa';

const VoicePlayer = lazy(() => import('@/components/VoicePlayer'));

type PageView = 'upload' | 'analyzing' | 'result' | 'historyDetail';

const STATUS_COLOR: Record<string, string> = {
  Excellent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Good: 'text-green-600 bg-green-50 border-green-200',
  Moderate: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Poor: 'text-orange-600 bg-orange-50 border-orange-200',
  Critical: 'text-red-600 bg-red-50 border-red-200',
};

const BENCHMARK_COLOR: Record<string, string> = {
  Optimal: 'text-emerald-700 bg-emerald-50',
  Low: 'text-yellow-700 bg-yellow-50',
  High: 'text-orange-700 bg-orange-50',
  Deficient: 'text-red-700 bg-red-50',
};

const SEVERITY_COLOR: Record<string, string> = {
  Low: 'border-l-yellow-400 bg-yellow-50',
  Medium: 'border-l-orange-400 bg-orange-50',
  High: 'border-l-red-400 bg-red-50',
};

function ScoreRing({ score, status }: { score: number; status: string }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const fill = (score / 100) * circ;
  const colorMap: Record<string, string> = {
    Excellent: '#059669', Good: '#16a34a', Moderate: '#ca8a04',
    Poor: '#ea580c', Critical: '#dc2626',
  };
  const color = colorMap[status] || '#6b7280';
  return (
    <svg width={140} height={140} viewBox="0 0 140 140" className="rotate-[-90deg]">
      <circle cx={70} cy={70} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      <circle
        cx={70} cy={70} r={radius} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text
        x={70} y={70} textAnchor="middle" dominantBaseline="central"
        className="rotate-90" style={{ transform: 'rotate(90deg)', transformOrigin: '70px 70px' }}
        fontSize={24} fontWeight={800} fill={color}
      >
        {score}
      </text>
      <text
        x={70} y={92} textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: '70px 70px' }}
        fontSize={11} fill="#6b7280"
      >
        {status}
      </text>
    </svg>
  );
}

function AnalysisResult({ report, onBack, onViewCrops }: {
  report: SoilReport;
  onBack: () => void;
  onViewCrops: () => void;
}) {
  const score = report.soilHealthScore ?? 0;
  const status = report.soilHealthStatus ?? 'Moderate';

  // Multi-language translation overlay
  const [translatedData, setTranslatedData] = useState<Record<string, any> | null>(null);
  const [displayLang, setDisplayLang] = useState('en');

  const handleTranslated = (lang: string, data: Record<string, any>) => {
    setDisplayLang(lang);
    setTranslatedData(lang === 'en' ? null : data);
  };

  // Helper — returns translated value if available, else falls back to English
  const t = (key: string, fallback: any) => translatedData?.[key] ?? fallback;
  const tArr = (key: string, fallback: any) => translatedData?.[key] ?? fallback;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-emerald-700 hover:underline">
          <FaArrowLeft /> Back
        </button>
        <span className="text-xs text-slate-400">
          {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Score + Summary */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <ScoreRing score={score} status={status} />
          <span className={`mt-2 rounded-full border px-4 py-1 text-sm font-semibold ${STATUS_COLOR[status] ?? ''}`}>
            {status}
          </span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-1">Soil Health Score</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Soil Type', value: report.soilType ?? '—' },
              { label: 'pH', value: report.pH?.toFixed(1) ?? '—' },
              { label: 'Nitrogen', value: report.nitrogen ? `${report.nitrogen} kg/ha` : '—' },
              { label: 'Phosphorus', value: report.phosphorus ? `${report.phosphorus} kg/ha` : '—' },
              { label: 'Potassium', value: report.potassium ? `${report.potassium} kg/ha` : '—' },
              { label: 'Organic Carbon', value: report.organicCarbon ? `${report.organicCarbon}%` : '—' },
              { label: 'EC', value: report.ec ? `${report.ec} dS/m` : '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="font-bold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {report.aiAnalysis && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <FaLeaf /> AI Soil Analysis
            </div>
            <Suspense fallback={null}>
              <VoicePlayer text={report.aiAnalysis} lang="en-IN" autoDetect={false} label="Listen Report" />
            </Suspense>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{t('aiAnalysis', report.aiAnalysis)}</p>
          {(report as any).aiAnalysisHindi && displayLang === 'en' && (
            <div className="mt-3 border-t border-emerald-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">हिंदी विश्लेषण</span>
                <Suspense fallback={null}>
                  <VoicePlayer text={(report as any).aiAnalysisHindi} lang="hi-IN" autoDetect={false} label="सुनें" />
                </Suspense>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed italic">{(report as any).aiAnalysisHindi}</p>
            </div>
          )}
        </div>
      )}

      {/* Language Selector */}
      {(report as any)._id && (
        <AILanguageSelector
          recordId={(report as any)._id}
          module="soil"
          englishData={report as any}
          onTranslated={handleTranslated}
        />
      )}

      {/* Benchmark Comparison */}
      {report.benchmarkComparison && report.benchmarkComparison.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold">
            <FaChartBar /> Nutrient Benchmark Comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b">
                  <th className="pb-2 pr-4">Parameter</th>
                  <th className="pb-2 pr-4">Your Value</th>
                  <th className="pb-2 pr-4">Ideal Range</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.benchmarkComparison.map((row) => (
                  <tr key={row.parameter} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-700">{row.parameter}</td>
                    <td className="py-2 pr-4 text-slate-600">{String(row.farmerValue)}</td>
                    <td className="py-2 pr-4 text-slate-500">{row.idealValue}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BENCHMARK_COLOR[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {report.deficiencies && report.deficiencies.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 text-red-600 font-semibold">
            <FaExclamationTriangle /> Deficiency / Excess Detection
          </div>
          <div className="space-y-3">
            {report.deficiencies.map((d, i) => (
              <div key={i} className={`border-l-4 rounded-r-xl px-4 py-3 ${SEVERITY_COLOR[d.severity] ?? ''}`}>
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-800">
                  {d.nutrient}
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    d.type === 'Low' ? 'bg-yellow-100 text-yellow-700' :
                    d.type === 'Excess' ? 'bg-orange-100 text-orange-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>{d.type}</span>
                  <span className="text-xs text-slate-400">Severity: {d.severity}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Organic */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 text-green-700 font-semibold">
              <FaSeedling /> Organic Recommendations
            </div>
            <ul className="space-y-2">
              {tArr('recommendations', report.recommendations).organic?.map?.((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
          {/* Fertilizer */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 text-blue-700 font-semibold">
              <FaFlask /> Fertilizer Recommendations
            </div>
            <ul className="space-y-2">
              {tArr('recommendations', report.recommendations).fertilizer?.map?.((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <FaCheckCircle className="text-blue-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
            {(tArr('recommendations', report.recommendations) as any).reasoning && (
              <p className="mt-3 text-xs text-slate-500 border-t pt-3">{(tArr('recommendations', report.recommendations) as any).reasoning}</p>
            )}
          </div>
        </div>
      )}

      {/* Crop Recommendations */}
      {report.cropRecommendations && report.cropRecommendations.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <FaLeaf /> Crop Recommendations from Soil Analysis
            </div>
            <button
              onClick={onViewCrops}
              className="text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-full px-3 py-1 hover:bg-emerald-50"
            >
              Full AI Crop Advisor →
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.cropRecommendations.slice(0, 6).map((crop) => (
              <div key={crop.cropName} className="rounded-xl border border-gray-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-slate-800 text-sm">{crop.cropName}</div>
                  <span className="text-xs font-bold text-emerald-600">{crop.suitabilityScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mb-2">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${crop.suitabilityScore}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{crop.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

function MyReports({ items, loading, onSelect, onDelete }: {
  items: SoilHistoryItem[];
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteSoilReport(id);
      onDelete(id);
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <FaHistory className="text-emerald-600" />
        <h2 className="font-bold text-slate-800">My Soil Reports</h2>
        {!loading && <span className="text-xs text-slate-400 ml-1">({items.length})</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
          <FaSpinner className="animate-spin" /> Loading reports…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-dashed border-gray-200 p-8 text-center text-slate-400 text-sm">
          No reports yet. Upload your first soil report!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl border border-gray-100 bg-slate-50 p-3 flex items-center justify-between gap-2">
              <button onClick={() => onSelect(item._id)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <FaFlask className="text-sm" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">
                    {item.soilType ?? 'Soil Report'} — Score: {item.soilHealthScore ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.soilHealthStatus && (
                  <span className={`hidden sm:inline rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[item.soilHealthStatus] ?? ''}`}>
                    {item.soilHealthStatus}
                  </span>
                )}
                {item.reportUrl && (
                  <a
                    href={`${BACKEND_URL}${item.reportUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition"
                    title="Download report"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaDownload className="text-xs" />
                  </a>
                )}
                {confirmId === item._id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600 font-medium">Delete?</span>
                    <button
                      onClick={() => handleDelete(item._id)}
                      disabled={deleting}
                      className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-full"
                    >
                      {deleting ? <FaSpinner className="animate-spin" /> : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs font-bold text-slate-600 border border-gray-200 px-2 py-1 rounded-full hover:bg-gray-50"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(item._id)}
                    className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
                    title="Delete report"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SoilHealthPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<PageView>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<SoilReport | null>(null);
  const [history, setHistory] = useState<SoilHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch history on mount — reports always visible after login
  useEffect(() => {
    if (!isAuthenticated) return;
    setHistoryLoading(true);
    getSoilHistory()
      .then((res) => setHistory(res.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [isAuthenticated]);

  const processFile = useCallback(async (file: File) => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    setError('');
    setUploading(true);
    setView('analyzing');
    const stages = ['Uploading Report…', 'Running OCR…', 'Extracting Soil Parameters…', 'Running AI Analysis…', 'Calculating Soil Health Score…', 'Generating Recommendations…'];
    let i = 0;
    setStage(stages[0]);
    const interval = setInterval(() => { i = Math.min(i + 1, stages.length - 1); setStage(stages[i]); }, 2500);
    try {
      const res = await uploadSoilReport(file);
      clearInterval(interval);
      setReport(res.data);
      // Refresh history so new report appears
      getSoilHistory().then((r) => setHistory(r.data)).catch(() => {});
      setView('result');
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Analysis failed. Please try again.');
      setView('upload');
    } finally {
      setUploading(false);
    }
  }, [isAuthenticated, router]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDeleteReport = (id: string) => {
    setHistory((prev) => prev.filter((item) => item._id !== id));
  };

  const loadHistoryDetail = async (id: string) => {
    try {
      const res = await getSoilReport(id);
      setReport(res.data);
      setView('historyDetail');
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    }
  };

  const goToCropAdvisor = () => {
    if (!report) return;
    const params = new URLSearchParams({
      soilType: report.soilType ?? '',
      soilPH: String(report.pH ?? ''),
      nitrogen: String(report.nitrogen ?? ''),
      phosphorus: String(report.phosphorus ?? ''),
      potassium: String(report.potassium ?? ''),
      organicCarbon: String(report.organicCarbon ?? ''),
      ec: String(report.ec ?? ''),
      soilHealthScore: String(report.soilHealthScore ?? ''),
      fromSoilHealth: '1',
    });
    router.push(`/crop-recommendation?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FarmerSidebar open={true} onClose={() => undefined} />
      <div className="flex-1 flex flex-col">
        <header className="flex items-center px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm gap-3">
          <Link href="/dashboard/farmer" className="text-sm text-slate-500 hover:text-emerald-700 flex items-center gap-1">
            <FaArrowLeft className="text-xs" /> Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-bold text-slate-800">Soil Health</h1>
        </header>

        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 flex items-center gap-2">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {/* Upload View — always shows upload zone + My Reports side by side */}
          {view === 'upload' && (
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              {/* Left: Upload */}
              <div className="space-y-5">
                <div>
                  <span className="inline-block rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">AI-Powered</span>
                  <h2 className="mt-3 text-xl font-extrabold text-slate-900">AI Soil Health Analysis</h2>
                  <p className="mt-1 text-slate-500 text-sm">
                    Upload your soil test report (PDF, JPG, PNG) to get an instant AI analysis.
                  </p>
                </div>

                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
                    dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <FaUpload className="text-xl" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Drop your soil report here</div>
                      <div className="text-sm text-slate-400 mt-1">or click to browse</div>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><FaFilePdf className="text-red-400" /> PDF</span>
                      <span className="flex items-center gap-1"><FaFileImage className="text-blue-400" /> JPG</span>
                      <span className="flex items-center gap-1"><FaFileImage className="text-purple-400" /> PNG</span>
                    </div>
                    <div className="text-xs text-slate-300">Max file size: 10 MB</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <FaFlask className="text-blue-500" />, title: 'Nutrient Analysis', desc: 'N, P, K, pH, EC & more' },
                    { icon: <FaChartBar className="text-emerald-500" />, title: 'Health Score', desc: 'Score 0–100 with benchmarks' },
                    { icon: <FaSeedling className="text-green-500" />, title: 'Crop Picks', desc: 'Best crops for your soil' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 flex flex-col gap-1">
                      <div className="text-lg">{item.icon}</div>
                      <div className="font-semibold text-slate-800 text-xs">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: My Soil Reports — always visible */}
              <MyReports
                items={history}
                loading={historyLoading}
                onSelect={loadHistoryDetail}
                onDelete={handleDeleteReport}
              />
            </div>
          )}

          {/* Analyzing View */}
          {view === 'analyzing' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-ping opacity-30" />
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <FaSpinner className="text-3xl text-emerald-600 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800 mb-1">{stage}</div>
                <p className="text-sm text-slate-500 max-w-sm">
                  Our AI is analysing your soil report. This usually takes 15–30 seconds.
                </p>
              </div>
              <div className="flex gap-2">
                {['Uploading', 'OCR', 'Parameters', 'AI Analysis', 'Score', 'Recommendations'].map((s, i) => (
                  <div key={s} className={`h-2 w-2 rounded-full transition-all ${
                    stage.toLowerCase().includes(s.toLowerCase().split(' ')[0].toLowerCase())
                      ? 'bg-emerald-500 scale-125'
                      : 'bg-gray-200'
                  }`} />
                ))}
              </div>
            </div>
          )}

          {/* Result View */}
          {view === 'result' && report && (
            <AnalysisResult
              report={report}
              onBack={() => setView('upload')}
              onViewCrops={goToCropAdvisor}
            />
          )}

          {/* History Detail */}
          {view === 'historyDetail' && report && (
            <AnalysisResult
              report={report}
              onBack={() => setView('upload')}
              onViewCrops={goToCropAdvisor}
            />
          )}
        </main>

        <FarmerFooter />
      </div>
    </div>
  );
}
