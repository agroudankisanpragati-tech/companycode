'use client';

import { FaMapMarkerAlt } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import AddressCard from '@/components/shared/AddressCard';
import type { FarmerAddress } from './types';

interface Props {
  address: FarmerAddress | null;
  saving: boolean;
  onSave: (addr: FarmerAddress) => Promise<void>;
}

export default function LocationCard({ address, saving, onSave }: Props) {
  const hasAddress = !!(address?.state && address?.district && address?.village && address?.pincode);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <FaMapMarkerAlt size={14} />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">Address</div>
          <div className="text-xs text-gray-400">
            Single source of truth — used by KVK, disease detection, market prices &amp; more
          </div>
        </div>
        {hasAddress && (
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <MdVerified size={12} /> Saved
          </span>
        )}
      </div>
      <div className="p-5">
        <AddressCard address={address} saving={saving} onSave={onSave} />
      </div>
    </div>
  );
}
