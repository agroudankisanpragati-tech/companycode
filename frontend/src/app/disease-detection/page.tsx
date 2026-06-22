'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FaMicroscope, FaUpload, FaCamera, FaHistory, FaLeaf, FaExclamationTriangle, FaCheckCircle, FaSpinner, FaTimes } from 'react-icons/fa';

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ScanResult = {
  _id?: string;
  cropName: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: string;
  symptoms: string;
  treatment: string;
  prevention: string;
  description: string;
  imageUrl?: string;
  source?: string;
  similarityScore?: number;
};

type HistoryItem = ScanResult & { createdAt: string; feedback?: string };

const severityColor = (s: string) => {
  if (s === 'critical') return 'bg-red-100 text-red-800 border-red-200';
  if (s === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (s === 'medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

const sourceLabel = (s?: string) => {
  if (s === 'cache') return { text: '📊 Cached Result', cls: 'bg-blue-100 text-blue-700' };
  if (s === 'knowledge_base') return { text: '📚 Knowledge Base', cls: 'bg-purple-100 text-purple-700' };
  return { text: '🤖 AI Analysis', cls: 'bg-emerald-100 text-emerald-700' };
};

export default function DiseaseDetectionPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [tab, setTab] = useState<'scan' | 'history'>('scan');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cropHint, setCropHint] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (tab === 'history' && isAuthenticated) loadHistory();
  }, [tab, isAuthenticated]);

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()); }, [stream]);

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await fetch(`${API_BASE}/disease/history`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setHistory(json.data || []);
    } catch { /* silent */ }
    setHistLoading(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null); setError(''); setFeedback(null);
  };

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      setError('Camera access denied. Please use file upload instead.');
    }
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
    }, 'image/jpeg', 0.9);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null); setCameraOpen(false);
  };

  const scan = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (!file) { setError('Please upload or capture a crop image first.'); return; }
    setScanning(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (cropHint.trim()) fd.append('cropName', cropHint.trim());
      const res = await fetch(`${API_BASE}/disease/scan`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Scan failed');
      setResult({ ...json.data, source: json.source, similarityScore: json.similarityScore });
    } catch (e: any) {
      setError(e.message || 'Disease scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const submitFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (!result?._id) return;
    try {
      await fetch(`${API_BASE}/disease/feedback`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: result._id, feedback: type }),
      });
      setFeedback(type);
    } catch { /* silent */ }
  };

  const reset = () => {
    setFile(null); setPreview(null); setResult(null);
    setError(''); setCropHint(''); setFeedback(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">

        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
            <FaMicroscope /> AI Disease Detection
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Crop Disease Scanner
          </h1>
          <p className="mt-2 text-slate-500">Upload a crop photo — get instant disease diagnosis, treatment & prevention.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
          {[
            { key: 'scan', label: 'Scan Disease', icon: FaMicroscope },
            { key: 'history', label: 'Scan History', icon: FaHistory },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === key ? 'bg-rose-600 text-white shadow' : 'text-slate-600 hover:bg-rose-50'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* SCAN TAB */}
        {tab === 'scan' && (
          <div className="space-y-5">
            {!isAuthenticated && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                Please <button onClick={() => router.push('/auth/login')} className="font-bold underline">login</button> to scan diseases and view your history.
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Upload area */}
            {!result && (
              <div className="rounded-3xl border-2 border-dashed border-rose-200 bg-white p-6">
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="preview" className="mx-auto max-h-72 rounded-2xl object-contain shadow" />
                    <button onClick={reset} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-500 shadow hover:text-red-500">
                      <FaTimes size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="rounded-2xl bg-rose-100 p-4">
                      <FaMicroscope className="text-3xl text-rose-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Upload a clear photo of the affected crop</p>
                    <p className="text-xs text-slate-400">Leaves, stems, roots, or fruits • JPG / PNG • Max 10MB</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition">
                    <FaUpload size={13} /> Upload Image
                  </button>
                  <button onClick={openCamera} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                    <FaCamera size={13} /> Use Camera
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
              </div>
            )}

            {/* Camera Modal */}
            {cameraOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
                  <h3 className="mb-3 text-lg font-bold text-slate-800">Capture Crop Photo</h3>
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black" />
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => { stream?.getTracks().forEach(t => t.stop()); setStream(null); setCameraOpen(false); }} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={capturePhoto} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">📸 Capture</button>
                  </div>
                </div>
              </div>
            )}

            {/* Crop hint + scan button */}
            {!result && (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Crop Name (optional — improves accuracy)
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. Wheat, Rice, Tomato, Cotton..."
                  value={cropHint}
                  onChange={e => setCropHint(e.target.value)}
                />
                <button
                  onClick={scan}
                  disabled={!file || scanning}
                  className="mt-4 w-full rounded-2xl bg-rose-600 py-3 text-sm font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {scanning ? <><FaSpinner className="animate-spin" /> Analyzing Image...</> : <><FaMicroscope /> Scan for Disease</>}
                </button>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-4">
                {/* Result header */}
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityColor(result.severityLevel)}`}>
                          {result.severityLevel} severity
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceLabel(result.source).cls}`}>
                          {sourceLabel(result.source).text}
                        </span>
                        {result.similarityScore && (
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                            {result.similarityScore}% Match
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-extrabold text-slate-900">{result.diseaseName}</h2>
                      <p className="text-sm text-slate-500">{result.cropName} · {result.diseaseType}</p>
                    </div>
                    {result.imageUrl && (
                      <img src={`http://localhost:4000${result.imageUrl}`} alt="scanned" className="h-20 w-20 rounded-2xl object-cover shadow border" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{result.description}</p>
                </div>

                {/* Symptoms */}
                {result.symptoms && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-800"><FaExclamationTriangle size={14} /> Symptoms</h3>
                    <p className="whitespace-pre-line text-sm text-amber-900">{result.symptoms}</p>
                  </div>
                )}

                {/* Treatment */}
                {result.treatment && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                    <h3 className="mb-2 font-bold text-blue-800">💊 Treatment</h3>
                    <p className="whitespace-pre-line text-sm text-blue-900">{result.treatment}</p>
                  </div>
                )}

                {/* Prevention */}
                {result.prevention && (
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                    <h3 className="mb-2 flex items-center gap-2 font-bold text-green-800"><FaLeaf size={14} /> Prevention</h3>
                    <p className="whitespace-pre-line text-sm text-green-900">{result.prevention}</p>
                  </div>
                )}

                {/* Feedback */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-700">Was this diagnosis helpful?</p>
                  <div className="flex gap-2">
                    <button onClick={() => submitFeedback('helpful')} disabled={!!feedback}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${feedback === 'helpful' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                      👍 Yes
                    </button>
                    <button onClick={() => submitFeedback('not_helpful')} disabled={!!feedback}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${feedback === 'not_helpful' ? 'bg-red-500 text-white' : 'border border-red-200 text-red-600 hover:bg-red-50'}`}>
                      👎 No
                    </button>
                  </div>
                </div>

                <button onClick={reset} className="w-full rounded-2xl border border-rose-200 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 transition">
                  ← Scan Another Crop
                </button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            {!isAuthenticated ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-sm text-amber-800">
                Please <button onClick={() => router.push('/auth/login')} className="font-bold underline">login</button> to view your scan history.
              </div>
            ) : histLoading ? (
              <div className="py-16 text-center text-slate-400"><FaSpinner className="mx-auto animate-spin text-2xl mb-2" /><p>Loading history...</p></div>
            ) : history.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-white py-16 text-center">
                <FaMicroscope className="mx-auto text-4xl text-slate-300 mb-3" />
                <p className="text-slate-500">No scans yet. Upload a crop photo to get started.</p>
                <button onClick={() => setTab('scan')} className="mt-4 rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700">Start Scanning</button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item, i) => (
                  <article key={item._id || i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{item.diseaseName}</h3>
                        <p className="text-xs text-slate-500">{item.cropName} · {item.diseaseType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityColor(item.severityLevel)}`}>{item.severityLevel}</span>
                        <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    {item.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
                    {item.feedback && (
                      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.feedback === 'helpful' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {item.feedback === 'helpful' ? '👍 Helpful' : '👎 Not Helpful'}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
