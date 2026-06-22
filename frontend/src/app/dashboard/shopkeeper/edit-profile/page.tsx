'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaSave, FaCamera, FaPlus } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ShopProfile {
    _id: string;
    name: string;
    phone?: string;
    address?: string;
    openHours?: string;
    description?: string;
    images?: string[];
    location?: {
        state?: string;
        district?: string;
    };
}

interface ProductItem {
    _id: string;
    cropName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    image?: string;
    description?: string;
}

export default function EditProfilePage() {
  return <ProtectedRoute><EditProfileContent /></ProtectedRoute>;
}

function EditProfileContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [shop, setShop] = useState<ShopProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        openHours: '',
        description: '',
        images: [] as string[],
        location: { state: '', district: '' },
    });
    const [prodForm, setProdForm] = useState({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
    const [addingProduct, setAddingProduct] = useState(false);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.agroudankisanpragati.com/api';
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('myShopId') : null;

    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
    const isJwtToken = (value: string | null) => !!value && value.split('.').length === 3;
    const isLocalShopId = (value: string | null) => !!value && value.startsWith('local-shop-');

    const readLocalShop = (id: string) => {
        if (typeof window === 'undefined') return null;
        const rawShop = localStorage.getItem(`shopProfile_${id}`);
        if (!rawShop) return null;
        try {
            return JSON.parse(rawShop) as ShopProfile;
        } catch {
            return null;
        }
    };

    const readLocalProducts = (id: string) => {
        if (typeof window === 'undefined') return [] as ProductItem[];
        const raw = localStorage.getItem(`shopProducts_${id}`);
        if (!raw) return [];
        try {
            return JSON.parse(raw) as ProductItem[];
        } catch {
            return [];
        }
    };

    const saveLocalProducts = (id: string, items: ProductItem[]) => {
        localStorage.setItem(`shopProducts_${id}`, JSON.stringify(items));
        setProducts(items);
    };

    const normalizeLocation = (location?: ShopProfile['location']) => ({
        state: location?.state || '',
        district: location?.district || '',
    });

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        if (isLocalShopId(shopId)) {
            const localShop = readLocalShop(shopId);
            if (localShop) {
                setShop(localShop);
                setForm({
                    name: localShop.name || '',
                    phone: localShop.phone || '',
                    address: localShop.address || '',
                    openHours: localShop.openHours || '',
                    description: localShop.description || '',
                    images: localShop.images || [],
                    location: normalizeLocation(localShop.location),
                });
            }
            setProducts(readLocalProducts(shopId));
            setLoading(false);
            return;
        }

        const fetchShop = async () => {
            try {
                const res = await fetch(`${apiBase}/shops/${shopId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setShop(data.shop);
                setForm({
                    name: data.shop.name || '',
                    phone: data.shop.phone || '',
                    address: data.shop.address || '',
                    openHours: data.shop.openHours || '',
                    description: data.shop.description || '',
                    images: data.shop.images || [],
                    location: normalizeLocation(data.shop.location),
                });
                setProducts(data.listings || []);
            } catch (err) {
                console.error(err);
                setMessage('Failed to load shop details');
            } finally {
                setLoading(false);
            }
        };

        fetchShop();
    }, [shopId, apiBase]);

    const createShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const token = getToken();

        if (!isJwtToken(token)) {
            try {
                const newShopId = `local-shop-${Date.now()}`;
                const localShop: ShopProfile = {
                    _id: newShopId,
                    name: form.name,
                    phone: form.phone,
                    address: form.address,
                    openHours: form.openHours,
                    description: form.description,
                    images: form.images,
                    location: { ...form.location },
                };

                localStorage.setItem('myShopId', newShopId);
                localStorage.setItem(`shopProfile_${newShopId}`, JSON.stringify(localShop));
                localStorage.setItem(`shopProducts_${newShopId}`, JSON.stringify([]));
                setShop(localShop);
                setProducts([]);
                setMessage('Shop created successfully!');
                setTimeout(() => router.push('/dashboard/shopkeeper'), 800);
            } catch (err) {
                console.error(err);
                setMessage('Local shop creation failed');
            } finally {
                setSaving(false);
            }
            return;
        }
        try {
            const res = await fetch(`${apiBase}/shops`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const err = await res.json();
                setMessage(err.error || 'Failed to create shop');
                setSaving(false);
                return;
            }

            const data = await res.json();
            const newShopId = data.shop._id || data.shop.id;
            localStorage.setItem('myShopId', newShopId);
            setShop(data.shop);
            setMessage('Shop created successfully!');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            console.error(err);
            setMessage('Network error');
            setSaving(false);
        }
    };

    const addProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId) return setMessage('Create a shop first');
        setAddingProduct(true);
        setMessage(null);
        const token = getToken();

        if (isLocalShopId(shopId) || !isJwtToken(token)) {
            try {
                const raw = typeof window !== 'undefined' ? localStorage.getItem(`shopProducts_${shopId}`) : null;
                const products = raw ? JSON.parse(raw) : [];
                products.push({
                    _id: `local-product-${Date.now()}`,
                    cropName: prodForm.cropName,
                    quantity: Number(prodForm.quantity || 0),
                    unit: prodForm.unit,
                    pricePerUnit: Number(prodForm.pricePerUnit || 0),
                    image: prodForm.image,
                    description: prodForm.description,
                });
                localStorage.setItem(`shopProducts_${shopId}`, JSON.stringify(products));
                setMessage('Product added successfully!');
                setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
            } catch (err) {
                console.error(err);
                setMessage('Local product save failed');
            } finally {
                setAddingProduct(false);
            }
            return;
        }
        try {
            const payload = {
                cropName: prodForm.cropName,
                quantity: Number(prodForm.quantity || 0),
                unit: prodForm.unit,
                pricePerUnit: Number(prodForm.pricePerUnit || 0),
                image: prodForm.image,
                description: prodForm.description,
            };

            const res = await fetch(`${apiBase}/shops/${shopId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                setMessage(err.error || 'Failed to add product');
                setAddingProduct(false);
                return;
            }

            setMessage('Product added successfully!');
            setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
            setAddingProduct(false);
        } catch (err) {
            console.error(err);
            setMessage('Network error');
            setAddingProduct(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId) return;
        setSaving(true);
        setMessage(null);
        const token = getToken();

        if (isLocalShopId(shopId) || !isJwtToken(token)) {
            try {
                const updatedShop: ShopProfile = {
                    _id: shopId,
                    name: form.name,
                    phone: form.phone,
                    address: form.address,
                    openHours: form.openHours,
                    description: form.description,
                    images: form.images,
                    location: { ...form.location },
                };

                localStorage.setItem(`shopProfile_${shopId}`, JSON.stringify(updatedShop));
                setShop(updatedShop);
                setMessage('Profile updated successfully!');
                setTimeout(() => router.push('/dashboard/shopkeeper'), 800);
            } catch (err) {
                console.error(err);
                setMessage('Local profile update failed');
            } finally {
                setSaving(false);
            }
            return;
        }

        try {
            const res = await fetch(`${apiBase}/shops/${shopId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const err = await res.json();
                setMessage(err.error || 'Failed to update');
                return;
            }

            const data = await res.json();
            setShop(data.shop);
            setMessage('Profile updated successfully!');
            setTimeout(() => router.push('/dashboard/shopkeeper'), 2000);
        } catch (err) {
            console.error(err);
            setMessage('Network error');
        } finally {
            setSaving(false);
        }
    };

    const handleEditProduct = (product: ProductItem) => {
        setEditingProductId(product._id);
        setProdForm({
            cropName: product.cropName,
            quantity: String(product.quantity),
            unit: product.unit,
            pricePerUnit: String(product.pricePerUnit),
            image: product.image || '',
            description: product.description || '',
        });
        setMessage('Editing product');
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!shopId) return;

        const token = getToken();
        if (isLocalShopId(shopId) || !isJwtToken(token)) {
            try {
                const nextProducts = readLocalProducts(shopId).filter((item) => item._id !== productId);
                saveLocalProducts(shopId, nextProducts);
                if (editingProductId === productId) {
                    setEditingProductId(null);
                    setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
                }
                setMessage('Product deleted successfully!');
            } catch (err) {
                console.error(err);
                setMessage('Local product delete failed');
            }
            return;
        }

        try {
            const res = await fetch(`${apiBase}/shops/${shopId}/products/${productId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const err = await res.json();
                setMessage(err.error || 'Failed to delete product');
                return;
            }

            setProducts((current) => current.filter((item) => item._id !== productId));
            if (editingProductId === productId) {
                setEditingProductId(null);
                setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
            }
            setMessage('Product deleted successfully!');
        } catch (err) {
            console.error(err);
            setMessage('Network error');
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );

    // If no shop exists, show create shop form
    if (!shopId || !shop) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                    {/* Header */}
                    <header className="mb-6 flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            title="Go back"
                            className="p-2 hover:bg-gray-200 rounded-lg transition"
                        >
                            <FaArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Create Your Shop</h1>
                            <p className="text-sm text-gray-500 mt-1">Set up your shop profile to start selling</p>
                        </div>
                    </header>

                    {/* Create Shop Form */}
                    <form onSubmit={createShop} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
                        {/* Shop Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Shop Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Enter your shop name"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                required
                            />
                        </div>

                        {/* Mobile Number */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Mobile Number</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="e.g., 9999999999"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Shop Address</label>
                            <textarea
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Enter full shop address"
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Location */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">State</label>
                                <input
                                    type="text"
                                    value={form.location.state}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            location: { ...form.location, state: e.target.value },
                                        })
                                    }
                                    placeholder="State"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">District</label>
                                <input
                                    type="text"
                                    value={form.location.district}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            location: { ...form.location, district: e.target.value },
                                        })
                                    }
                                    placeholder="District"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Open Hours */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Open Hours / Schedule</label>
                            <input
                                type="text"
                                value={form.openHours}
                                onChange={(e) => setForm({ ...form, openHours: e.target.value })}
                                placeholder="e.g., 9:00 AM - 6:00 PM (Mon-Sun)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Short Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Write a brief description about your shop"
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Shop Photo */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                <FaCamera className="inline mr-2" />
                                Shop Photo URL
                            </label>
                            <input
                                type="url"
                                value={form.images?.[0] || ''}
                                onChange={(e) => setForm({ ...form, images: [e.target.value] })}
                                placeholder="https://example.com/shop-photo.jpg"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Message */}
                        {message && (
                            <div
                                className={`p-4 rounded-lg text-sm font-medium ${message.includes('success')
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                    }`}
                            >
                                {message}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium inline-flex items-center gap-2 disabled:opacity-50"
                            >
                                <FaPlus size={16} />
                                {saving ? 'Creating...' : 'Create Shop'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Header */}
                <header className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        aria-label="Go back"
                        title="Go back"
                        className="p-2 hover:bg-gray-200 rounded-lg transition"
                    >
                        <FaArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Edit Shop Profile</h1>
                        <p className="text-sm text-gray-500 mt-1">Update your shop details</p>
                    </div>
                </header>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
                    {/* Shop Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Shop Name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Enter shop name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Owner Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Owner Name
                        </label>
                        <input
                            type="text"
                            value={user?.name || ''}
                            disabled
                            aria-label="Owner Name"
                            placeholder="Owner name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        />
                        <p className="text-xs text-gray-500 mt-1">From your profile (contact admin to change)</p>
                    </div>

                    {/* Mobile Number */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Mobile Number
                        </label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="e.g., 9999999999"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Shop Address
                        </label>
                        <textarea
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder="Enter full shop address"
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                State
                            </label>
                            <input
                                type="text"
                                value={form.location.state}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        location: { ...form.location, state: e.target.value },
                                    })
                                }
                                placeholder="State"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                District
                            </label>
                            <input
                                type="text"
                                value={form.location.district}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        location: { ...form.location, district: e.target.value },
                                    })
                                }
                                placeholder="District"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Open Hours / Schedule */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Open Hours / Schedule
                        </label>
                        <input
                            type="text"
                            value={form.openHours}
                            onChange={(e) => setForm({ ...form, openHours: e.target.value })}
                            placeholder="e.g., 9:00 AM - 6:00 PM (Mon-Sun)"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Short Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Short Description
                        </label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Write a brief description about your shop"
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Shop Photo URL */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            <FaCamera className="inline mr-2" />
                            Shop Photo URL
                        </label>
                        <input
                            type="url"
                            value={form.images?.[0] || ''}
                            onChange={(e) => setForm({ ...form, images: [e.target.value] })}
                            placeholder="https://example.com/shop-photo.jpg"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Paste a direct image URL (optional)</p>
                    </div>

                    {/* Message */}
                    {message && (
                        <div
                            className={`p-4 rounded-lg text-sm font-medium ${message.includes('success')
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                        >
                            {message}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            aria-label="Cancel editing"
                            title="Cancel editing"
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium inline-flex items-center gap-2 disabled:opacity-50"
                        >
                            <FaSave size={16} />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {/* Products are managed from the Shopkeeper dashboard. */}
                <div className="mt-8 p-6 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-sm text-yellow-800">Products and inventory are now managed from the <Link href="/dashboard/shopkeeper" className="font-semibold text-yellow-900">Shopkeeper Dashboard</Link>.</p>
                </div>
            </div>
        </main>
    );
}
