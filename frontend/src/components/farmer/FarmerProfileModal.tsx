"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FaUser, FaTimes, FaLeaf, FaSeedling, FaMapMarkerAlt,
  FaPhone, FaEnvelope, FaLock, FaTrash, FaCamera,
  FaCheck, FaEdit,
} from "react-icons/fa";
import { MdLandscape } from "react-icons/md";

const tabs = [
  { id: 0, label: "Personal",     icon: FaUser },
  { id: 1, label: "Farm",         icon: FaSeedling },
  { id: 2, label: "Land",         icon: MdLandscape },
  { id: 3, label: "Crop History", icon: FaLeaf },
  { id: 4, label: "Language",     icon: FaLeaf },
  { id: 5, label: "Security",     icon: FaLock },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FarmerProfileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "KP";

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" />

      {/* Modal Panel */}
      <div
        className="relative z-10 w-full sm:max-w-4xl max-h-[96vh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* ── Header ── */}
        <div className="relative flex items-center gap-4 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-700 to-emerald-500 flex-shrink-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="h-14 w-14 rounded-2xl bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {user?.profileImage
                ? <img src={user.profileImage} alt={user?.name} className="h-full w-full object-cover" />
                : <span>{initials}</span>
              }
            </div>
            <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md hover:bg-emerald-50 transition">
              <FaCamera size={10} />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-white truncate">{user?.name ?? "Farmer"}</div>
            <div className="flex items-center gap-1 text-xs text-emerald-100">
              <FaMapMarkerAlt size={10} />
              <span className="truncate">{(user as any)?.location?.state ?? "Location not set"}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 mr-2">
            <div className="text-center">
              <div className="text-base font-bold text-white">1,240</div>
              <div className="text-[10px] text-emerald-200 uppercase tracking-wider">Points</div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <div className="text-base font-bold text-white">2</div>
              <div className="text-[10px] text-emerald-200 uppercase tracking-wider">Farms</div>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-auto flex-shrink-0 h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            aria-label="Close profile"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* ── Tab Pills ── */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 overflow-x-auto flex-shrink-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  active === tab.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200/50"
                    : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <Icon size={11} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Personal Details */}
          {active === 0 && (
            <div className="space-y-4">
              <SectionTitle title="Personal Details" subtitle="Update your name, contact, and bio." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Full Name" icon={<FaUser size={12} />}>
                  <input
                    defaultValue={user?.name ?? ""}
                    placeholder="Full name"
                    className="input-field"
                  />
                </FieldGroup>
                <FieldGroup label="Phone" icon={<FaPhone size={12} />}>
                  <input
                    defaultValue={user?.phone ?? ""}
                    placeholder="+91 XXXXX XXXXX"
                    className="input-field"
                  />
                </FieldGroup>
                <FieldGroup label="Email" icon={<FaEnvelope size={12} />} className="sm:col-span-2">
                  <input
                    defaultValue={user?.email ?? ""}
                    placeholder="email@example.com"
                    className="input-field"
                    type="email"
                  />
                </FieldGroup>
                <FieldGroup label="Short Bio" className="sm:col-span-2">
                  <textarea
                    placeholder="Tell something about yourself and your farm..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </FieldGroup>
              </div>
              <SaveButton onSave={handleSave} saved={saved} />
            </div>
          )}

          {/* Farm Details */}
          {active === 1 && (
            <div className="space-y-4">
              <SectionTitle title="Farm Details" subtitle="Add information about your farm." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Farm Name">
                  <input placeholder="e.g. Shri Ram Farm" className="input-field" />
                </FieldGroup>
                <FieldGroup label="Farm Size (acres)">
                  <input placeholder="e.g. 5.5" type="number" className="input-field" />
                </FieldGroup>
                <FieldGroup label="Irrigation Type">
                  <select className="input-field">
                    <option value="">Select...</option>
                    <option>Drip</option>
                    <option>Sprinkler</option>
                    <option>Canal</option>
                    <option>Rainfed</option>
                    <option>Borewell</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Soil Type">
                  <select className="input-field">
                    <option value="">Select...</option>
                    <option>Black (Cotton Soil)</option>
                    <option>Red</option>
                    <option>Alluvial</option>
                    <option>Sandy</option>
                    <option>Clay</option>
                    <option>Loamy</option>
                  </select>
                </FieldGroup>
              </div>
              <SaveButton onSave={handleSave} saved={saved} />
            </div>
          )}

          {/* Land Information */}
          {active === 2 && (
            <div className="space-y-4">
              <SectionTitle title="Land Information" subtitle="Manage your land plots and ownership." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldGroup label="Plot / Khasra No.">
                  <input placeholder="e.g. 123/A" className="input-field" />
                </FieldGroup>
                <FieldGroup label="Area (hectares)">
                  <input placeholder="e.g. 2.2" type="number" className="input-field" />
                </FieldGroup>
                <FieldGroup label="Ownership Type">
                  <select className="input-field">
                    <option value="">Select...</option>
                    <option>Owned</option>
                    <option>Leased</option>
                    <option>Rented</option>
                    <option>Shared</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Survey No. / Coordinates">
                  <input placeholder="Survey no. or GPS coords" className="input-field" />
                </FieldGroup>
              </div>
              <SaveButton onSave={handleSave} saved={saved} />
            </div>
          )}

          {/* Crop History */}
          {active === 3 && (
            <div className="space-y-4">
              <SectionTitle title="Crop History" subtitle="Track what you've grown in past seasons." />
              <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
                <div className="text-4xl mb-2">🌾</div>
                <p className="text-sm text-gray-500">No crop history yet.</p>
                <p className="text-xs text-gray-400 mt-1">Start adding records to track your yield over time.</p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-200/50">
                  <FaLeaf size={12} />
                  Add Crop Record
                </button>
              </div>
            </div>
          )}

          {/* Language Preferences */}
          {active === 4 && (
            <div className="space-y-4">
              <SectionTitle title="Language Preferences" subtitle="Choose your preferred app language." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { lang: "Hindi", native: "हिन्दी" },
                  { lang: "English", native: "English" },
                  { lang: "Punjabi", native: "ਪੰਜਾਬੀ" },
                  { lang: "Gujarati", native: "ગુજરાતી" },
                  { lang: "Marathi", native: "मराठी" },
                  { lang: "Tamil", native: "தமிழ்" },
                  { lang: "Telugu", native: "తెలుగు" },
                  { lang: "Kannada", native: "ಕನ್ನಡ" },
                  { lang: "Bengali", native: "বাংলা" },
                ].map(({ lang, native }) => (
                  <button
                    key={lang}
                    className={`flex flex-col items-start gap-0.5 rounded-2xl border px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 ${
                      lang === "Hindi" ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200" : "border-gray-200"
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-800">{lang}</span>
                    <span className="text-xs text-gray-400">{native}</span>
                  </button>
                ))}
              </div>
              <SaveButton onSave={handleSave} saved={saved} label="Save Language" />
            </div>
          )}

          {/* Security / Account Settings */}
          {active === 5 && (
            <div className="space-y-5">
              <SectionTitle title="Security & Account" subtitle="Change password or delete your account." />
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Change Password</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldGroup label="New Password" icon={<FaLock size={11} />}>
                    <input type="password" placeholder="New password" className="input-field" />
                  </FieldGroup>
                  <FieldGroup label="Confirm Password" icon={<FaLock size={11} />}>
                    <input type="password" placeholder="Confirm password" className="input-field" />
                  </FieldGroup>
                </div>
                <SaveButton onSave={handleSave} saved={saved} label="Update Password" />
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700 mb-1">Danger Zone</p>
                <p className="text-xs text-red-400 mb-3">Deleting your account is permanent and cannot be undone.</p>
                <button className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 transition shadow-sm">
                  <FaTrash size={12} />
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper Sub-components ──────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

function FieldGroup({
  label, icon, children, className = "",
}: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveButton({
  onSave, saved, label = "Save Changes",
}: {
  onSave: () => void; saved: boolean; label?: string;
}) {
  return (
    <div className="flex justify-end pt-1">
      <button
        onClick={onSave}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-white transition-all duration-300 shadow-md ${
          saved
            ? "bg-green-500 shadow-green-200/50"
            : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50 hover:-translate-y-0.5"
        }`}
      >
        {saved ? <FaCheck size={12} /> : <FaEdit size={12} />}
        {saved ? "Saved!" : label}
      </button>
    </div>
  );
}
