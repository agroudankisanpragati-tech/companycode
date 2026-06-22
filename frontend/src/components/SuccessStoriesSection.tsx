'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  FaPlay, FaHeart, FaBookmark, FaShare, FaUpload,
  FaTimes, FaSpinner, FaChevronUp, FaChevronDown,
  FaLeaf, FaCheck,
} from 'react-icons/fa';

const API_BASE = '/api';
const ASSET_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000')
    : 'http://localhost:4000';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Story = {
  _id: string;
  farmerName: string;
  village?: string;
  state?: string;
  cropName?: string;
  title: string;
  caption?: string;
  category: string;
  videoUrl: string;
  thumbnailUrl?: string;
  likes: number;
  views: number;
  likedBy: string[];
  savedBy: string[];
  createdAt: string;
};

const CATEGORIES = ['All', 'Success Story', 'Organic Farming', 'Medicinal Farming', 'High Profit Farming', 'Innovation', 'Water Saving', 'Technology Adoption'];

// ─── Reels Viewer Modal ───────────────────────────────────────────────────────
function ReelsViewer({
  stories,
  startIndex,
  onClose,
  userId,
  onStoryUpdate,
}: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  userId?: string;
  onStoryUpdate: (id: string, likes: number, liked: boolean, saved: boolean) => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const story = stories[idx];

  useEffect(() => {
    if (!story || !userId) return;
    setLikedMap(p => ({ ...p, [story._id]: story.likedBy.includes(userId) }));
    setSavedMap(p => ({ ...p, [story._id]: story.savedBy.includes(userId) }));
    setLikesMap(p => ({ ...p, [story._id]: story.likes }));
  }, [idx, story, userId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const go = (dir: 1 | -1) => {
    const next = idx + dir;
    if (next >= 0 && next < stories.length) setIdx(next);
  };

  // touch swipe
  const touchStartY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
  };

  const handleLike = async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/farmer-stories/${story._id}/like`, {
      method: 'POST', headers: authHeaders(),
    });
    const json = await res.json();
    if (res.ok) {
      setLikedMap(p => ({ ...p, [story._id]: json.liked }));
      setLikesMap(p => ({ ...p, [story._id]: json.likes }));
      onStoryUpdate(story._id, json.likes, json.liked, savedMap[story._id] || false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    const res = await fetch(`${API_BASE}/farmer-stories/${story._id}/save`, {
      method: 'POST', headers: authHeaders(),
    });
    const json = await res.json();
    if (res.ok) {
      setSavedMap(p => ({ ...p, [story._id]: json.saved }));
      onStoryUpdate(story._id, likesMap[story._id] || story.likes, likedMap[story._id] || false, json.saved);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: story.title, text: story.caption || story.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Close */}
      <button onClick={onClose} className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
        <FaTimes size={18} />
      </button>

      {/* Story counter */}
      <div className="absolute left-4 top-4 z-50 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
        {idx + 1} / {stories.length}
      </div>

      {/* Nav arrows — desktop */}
      {idx > 0 && (
        <button onClick={() => go(-1)} className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 hidden md:block">
          <FaChevronUp size={16} />
        </button>
      )}
      {idx < stories.length - 1 && (
        <button onClick={() => go(1)} className="absolute right-20 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 hidden md:block">
          <FaChevronDown size={16} />
        </button>
      )}

      <div
        ref={containerRef}
        className="relative h-full max-h-screen w-full max-w-sm mx-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Video */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          loop
          playsInline
          controls={false}
          onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
        >
          <source src={`${ASSET_BASE}${story.videoUrl}`} />
        </video>

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Info */}
        <div className="absolute bottom-4 left-4 right-16 text-white">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">
              {story.farmerName[0]}
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{story.farmerName}</p>
              {(story.village || story.state) && (
                <p className="text-xs text-white/70">{[story.village, story.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-0.5">{story.title}</h3>
          {story.caption && <p className="text-xs text-white/80 line-clamp-2">{story.caption}</p>}
          {story.cropName && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-xs text-emerald-200">
              <FaLeaf size={10} /> {story.cropName}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute bottom-4 right-3 flex flex-col items-center gap-4 text-white">
          <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
            <FaHeart className={likedMap[story._id] ? 'text-red-500 text-2xl' : 'text-white text-2xl'} />
            <span className="text-xs">{likesMap[story._id] ?? story.likes}</span>
          </button>
          <button onClick={handleSave} className="flex flex-col items-center gap-0.5">
            <FaBookmark className={savedMap[story._id] ? 'text-yellow-400 text-2xl' : 'text-white text-2xl'} />
            <span className="text-xs">Save</span>
          </button>
          <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
            <FaShare className="text-white text-2xl" />
            <span className="text-xs">Share</span>
          </button>
        </div>

        {/* Swipe hint mobile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100">
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onSuccess, user }: { onClose: () => void; onSuccess: () => void; user: any }) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [cropName, setCropName] = useState('');
  const [village, setVillage] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('Success Story');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) { setError('Please select a video file.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      if (thumbFile) fd.append('thumbnail', thumbFile);
      fd.append('title', title);
      fd.append('caption', caption);
      fd.append('cropName', cropName);
      fd.append('village', village);
      fd.append('state', state);
      fd.append('category', category);
      fd.append('farmerName', user?.name || 'Farmer');

      const res = await fetch(`${API_BASE}/farmer-stories/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Share Your Story 🌾</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-gray-100"><FaTimes /></button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Video File * (MP4, max 200MB)</label>
            <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Thumbnail (optional)</label>
            <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Story Title *</label>
            <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My wheat harvest tripled this season!" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Crop Name</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" value={cropName} onChange={e => setCropName(e.target.value)} placeholder="e.g. Wheat" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Village</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" value={village} onChange={e => setVillage(e.target.value)} placeholder="Your village" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">State</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Punjab" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Caption</label>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none min-h-[70px]" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Share your experience..." />
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            📋 Your story will be reviewed and published within 24 hours.
          </div>
          <button type="submit" disabled={submitting}
            className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
            {submitting ? <><FaSpinner className="animate-spin" /> Uploading...</> : <><FaUpload /> Submit Story</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Story Card (thumbnail grid) ──────────────────────────────────────────────
function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  return (
    <div onClick={onClick} className="relative cursor-pointer group overflow-hidden rounded-2xl bg-slate-900 aspect-[9/16]">
      {story.thumbnailUrl ? (
        <img
          src={`${ASSET_BASE}${story.thumbnailUrl}`}
          alt={story.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-emerald-800 to-green-600 flex items-center justify-center">
          <FaLeaf className="text-4xl text-white/40" />
        </div>
      )}
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rounded-full bg-white/90 p-3 shadow-lg">
          <FaPlay className="text-emerald-700 text-lg ml-0.5" />
        </div>
      </div>
      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-xs font-semibold text-white line-clamp-1">{story.title}</p>
        <p className="text-[10px] text-white/70">{story.farmerName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-white/60 flex items-center gap-1"><FaHeart size={8} /> {story.likes}</span>
        </div>
      </div>
      {/* Category badge */}
      <div className="absolute top-2 left-2">
        <span className="rounded-full bg-emerald-500/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
          {story.category.split(' ')[0]}
        </span>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export default function SuccessStoriesSection() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState<'latest' | 'trending' | 'featured'>('latest');
  const [reelsOpen, setReelsOpen] = useState(false);
  const [reelsStartIdx, setReelsStartIdx] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: activeFilter, limit: '12' });
      if (activeCategory !== 'All') params.set('category', activeCategory);
      const res = await fetch(`${API_BASE}/farmer-stories?${params}`);
      const json = await res.json();
      if (res.ok) setStories(json.data || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [activeFilter, activeCategory]);

  useEffect(() => { load(); }, [load]);

  const openReel = (idx: number) => { setReelsStartIdx(idx); setReelsOpen(true); };

  const handleStoryUpdate = (id: string, likes: number, liked: boolean, saved: boolean) => {
    setStories(prev => prev.map(s => s._id === id ? { ...s, likes } : s));
  };

  return (
    <section className="px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-2xl">🌾</span> Farmer Success Stories
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Real stories from real farmers across India</p>
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow"
            >
              <FaUpload size={11} /> Share Your Story
            </button>
          )}
          <button
            onClick={() => router.push('/farmer-stories')}
            className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
          >
            View All
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <FaCheck /> {successMsg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {(['latest', 'trending', 'featured'] as const).map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${activeFilter === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {f === 'trending' ? '🔥 Trending' : f === 'featured' ? '⭐ Featured' : '🕒 Latest'}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${activeCategory === cat ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stories grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <FaSpinner className="animate-spin text-2xl mr-2" /> Loading stories...
        </div>
      ) : stories.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <p className="text-slate-500 font-medium">No stories yet</p>
          <p className="text-xs text-slate-400 mt-1">Be the first to share your farming success!</p>
          {isAuthenticated && (
            <button onClick={() => setUploadOpen(true)} className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Share Story
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stories.map((story, i) => (
            <StoryCard key={story._id} story={story} onClick={() => openReel(i)} />
          ))}
        </div>
      )}

      {/* Reels Viewer */}
      {reelsOpen && (
        <ReelsViewer
          stories={stories}
          startIndex={reelsStartIdx}
          onClose={() => setReelsOpen(false)}
          userId={user?.id}
          onStoryUpdate={handleStoryUpdate}
        />
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={() => { setSuccessMsg('Story submitted! It will be visible after admin approval.'); load(); setTimeout(() => setSuccessMsg(''), 5000); }}
          user={user}
        />
      )}
    </section>
  );
}
