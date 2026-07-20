'use client';

import { useRef, useState, useCallback } from 'react';
import {
  FaCamera, FaImages, FaTimes, FaCheckCircle,
  FaExclamationCircle, FaCloudUploadAlt, FaRedo, FaExpand,
} from 'react-icons/fa';

interface Props {
  preview: string | null;
  onFile: (file: File, preview: string) => void;
  onRemove: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraOpen: boolean;
  onOpenCamera: () => void;
  onCapture: () => void;
  onCloseCamera: () => void;
}

function getQuality(file: File | null) {
  if (!file) return null;
  const mb = file.size / 1024 / 1024;
  if (mb > 8) return { label: 'Too Large (>8MB)', ok: false };
  if (mb < 0.05) return { label: 'Low Quality', ok: false };
  return { label: `Good · ${mb.toFixed(1)}MB`, ok: true };
}

export default function ImageCard({ preview, onFile, onRemove, videoRef, cameraOpen, onOpenCamera, onCapture, onCloseCamera }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) return;
    setCurrentFile(f);
    onFile(f, URL.createObjectURL(f));
  }, [onFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const quality = getQuality(currentFile);

  return (
    <>
      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden cursor-pointer
          ${dragging
            ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 scale-[1.01] shadow-lg shadow-rose-100 dark:shadow-rose-900/20'
            : preview
              ? 'border-solid border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900'
              : 'border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/30 dark:hover:bg-rose-950/20'
          }`}
        onClick={!preview ? () => fileRef.current?.click() : undefined}
      >
        {preview ? (
          <div className="relative group">
            <img
              src={preview}
              alt="Crop preview"
              className="w-full max-h-72 object-contain bg-slate-50 dark:bg-slate-900"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Top-right controls */}
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setLightbox(true); }}
                className="rounded-full bg-white/90 dark:bg-slate-800/90 p-2 text-slate-600 dark:text-slate-300 shadow-lg hover:bg-white dark:hover:bg-slate-700 transition"
                aria-label="Expand image"
              >
                <FaExpand size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onRemove(); setCurrentFile(null); }}
                className="rounded-full bg-white/90 dark:bg-slate-800/90 p-2 text-slate-600 dark:text-slate-300 shadow-lg hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 transition"
                aria-label="Remove image"
              >
                <FaTimes size={11} />
              </button>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {quality && (
                <span className={`flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 px-3 py-1 text-xs font-semibold shadow ${quality.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {quality.ok ? <FaCheckCircle size={10} /> : <FaExclamationCircle size={10} />}
                  {quality.label}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow hover:bg-white dark:hover:bg-slate-700 transition"
              >
                <FaRedo size={9} /> Replace
              </button>
            </div>

            {/* Always-visible quality badge (not hover) */}
            {quality && (
              <div className={`absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 px-3 py-1 text-xs font-semibold shadow group-hover:opacity-0 transition-opacity ${quality.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {quality.ok ? <FaCheckCircle size={10} /> : <FaExclamationCircle size={10} />}
                {quality.label}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 px-4 text-center select-none">
            <div className={`rounded-2xl p-4 transition-all ${dragging ? 'bg-rose-100 dark:bg-rose-900/40 scale-110' : 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40'}`}>
              <FaCloudUploadAlt className={`text-4xl transition-all ${dragging ? 'text-rose-500 scale-110' : 'text-rose-400 dark:text-rose-500'}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {dragging ? 'Drop to upload' : 'Drop your crop photo here'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">or tap Camera / Gallery below</p>
              <p className="mt-1 text-[11px] text-slate-300 dark:text-slate-600">JPG · PNG · WEBP · Max 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <button
          onClick={onOpenCamera}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 hover:shadow-emerald-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px]"
        >
          <FaCamera size={16} /> Camera
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 py-4 text-sm font-bold text-white shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30 hover:shadow-violet-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px]"
        >
          <FaImages size={16} /> Gallery
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📸 Capture Crop Photo</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Point camera at the affected plant part</p>
              </div>
              <button
                onClick={onCloseCamera}
                className="rounded-full p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <FaTimes size={15} />
              </button>
            </div>
            <div className="relative bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover" />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white/40 rounded-2xl" />
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900">
              <button
                onClick={onCapture}
                className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 py-4 text-base font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                📸 Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute top-4 right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition">
            <FaTimes size={16} />
          </button>
          <img
            src={preview}
            alt="Full preview"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
