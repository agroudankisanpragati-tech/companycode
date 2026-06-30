'use client';
import { useState } from 'react';
import { MapPin, Navigation, Search, X, CheckCircle } from 'lucide-react';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  pincode: string;
}

interface Props {
  onSelect: (data: LocationData) => void;
  onClose: () => void;
}

export default function LocationPickerModal({ onSelect, onClose }: Props) {
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<LocationData | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState<Partial<LocationData>>({});
  const [tab, setTab] = useState<'gps' | 'manual'>('gps');

  const reverseGeocode = async (lat: number, lng: number): Promise<Partial<LocationData>> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address || {};
      return {
        address: data.display_name || '',
        village: addr.village || addr.hamlet || addr.suburb || '',
        tehsil: addr.county || addr.suburb || '',
        district: addr.state_district || addr.county || '',
        state: addr.state || '',
        pincode: addr.postcode || '',
      };
    } catch {
      return {};
    }
  };

  const detectGPS = () => {
    setDetecting(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        const geocoded = await reverseGeocode(latitude, longitude);
        const loc: LocationData = {
          latitude,
          longitude,
          address: geocoded.address || '',
          village: geocoded.village || '',
          tehsil: geocoded.tehsil || '',
          district: geocoded.district || '',
          state: geocoded.state || '',
          pincode: geocoded.pincode || '',
        };
        setDetected(loc);
        setDetecting(false);
      },
      err => {
        setError('Location access denied. Please enable GPS or enter manually.');
        setDetecting(false);
      }
    );
  };

  const confirmGPS = () => detected && onSelect(detected);

  const confirmManual = () => {
    if (!manual.latitude || !manual.longitude || !manual.district || !manual.state)
      return setError('Please fill latitude, longitude, district and state.');
    onSelect(manual as LocationData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Set Shop Location</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex border-b border-gray-100">
          {[{ key: 'gps', label: 'GPS / Auto-detect' }, { key: 'manual', label: 'Enter Manually' }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'gps' | 'manual')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === 'gps' ? (
            <>
              <p className="text-sm text-gray-500">We'll use GPS to detect your location and auto-fill address fields.</p>
              {!detected ? (
                <button
                  onClick={detectGPS}
                  disabled={detecting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  {detecting ? 'Detecting…' : 'Detect My Location'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-800 mb-1">Location Detected</p>
                      <p className="text-gray-600 text-xs leading-relaxed">{detected.address}</p>
                      <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
                        <span>Lat: {detected.latitude.toFixed(6)}</span>
                        <span>Lng: {detected.longitude.toFixed(6)}</span>
                        {detected.district && <span>District: {detected.district}</span>}
                        {detected.state && <span>State: {detected.state}</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={confirmGPS} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 transition-colors">
                    Use This Location
                  </button>
                  <button onClick={() => setDetected(null)} className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-2xl text-sm hover:bg-gray-50 transition-colors">
                    Re-detect
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'latitude', label: 'Latitude', placeholder: 'e.g. 21.1458' },
                  { key: 'longitude', label: 'Longitude', placeholder: 'e.g. 79.0882' },
                  { key: 'village', label: 'Village', placeholder: 'Village name' },
                  { key: 'tehsil', label: 'Tehsil', placeholder: 'Tehsil name' },
                  { key: 'district', label: 'District *', placeholder: 'District name' },
                  { key: 'state', label: 'State *', placeholder: 'State name' },
                  { key: 'pincode', label: 'Pincode', placeholder: '6-digit pincode' },
                  { key: 'address', label: 'Full Address', placeholder: 'Full address' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'address' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input
                      placeholder={f.placeholder}
                      value={(manual as any)[f.key] || ''}
                      onChange={e => setManual(m => ({ ...m, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>
              <button onClick={confirmManual} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 transition-colors mt-2">
                <MapPin className="w-4 h-4 inline mr-2" />Use This Location
              </button>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
}
