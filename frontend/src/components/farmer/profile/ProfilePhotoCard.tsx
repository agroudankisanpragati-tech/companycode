'use client';

import { useRef, useState } from 'react';
import { FaCamera, FaTrash } from 'react-icons/fa';
import { uploadAvatar, removeAvatar } from '@/services/farmerProfile';
import { avatarUrl, nameInitials } from './types';

interface Props {
  name?: string | null;
  profileImage?: string | null;
  onUpdate: () => void;
}

export default function ProfilePhotoCard({ name, profileImage, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const src = avatarUrl(profileImage);
  const inits = nameInitials(name);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      onUpdate();
    } catch { /* silent */ } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeAvatar();
      onUpdate();
    } catch { /* silent */ } finally {
      setRemoving(false);
    }
  };

  const busy = uploading || removing;

  return (
    <div className="relative flex-shrink-0 group">
      <div className="h-24 w-24 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white">
        {src
          ? <img src={src} alt={name || 'Farmer'} className="h-full w-full object-cover" />
          : <span>{inits}</span>
        }
        {busy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
            <span className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>
        )}
      </div>

      <div className="absolute -bottom-1 -right-1 flex gap-1">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition disabled:opacity-60"
          aria-label="Upload photo"
        >
          <FaCamera size={11} />
        </button>
        {src && (
          <button
            onClick={handleRemove}
            disabled={busy}
            className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition disabled:opacity-60"
            aria-label="Remove photo"
          >
            <FaTrash size={10} />
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
