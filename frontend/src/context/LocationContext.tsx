'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export interface FarmerLocation {
  country: string;
  state: string;
  district: string;
  village: string;
  latitude: number;
  longitude: number;
}

const EMPTY: FarmerLocation = { country: '', state: '', district: '', village: '', latitude: 0, longitude: 0 };

interface LocationContextType {
  location: FarmerLocation;
  isReady: boolean;          // true once initial load attempt is done
  isDetecting: boolean;      // GPS/geocode in progress
  saveLocation: (loc: Partial<FarmerLocation>) => Promise<void>;
  detectGPS: () => Promise<void>;
  // subscribers get called when location changes (for weather/mandi/soil refreshes)
  onLocationChange: (cb: () => void) => () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function reverseGeocode(lat: number, lon: number): Promise<Partial<FarmerLocation>> {
  // Use OpenStreetMap Nominatim (free, no key needed)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const a = data?.address || {};
    return {
      country: a.country || '',
      state: a.state || a.state_district || '',
      district: a.county || a.state_district || a.district || a.city || '',
      village: a.village || a.town || a.suburb || a.city_district || '',
      latitude: lat,
      longitude: lon,
    };
  } catch {
    return { latitude: lat, longitude: lon };
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<FarmerLocation>(EMPTY);
  const [isReady, setIsReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const subscribers = useRef<Set<() => void>>(new Set());

  const notify = useCallback(() => {
    subscribers.current.forEach((cb) => cb());
  }, []);

  const onLocationChange = useCallback((cb: () => void) => {
    subscribers.current.add(cb);
    return () => { subscribers.current.delete(cb); };
  }, []);

  // Persist location to backend + update local state
  const saveLocation = useCallback(async (loc: Partial<FarmerLocation>) => {
    const merged = { ...location, ...loc };
    setLocation(merged);

    const token = localStorage.getItem('authToken');
    if (!token) return;

    await fetch('/api/users/location', {
      method: 'PUT',
      headers: authHeaders() as HeadersInit,
      body: JSON.stringify(merged),
    }).catch(console.error);

    notify();
  }, [location, notify]);

  // GPS detection using browser API + Nominatim reverse geocode
  const detectGPS = useCallback(async () => {
    if (!navigator.geolocation) return;
    setIsDetecting(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const geo = await reverseGeocode(latitude, longitude);
      await saveLocation({ ...geo, latitude, longitude });
    } catch {
      // GPS denied or failed — silently skip, user can select manually
    } finally {
      setIsDetecting(false);
    }
  }, [saveLocation]);

  // On mount: load from profile (Priority 2), then try GPS if location is empty (Priority 1)
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { setIsReady(true); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(async (data) => {
        const loc = data?.data?.location;
        if (loc?.state && loc.state !== 'Unknown') {
          const loaded: FarmerLocation = {
            country: loc.country || '',
            state: loc.state || '',
            district: loc.district || '',
            village: loc.village || '',
            latitude: loc.coordinates?.latitude || 0,
            longitude: loc.coordinates?.longitude || 0,
          };
          setLocation(loaded);
          setIsReady(true);
          // If we have location from profile, notify modules
          if (loaded.state) notify();
        } else {
          setIsReady(true);
          // No profile location — try GPS automatically
          await detectGPS();
        }
      })
      .catch(() => setIsReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LocationContext.Provider value={{ location, isReady, isDetecting, saveLocation, detectGPS, onLocationChange }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
