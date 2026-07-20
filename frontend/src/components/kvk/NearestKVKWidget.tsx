'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaMapMarkerAlt, FaSpinner, FaTimes, FaChevronDown, FaRedo } from 'react-icons/fa';
import KVKCard from './KVKCard';
import MapCard from './MapCard';
import { fetchNearestKVK, type KVKCenter, type AddressPayload } from '@/services/kvk';
import type { FarmerAddress } from '@/services/addressService';

interface Props {
  /** Pre-filled address from farmer profile — used on first load */
  profileAddress?: AddressPayload;
  /** Called when farmer saves a new address so parent can persist it */
  onAddressSaved?: (payload: AddressPayload) => void;
  /** Show embedded map for nearest KVK */
  showMap?: boolean;
}

export default function NearestKVKWidget({
  profileAddress,
  onAddressSaved,
  showMap = false,
}: Props) {
  const [nearest, setNearest] = useState<KVKCenter | null>(null);
  const [allKVKs, setAllKVKs] = useState<KVKCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showChangeAddr, setShowChangeAddr] = useState(false);
  const [addrInput, setAddrInput] = useState('');
  const [addrLoading, setAddrLoading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async (payload: AddressPayload = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchNearestKVK(payload);
      if (res.data.length > 0) {
        setNearest(res.nearest || res.data[0]);
        setAllKVKs(res.data);
      } else {
        setNearest(null);
        setAllKVKs([]);
        setError(res.message || 'No nearby Krishi Vigyan Kendra found.');
      }
    } catch (e: any) {
      setError(e.message || 'Could not load KVK information.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load using profile address
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load(profileAddress || {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh whenever farmer address changes globally
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FarmerAddress>).detail;
      if (!detail) return;
      const payload: AddressPayload = {
        address: detail.address,
        village: detail.village,
        district: detail.district,
        state: detail.state,
        pincode: detail.pincode,
      };
      load(payload);
    };
    window.addEventListener('farmer-address-changed', handler);
    return () => window.removeEventListener('farmer-address-changed', handler);
  }, [load]);

  const handleChangeAddress = async () => {
    if (!addrInput.trim()) return;
    setAddrLoading(true);
    const payload: AddressPayload = { address: addrInput.trim() };
    await load(payload);
    onAddressSaved?.(payload);
    setShowChangeAddr(false);
    setAddrInput('');
    setAddrLoading(false);
  };

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200">
            <FaMapMarkerAlt className="text-white" size={14} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Nearest KVK Center</h3>
            <p className="text-xs text-slate-500">Krishi Vigyan Kendra</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(profileAddress || {})}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
            title="Refresh"
          >
            <FaRedo size={10} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowChangeAddr(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
          >
            <FaMapMarkerAlt size={11} /> Change Address
          </button>
        </div>
      </div>

      {/* Change address form */}
      {showChangeAddr && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Enter your address to find nearest KVK</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={addrInput}
              onChange={e => setAddrInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangeAddress()}
              placeholder="Village, District, State..."
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition"
            />
            <button
              onClick={handleChangeAddress}
              disabled={addrLoading || !addrInput.trim()}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {addrLoading ? <FaSpinner className="animate-spin" size={12} /> : null}
              Search
            </button>
            <button
              onClick={() => setShowChangeAddr(false)}
              className="rounded-xl border border-gray-200 p-2.5 text-slate-400 hover:text-slate-600 hover:bg-gray-50 transition"
            >
              <FaTimes size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 px-4 py-5">
          <FaSpinner className="animate-spin text-emerald-500 flex-shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-slate-700">Finding nearest KVK...</p>
            <p className="text-xs text-slate-400">Using your profile address</p>
          </div>
        </div>
      )}

      {/* Error / empty */}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
          <p className="text-2xl mb-2">📍</p>
          <p className="text-sm font-semibold text-amber-800">No nearby Krishi Vigyan Kendra found.</p>
          <p className="text-xs text-amber-600 mt-1">Try updating your address above.</p>
        </div>
      )}

      {/* Nearest KVK card */}
      {!loading && nearest && (
        <>
          <KVKCard kvk={nearest} rank={1} />
          {showMap && nearest.latitude && nearest.longitude && (
            <div className="mt-3">
              <MapCard
                latitude={nearest.latitude}
                longitude={nearest.longitude}
                label={nearest.name}
                height={200}
              />
            </div>
          )}
        </>
      )}

      {/* View more button */}
      {!loading && allKVKs.length > 1 && (
        <button
          onClick={() => setShowMore(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
        >
          <FaChevronDown size={12} /> View More KVK Centers ({allKVKs.length - 1} nearby)
        </button>
      )}

      {/* More KVKs modal */}
      {showMore && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Nearby KVK Centers</h3>
                <p className="text-xs text-slate-500">{allKVKs.length} centers found near you</p>
              </div>
              <button
                onClick={() => setShowMore(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition"
              >
                <FaTimes size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {allKVKs.map((kvk, i) => (
                <KVKCard key={kvk._id} kvk={kvk} rank={i + 1} compact={i > 0} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
