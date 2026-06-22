'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaSave, FaCamera } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import FarmerHeader from '@/components/FarmerHeader';
import FarmerFooter from '@/components/FarmerFooter';
import ProtectedRoute from '@/components/ProtectedRoute';

interface FarmerProfile {
    id?: string;
    name?: string;
    phone?: string;
    farmSize?: string;
    soilType?: string;
    address?: string;
    location?: { state?: string; district?: string };
    photo?: string;
}

export default function FarmerEditProfile() {
  return <ProtectedRoute><FarmerEditProfileContent /></ProtectedRoute>;
}

function FarmerEditProfileContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const [form, setForm] = useState<FarmerProfile>({
        name: user?.name || '',
        phone: user?.phone || '',
        farmSize: '',
        soilType: '',
        address: '',
        location: { state: '', district: '' },
        photo: '',
    });

    const apiBase = '/api';

    useEffect(() => {
        // load local fallback profile if any
        if (typeof window !== 'undefined') {
            const local = localStorage.getItem('farmerProfile');
            if (local) {
                try {
                    const p = JSON.parse(local) as FarmerProfile;
                    setForm((prev) => ({ ...prev, ...p }));
                } catch { }
            }
        }
        setLoading(false);
    }, []);

    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
    const isJwtToken = (value: string | null) => !!value && value.split('.').length === 3;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const token = getToken();

        if (!isJwtToken(token)) {
            // save locally
            try {
                const pid = (user as any)?.id || `local-farmer-${Date.now()}`;
                const payload = { ...form, id: pid };
                localStorage.setItem('farmerProfile', JSON.stringify(payload));
                setMessage('Profile saved locally');
                setTimeout(() => router.push('/dashboard/farmer'), 800);
            } catch (err) {
                console.error(err);
                setMessage('Failed to save locally');
            } finally {
                setSaving(false);
            }
            return;
        }

        try {
            const userId = (user as any)?.id;
            const res = await fetch(`${apiBase}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const err = await res.json();
                setMessage(err.error || 'Failed to update profile');
                setSaving(false);
                return;
            }

            setMessage('Profile updated successfully');
            setTimeout(() => router.push('/dashboard/farmer'), 1000);
        } catch (err) {
            console.error(err);
            setMessage('Network error');
        } finally {
            setSaving(false);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );

    return (
        <>
            <FarmerHeader />
            <main className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                <header className="mb-6 flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-lg transition">
                        <FaArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Edit Farmer Profile</h1>
                        <p className="text-sm text-gray-500 mt-1">Update your contact and farm details</p>
                    </div>
                </header>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Full Name</label>
                        <input
                            type="text"
                            value={form.name || ''}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Your name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Mobile Number</label>
                        <input
                            type="tel"
                            value={form.phone || ''}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="e.g., 9999999999"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Farm Size</label>
                            <input
                                type="text"
                                value={form.farmSize || ''}
                                onChange={(e) => setForm({ ...form, farmSize: e.target.value })}
                                placeholder="e.g., 5 Acres"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Soil Type</label>
                            <input
                                type="text"
                                value={form.soilType || ''}
                                onChange={(e) => setForm({ ...form, soilType: e.target.value })}
                                placeholder="e.g., Loamy"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Address</label>
                        <textarea
                            value={form.address || ''}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            rows={3}
                            placeholder="Full address or landmark"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">State</label>
                            <input
                                type="text"
                                value={form.location?.state || ''}
                                onChange={(e) => setForm({ ...form, location: { ...(form.location || {}), state: e.target.value } })}
                                placeholder="State"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">District</label>
                            <input
                                type="text"
                                value={form.location?.district || ''}
                                onChange={(e) => setForm({ ...form, location: { ...(form.location || {}), district: e.target.value } })}
                                placeholder="District"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2"><FaCamera className="inline mr-2" />Profile Photo URL</label>
                        <input
                            type="url"
                            value={form.photo || ''}
                            onChange={(e) => setForm({ ...form, photo: e.target.value })}
                            placeholder="https://example.com/photo.jpg"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional: paste a direct image URL</p>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium">Cancel</button>
                        <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium inline-flex items-center gap-2 disabled:opacity-50">
                            <FaSave size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </main>
            <FarmerFooter />
        </>
    );
}
