'use client';

import Link from 'next/link';
import { FaSignOutAlt, FaCog, FaPlus } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ProductItem = {
    _id: string;
    cropName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    image?: string;
    description?: string;
};

export default function ShopkeeperDashboard() {
    const { user, logout, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/auth/login');
        } else if (user?.role !== 'shopkeeper') {
            router.replace('/auth/role-select');
        }
    }, [isAuthenticated, user, router]);

    const handleLogout = () => {
        logout();
        router.push('/auth/role-select');
    };

    // Products state and handlers (moved here from edit-profile)
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [addingProduct, setAddingProduct] = useState(false);
    const [prodForm, setProdForm] = useState({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.agroudankisanpragati.com/api';
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('myShopId') : null;

    const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
    const isJwtToken = (value: string | null) => !!value && value.split('.').length === 3;
    const isLocalShopId = (value: string | null) => !!value && value.startsWith('local-shop-');

    const readLocalProducts = (id: string | null) => {
        if (!id || typeof window === 'undefined') return [] as ProductItem[];
        const raw = localStorage.getItem(`shopProducts_${id}`);
        if (!raw) return [];
        try {
            return JSON.parse(raw) as ProductItem[];
        } catch {
            return [];
        }
    };

    useEffect(() => {
        // load local products first
        if (shopId) {
            setProducts(readLocalProducts(shopId));
        }
    }, [shopId]);

    const addProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId) return setMessage('Create a shop first');
        setAddingProduct(true);
        setMessage(null);

        const token = getToken();
        // If editingProductId is set -> update existing product
        if (editingProductId) {
            // update local or remote
            if (isLocalShopId(shopId) || !isJwtToken(token)) {
                try {
                    const raw = localStorage.getItem(`shopProducts_${shopId}`) || '[]';
                    const list = JSON.parse(raw) as ProductItem[];
                    const next = list.map((p) => p._id === editingProductId ? {
                        ...p,
                        cropName: prodForm.cropName,
                        quantity: Number(prodForm.quantity || 0),
                        unit: prodForm.unit,
                        pricePerUnit: Number(prodForm.pricePerUnit || 0),
                        image: prodForm.image,
                        description: prodForm.description,
                    } : p);
                    localStorage.setItem(`shopProducts_${shopId}`, JSON.stringify(next));
                    setProducts(next);
                    setMessage('Product updated locally');
                    setEditingProductId(null);
                    setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
                } catch (err) {
                    console.error(err);
                    setMessage('Local product update failed');
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
                const res = await fetch(`${apiBase}/shops/${shopId}/products/${editingProductId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json();
                    setMessage(err.error || 'Failed to update product');
                    setAddingProduct(false);
                    return;
                }
                const data = await res.json();
                const updated = data.listing || data;
                setProducts((cur) => cur.map((p) => p._id === editingProductId ? updated : p));
                setEditingProductId(null);
                setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
                setMessage('Product updated successfully');
            } catch (err) {
                console.error(err);
                setMessage('Network error');
            } finally {
                setAddingProduct(false);
            }
            return;
        }

        if (isLocalShopId(shopId) || !isJwtToken(token)) {
            try {
                const raw = localStorage.getItem(`shopProducts_${shopId}`) || '[]';
                const list = JSON.parse(raw);
                const newItem = {
                    _id: `local-product-${Date.now()}`,
                    cropName: prodForm.cropName,
                    quantity: Number(prodForm.quantity || 0),
                    unit: prodForm.unit,
                    pricePerUnit: Number(prodForm.pricePerUnit || 0),
                    image: prodForm.image,
                    description: prodForm.description,
                };
                list.push(newItem);
                localStorage.setItem(`shopProducts_${shopId}`, JSON.stringify(list));
                setProducts(list);
                setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
                setMessage('Product added locally');
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

            const data = await res.json();
            const created = data.listing || data;
            // append created product to UI list
            if (created && created._id) {
                setProducts((cur) => [created, ...cur]);
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
        // scroll to form
        setTimeout(() => {
            const el = document.getElementById('add-product-form');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!shopId) return;
        const token = getToken();
        if (isLocalShopId(shopId) || !isJwtToken(token)) {
            try {
                const nextProducts = readLocalProducts(shopId).filter((item) => item._id !== productId);
                localStorage.setItem(`shopProducts_${shopId}`, JSON.stringify(nextProducts));
                setProducts(nextProducts);
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

    if (!isAuthenticated || user?.role !== 'shopkeeper') return null;

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Header */}
                <header className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-green-600 font-semibold">Shopkeeper Panel</p>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Welcome, {user?.name}</h1>
                        <p className="text-sm text-gray-500 mt-1">Simple dashboard to manage stock and orders</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/shopkeeper/edit-profile"
                            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition text-sm font-medium inline-flex items-center gap-2"
                        >
                            <FaCog size={14} />
                            Edit Profile
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition text-sm font-semibold inline-flex items-center gap-2"
                        >
                            <FaSignOutAlt size={14} />
                            Logout
                        </button>
                    </div>
                </header>
                {/* Products Section */}
                <section className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Products</h2>
                            <p className="text-sm text-gray-500 mt-1">Manage products visible to farmers</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    // focus add product form by scrolling
                                    const el = document.getElementById('add-product-form');
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium inline-flex items-center gap-2"
                            >
                                <FaPlus />
                                Add Product
                            </button>
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 mb-4">{products.length} item{products.length === 1 ? '' : 's'}</div>

                    {products.length === 0 ? (
                        <p className="text-sm text-gray-500">No products added yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {products.map((item) => (
                                <div key={item._id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="h-16 w-16 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {item.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.image} alt={item.cropName} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-xs text-gray-400">No image</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{item.cropName}</h3>
                                            <p className="text-sm text-gray-600">{item.quantity} {item.unit} • ₹{item.pricePerUnit}/{item.unit}</p>
                                            {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditProduct(item)}
                                            className="px-4 py-2 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition text-sm font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteProduct(item._id)}
                                            className="px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition text-sm font-medium"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add / Edit Products Section */}
                    <div id="add-product-form" className="mt-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">{editingProductId ? 'Edit Product' : 'Add Products to Your Shop'}</h2>
                        <form onSubmit={addProduct} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
                            {/* Product Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Product Name *</label>
                                <input
                                    type="text"
                                    value={prodForm.cropName}
                                    onChange={(e) => setProdForm({ ...prodForm, cropName: e.target.value })}
                                    placeholder="e.g., Tomatoes, Wheat Seeds"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            {/* Quantity & Unit */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Quantity *</label>
                                    <input
                                        type="number"
                                        value={prodForm.quantity}
                                        onChange={(e) => setProdForm({ ...prodForm, quantity: e.target.value })}
                                        placeholder="e.g., 100"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Unit</label>
                                    <input
                                        type="text"
                                        value={prodForm.unit}
                                        onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
                                        placeholder="e.g., kg, packet, liter"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Price */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Price per Unit (₹) *</label>
                                <input
                                    type="number"
                                    value={prodForm.pricePerUnit}
                                    onChange={(e) => setProdForm({ ...prodForm, pricePerUnit: e.target.value })}
                                    placeholder="e.g., 50"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            {/* Product Image */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Product Image URL</label>
                                <input
                                    type="url"
                                    value={prodForm.image}
                                    onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                                    placeholder="https://example.com/product.jpg"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Product Description</label>
                                <textarea
                                    value={prodForm.description}
                                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                                    placeholder="Describe your product (quality, freshness, etc.)"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>

                            {/* Message */}
                            {message && message.includes('Product') && (
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
                                {editingProductId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingProductId(null);
                                            setProdForm({ cropName: '', quantity: '', unit: 'kg', pricePerUnit: '', image: '', description: '' });
                                        }}
                                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={addingProduct}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium inline-flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FaPlus size={16} />
                                    {addingProduct ? (editingProductId ? 'Updating...' : 'Adding...') : (editingProductId ? 'Update Product' : 'Add Product')}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-6 border-t border-gray-200 pt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-gray-500">
                    <p>Simple shopkeeper dashboard for inventory and orders.</p>
                    <div className="flex items-center gap-4">
                        <Link href="/contact" className="hover:text-green-600 transition">Help</Link>
                        <Link href="/auth/settings" className="hover:text-green-600 transition">Profile</Link>
                    </div>
                </footer>
            </div>
        </main>
    );
}

