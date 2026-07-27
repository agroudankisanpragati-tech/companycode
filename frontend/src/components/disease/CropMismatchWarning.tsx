'use client';

import { useState } from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

interface Props {
  warning: string;           // e.g. "The uploaded image may belong to Tomato instead of Wheat."
  selectedCrop: string;
  onContinue: () => void;    // (a) continue with selected crop
  onChangeCrop: () => void;  // (b) change crop selection
  onUploadAnother: () => void; // (c) upload another image
}

export default function CropMismatchWarning({
  warning,
  selectedCrop,
  onContinue,
  onChangeCrop,
  onUploadAnother,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <FaExclamationTriangle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-800 text-sm mb-1">Crop Verification Advisory</p>
          <p className="text-amber-700 text-sm leading-relaxed">{warning}</p>
          <p className="text-amber-600 text-xs mt-1">
            Disease detection is running with your selected crop: <strong>{selectedCrop}</strong>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition"
          aria-label="Dismiss"
        >
          <FaTimes size={14} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* (a) Continue with selected crop */}
        <button
          onClick={() => { setDismissed(true); onContinue(); }}
          className="flex-1 min-w-[140px] rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
        >
          ✅ Continue with {selectedCrop}
        </button>

        {/* (b) Change crop selection */}
        <button
          onClick={onChangeCrop}
          className="flex-1 min-w-[140px] rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 transition"
        >
          🔄 Change Crop
        </button>

        {/* (c) Upload another image */}
        <button
          onClick={onUploadAnother}
          className="flex-1 min-w-[140px] rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 transition"
        >
          📷 Upload Another Image
        </button>
      </div>
    </div>
  );
}
