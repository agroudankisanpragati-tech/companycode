'use client';

import { FaLeaf, FaMapMarkerAlt } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import ProfilePhotoCard from './ProfilePhotoCard';
import type { FullProfile } from './types';

interface Props {
  profile: FullProfile;
  onPhotoUpdate: () => void;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function ProfileHeader({ profile, onPhotoUpdate }: Props) {
  const lastUpdated = new Date(
    (profile.ext as any)?.updatedAt || Date.now()
  ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const loc = profile.user.location;
  const locationStr = loc?.district && loc?.state ? `${loc.district}, ${loc.state}` : null;

  return (
    <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-lime-600 p-5 sm:p-6 shadow-xl shadow-emerald-200/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-lime-300/20 blur-xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <ProfilePhotoCard
          name={profile.user.name}
          profileImage={profile.user.profileImage}
          onUpdate={onPhotoUpdate}
        />

        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-emerald-200 uppercase tracking-widest mb-0.5">
            {greeting()}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight truncate">
            {profile.user.name || 'Farmer'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-emerald-100">
              <FaLeaf size={10} /> Farmer Profile
            </span>
            {locationStr && (
              <span className="flex items-center gap-1 text-xs text-emerald-100">
                <FaMapMarkerAlt size={10} /> {locationStr}
              </span>
            )}
            {(profile.user as any).verified && (
              <span className="flex items-center gap-1 text-xs text-emerald-100">
                <MdVerified size={12} /> Verified
              </span>
            )}
            <span className="text-xs text-emerald-200/70">Updated {lastUpdated}</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-center bg-white/15 backdrop-blur rounded-2xl px-4 py-3 border border-white/20">
          <div className="text-xl font-extrabold text-white">{profile.user.points ?? 0}</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200">Points</div>
        </div>
      </div>
    </div>
  );
}
