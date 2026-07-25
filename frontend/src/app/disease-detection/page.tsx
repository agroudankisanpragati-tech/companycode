'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  FaMicroscope, FaHistory, FaSpinner, FaLock, FaFileAlt,
  FaSearch, FaFilter, FaRedo, FaWifi, FaLeaf, FaArrowRight,
} from 'react-icons/fa';

import ImageUploader from '@/components/disease/ImageUploader';
import CropVoiceInput from '@/components/disease/CropVoiceInput';
import LoadingOverlay from '@/components/disease/LoadingOverlay';
import ResultLayout from '@/components/disease/ResultLayout';
import ErrorCard from '@/components/disease/ErrorCard';
import OfflineBanner from '@/components/disease/OfflineBanner';
import { ToastContainer, useToast } from '@/hooks/useToast';
import { useDisease } from '@/hooks/useDisease';
import { useOffline } from '@/hooks/useOffline';
import { useLanguage } from '@/context/LanguageContext';
import { resolveVoiceLang } from '@/services/languageEngine';
import { useReportCache } from '@/hooks/useReportCache';
import { useNotification } from '@/hooks/useNotification';
import { usePageContext } from '@/hooks/usePageContext';
import { useVoiceGuide } from '@/hooks/useVoiceGuide';

import { ScanResult, HistoryItem } from '@/components/disease/types';

const DiseaseReport = lazy(() => import('@/components/disease/DiseaseReport'));
const DiseaseHistoryCard = lazy(() => import('@/components/disease/DiseaseHistoryCard'));

type Tab = 'scan' | 'history' | 'report';

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'}`}>
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-all ${
        done ? 'bg-emerald-500 text-white' : active ? 'bg-rose-600 text-white ring-4 ring-rose-200' : 'bg-gray-200 text-gray-500'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-rose-700' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="flex-1 h-px bg-gray-200 mx-1 hidden sm:block" />;
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
      <FaLock className="flex-shrink-0 text-amber-500" size={16} />
      <span>
        Please{' '}
        <button onClick={onLogin} className="font-bold underline underline-offset-2">login</button>
        {' '}to scan diseases and view your history.
      </span>
    </div>
  );
}

// ── Scan step tracker ─────────────────────────────────────────────────────────
function ScanSteps({ hasImage, hasCrop }: { hasImage: boolean; hasCrop: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <StepBadge n={1} label="Upload Photo" active={!hasImage} done={hasImage} />
      <StepDivider />
      <StepBadge n={2} label="Crop (Optional)" active={false} done={hasCrop} />
      <StepDivider />
      <StepBadge n={3} label="Scan" active={hasImage} done={false} />
    </div>
  );
}

export default function DiseaseDetectionPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const offline = useOffline();
  const { scan: apiScan, fetchHistory, submitFeedback } = useDisease();
  const { toasts, toast, dismiss } = useToast();
  const { langCode } = useLanguage();
  const { notify } = useNotification();
  const reportCache = useReportCache('disease');
  const voiceGuide = useVoiceGuide('disease_detection');
  // Voice lang always derived from global language context
  const voiceLang = resolveVoiceLang(langCode);

  const [tab, setTab] = useState<Tab>('scan');

  // Image state
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Crop / Language — now driven by global LanguageContext
  const [cropDisplay, setCropDisplay] = useState('');
  const [cropEnglish, setCropEnglish] = useState('');
  // voiceLangCode for CropVoiceInput still local (crop-specific picker)
  const [voiceLangCode, setVoiceLangCode] = useState(langCode);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [baseResult, setBaseResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCorrectDisease, setFeedbackCorrectDisease] = useState('');
  const [showReport, setShowReport] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [histFilter, setHistFilter] = useState('');
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);

  // Register live page context with Pragati AI — AFTER all useState declarations
  usePageContext({
    pageContext: 'disease',
    diseaseResult: result ? {
      diseaseName: result.diseaseName,
      cropName: result.cropName,
      confidence: result.confidenceScore,
      severity: result.severityLevel,
      causes: result.causes,
      organicSolution: result.organicSolution,
      chemicalSolution: result.chemicalSolution,
      prevention: result.prevention,
    } : undefined,
  });

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()); }, [stream]);

  useEffect(() => {
    if (tab === 'history' && isAuthenticated) loadHistory(1);
  }, [tab, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async (page = 1) => {
    setHistLoading(true);
    try {
      const json = await fetchHistory(page, 20);
      setHistory(json.data || []);
      setHistTotal(json.total || 0);
      setHistPage(page);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistLoading(false);
    }
  }, [fetchHistory, toast]);

  // Camera
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      toast.error('Camera access denied. Please use gallery upload.');
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const f = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null); setError(''); setFeedback(null);
      toast.success('Photo captured!');
    }, 'image/jpeg', 0.85);
    closeCamera();
  };

  const handleFile = (f: File, prev: string) => {
    setFile(f); setPreview(prev);
    setResult(null); setError(''); setFeedback(null);
  };

  const removeImage = () => {
    setFile(null); setPreview(null); setResult(null); setError(''); setFeedback(null);
  };

  // Fire-and-forget Voice Guide trigger — never blocks disease detection
  const triggerVoiceGuide = (action: () => Promise<void>) => {
    void action().catch(() => { /* Voice Guide unavailable — continue */ });
  };

  const scan = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (!file) { toast.warning('Please upload or capture a crop image first.'); return; }
    // NOTE: Do NOT block on navigator.onLine — disease detection is fully local.
    // navigator.onLine can be false on LAN-only setups even when localhost:4000 is reachable.
    // The actual connectivity error will surface from the fetch call with an accurate message.

    setScanning(true); setError(''); setResult(null); setScanStep(0);

    try {
      // ── Offline AI pipeline: Crop Verification → Disease Detection → Knowledge Base ──
      // Voice Guide is OPTIONAL and fires ASYNCHRONOUSLY — never before or during inference.
      const data = await apiScan(file, cropEnglish, (s: number) => setScanStep(s));
      setBaseResult(data);
      setResult(data);
      toast.success('✅ Prediction completed!');
      // Voice Guide executes AFTER response — fire-and-forget, never blocks
      triggerVoiceGuide(() => voiceGuide.triggerSuccess());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const msg = e.message || 'Disease scan failed. Please try again.';
      setError(msg);
      toast.error(msg);
      // Voice Guide executes AFTER error — fire-and-forget, never blocks
      triggerVoiceGuide(() => voiceGuide.triggerError());
    } finally {
      setScanning(false);
      setScanStep(0);
    }
  };

  const handleFeedback = async (type: 'helpful' | 'not_helpful', comment?: string, correctDisease?: string) => {
    if (!result?._id) return;
    try {
      await submitFeedback(result._id, type, comment, correctDisease);
      setFeedback(type);
      toast.success(type === 'helpful' ? '👍 Thank you!' : '📝 Feedback recorded.');
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setBaseResult(null);
    setError(''); setCropDisplay(''); setCropEnglish(''); setFeedback(null); setFeedbackComment(''); setFeedbackCorrectDisease(''); setShowReport(false);
    // Voice Guide is optional — fire-and-forget, never blocks reset
    triggerVoiceGuide(() => voiceGuide.triggerButton('retry') as unknown as Promise<void>);
  };

  const handleTranslated = (lang: string, data: Record<string, any>) => {
    if (lang === 'en') setResult(baseResult);
    else setResult(prev => prev ? { ...prev, ...data } : prev);
  };

  const filteredHistory = history.filter(item => {
    const matchSearch = !histSearch ||
      item.diseaseName?.toLowerCase().includes(histSearch.toLowerCase()) ||
      item.cropName?.toLowerCase().includes(histSearch.toLowerCase());
    const matchFilter = !histFilter || item.severityLevel?.toLowerCase() === histFilter;
    return matchSearch && matchFilter;
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'scan',    label: 'Scan Disease', icon: <FaMicroscope size={13} /> },
    { key: 'history', label: 'History',      icon: <FaHistory size={13} /> },
    ...(result ? [{ key: 'report' as Tab, label: 'Report', icon: <FaFileAlt size={13} /> }] : []),
  ];

  return (
    <>
      <OfflineBanner />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <main className={`min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50/40 ${offline ? 'pt-10' : ''}`}>

        {/* ── Premium Hero Header ── */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-orange-500 px-4 py-8 sm:py-10 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-orange-300/20 blur-2xl" />
          <div className="mx-auto max-w-4xl relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur border border-white/30 shadow-lg">
                <FaMicroscope className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
                    AI Powered
                  </span>
                  {offline && (
                    <span className="rounded-full bg-amber-400/30 border border-amber-300/40 px-3 py-0.5 text-[10px] font-bold text-amber-100 flex items-center gap-1">
                      <FaWifi size={8} /> Offline
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Crop Disease Scanner
                </h1>
                <p className="mt-1 text-sm text-rose-100 max-w-md">
                  Upload a crop photo — get instant AI diagnosis, treatment &amp; prevention in your language.
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-1.5 text-xs text-rose-100">
                  <FaLeaf size={10} /> Supports 20+ Indian Languages
                </div>
                <div className="flex items-center gap-1.5 text-xs text-rose-100">
                  <FaMicroscope size={10} /> 3-Layer AI Detection
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">

          {/* ── Tab Bar ── */}
          <div className="mb-6 flex gap-1.5 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                  tab === key
                    ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md shadow-rose-200/50'
                    : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ── SCAN TAB ── */}
          {tab === 'scan' && (
            <div className="space-y-4">

              {!isAuthenticated && (
                <AuthGate onLogin={() => router.push('/auth/login')} />
              )}

              {error && !scanning && (
                <ErrorCard message={error} onRetry={file ? scan : undefined} />
              )}

              {!result && !scanning && (
                <>
                  {/* Step tracker */}
                  <ScanSteps hasImage={!!file} hasCrop={!!cropEnglish} />

                  {/* Two-column layout on desktop */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Left: Upload */}
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 flex-shrink-0">
                          <span className="text-sm">📷</span>
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-slate-800">Upload Crop Photo</h2>
                          <p className="text-[11px] text-slate-400">Camera · Gallery · Drag &amp; Drop</p>
                        </div>
                      </div>
                      <ImageUploader
                        preview={preview}
                        onFile={handleFile}
                        onRemove={removeImage}
                        videoRef={videoRef}
                        cameraOpen={cameraOpen}
                        onOpenCamera={openCamera}
                        onCapture={capturePhoto}
                        onCloseCamera={closeCamera}
                      />
                    </div>

                    {/* Right: Crop + Language */}
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 flex-shrink-0">
                          <span className="text-sm">🌾</span>
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-slate-800">Crop &amp; Language</h2>
                          <p className="text-[11px] text-slate-400">Type or speak · 20+ languages</p>
                        </div>
                      </div>
                      <CropVoiceInput
                        value={cropDisplay}
                        onChange={(display, english) => { setCropDisplay(display); setCropEnglish(english); }}
                        selectedLangCode={voiceLangCode}
                        onLangChange={code => { setVoiceLangCode(code); }}
                      />
                    </div>
                  </div>

                  {/* Scan CTA */}
                  <button
                    onClick={scan}
                    disabled={!file || scanning || !isAuthenticated}
                    className="w-full rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 py-5 text-lg font-extrabold text-white shadow-xl shadow-rose-200 hover:shadow-rose-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none transition-all flex items-center justify-center gap-3"
                  >
                    <FaMicroscope size={20} />
                    {!isAuthenticated
                      ? 'Login to Scan'
                      : !file
                      ? 'Upload a Photo to Scan'
                      : 'Scan for Disease'
                    }
                    {file && isAuthenticated && <FaArrowRight size={16} />}
                  </button>
                </>
              )}

              {/* Loading */}
              {scanning && <LoadingOverlay step={scanStep} />}

              {/* Result */}
              {result && !scanning && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowReport(true)}
                      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      <FaFileAlt size={12} /> Generate Report
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition"
                    >
                      <FaRedo size={12} /> Scan Again
                    </button>
                  </div>

                  <ResultLayout
                    result={result}
                    baseResult={baseResult!}
                    uploadedPreview={preview}
                    voiceLang={voiceLang}
                    onTranslated={handleTranslated}
                    onReset={reset}
                    onFeedback={handleFeedback}
                    feedback={feedback}
                    feedbackComment={feedbackComment}
                    feedbackCorrectDisease={feedbackCorrectDisease}
                    onFeedbackCommentChange={setFeedbackComment}
                    onFeedbackCorrectDiseaseChange={setFeedbackCorrectDisease}
                  />
                </>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div>
              {!isAuthenticated ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 py-16 text-center shadow-sm">
                  <p className="text-4xl mb-3">🔒</p>
                  <p className="font-bold text-slate-700 text-lg mb-1">Login Required</p>
                  <p className="text-sm text-amber-700">
                    Please{' '}
                    <button onClick={() => router.push('/auth/login')} className="font-bold underline">login</button>
                    {' '}to view your scan history.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                      <FaSearch size={12} className="text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Search crop or disease..."
                        value={histSearch}
                        onChange={e => setHistSearch(e.target.value)}
                        className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                      <FaFilter size={11} className="text-slate-400" />
                      <select
                        value={histFilter}
                        onChange={e => setHistFilter(e.target.value)}
                        className="text-sm outline-none bg-transparent text-slate-700"
                      >
                        <option value="">All Severity</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <button
                      onClick={() => loadHistory(1)}
                      className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 shadow-sm transition"
                    >
                      <FaRedo size={11} /> Refresh
                    </button>
                  </div>

                  {histLoading ? (
                    <div className="py-16 text-center text-slate-400">
                      <FaSpinner className="mx-auto animate-spin text-3xl mb-3 text-rose-400" />
                      <p className="text-sm">Loading your scan history...</p>
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="rounded-3xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                      <p className="text-5xl mb-4">🔬</p>
                      <p className="font-bold text-slate-700 text-lg">
                        {histSearch || histFilter ? 'No matching scans' : 'No scans yet'}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        {histSearch || histFilter ? 'Try different search terms' : 'Upload a crop photo to get started.'}
                      </p>
                      {!histSearch && !histFilter && (
                        <button
                          onClick={() => setTab('scan')}
                          className="mt-5 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition"
                        >
                          Start Scanning
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
                        {filteredHistory.length} of {histTotal} scan{histTotal !== 1 ? 's' : ''}
                      </p>
                      <Suspense fallback={<div className="py-8 text-center text-slate-400"><FaSpinner className="mx-auto animate-spin" /></div>}>
                        {filteredHistory.map((item, i) => (
                          <DiseaseHistoryCard key={item._id || i} item={item} />
                        ))}
                      </Suspense>

                      {histTotal > 20 && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <button
                            disabled={histPage <= 1}
                            onClick={() => loadHistory(histPage - 1)}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-gray-50 disabled:opacity-40 transition"
                          >
                            ← Prev
                          </button>
                          <span className="text-sm text-slate-500">Page {histPage}</span>
                          <button
                            disabled={histPage * 20 >= histTotal}
                            onClick={() => loadHistory(histPage + 1)}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-gray-50 disabled:opacity-40 transition"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {tab === 'report' && result && (
            <div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 mb-4">
                <p className="font-bold">📄 AI Disease Report Ready</p>
                <p className="mt-1 text-xs">Click below to view, print or save as PDF.</p>
              </div>
              <button
                onClick={() => setShowReport(true)}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-5 text-lg font-extrabold text-white shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3"
              >
                <FaFileAlt size={20} /> Open Full Report
              </button>
            </div>
          )}

        </div>
      </main>

      {showReport && result && (
        <Suspense fallback={null}>
          <DiseaseReport
            result={result}
            uploadedPreview={preview}
            onClose={() => setShowReport(false)}
          />
        </Suspense>
      )}
    </>
  );
}
