'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ASSET_BASE, deleteGalleryItem, loadGalleryItems, uploadGalleryItem, setGalleryItemFeatured } from '@/components/admin/admin-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import type { GalleryItem } from '@/components/admin/admin-types';

const resolveMediaUrl = (value: string) => (value.startsWith('http') ? value : `${ASSET_BASE}${value}`);

export default function BannerManagerPage() {
    const { token } = useAdmin();
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const loadItems = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await loadGalleryItems(token);
            setItems(res.data.filter((i) => i.mediaType === 'video'));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load videos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadItems();
    }, [token]);

    const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!token) return setError('Admin token missing');

        const form = e.currentTarget;
        const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0];

        if (!file) return setError('Choose a video file');

        const formData = new FormData();
        formData.append('mediaType', 'video');
        formData.append('status', 'published');
        formData.append('featured', 'true');
        formData.append('file', file);

        setUploading(true);
        setError('');
        try {
            await uploadGalleryItem(token, formData);
            setMessage('Banner uploaded and set as featured.');
            await loadItems();
            form.reset();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSetFeatured = async (id: string, featured: boolean) => {
        if (!token) return setError('Admin token missing');
        setError('');
        try {
            await setGalleryItemFeatured(token, id, featured);
            await loadItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        }
    };

    const handleDelete = async (id: string) => {
        if (!token || !confirm('Delete this video?')) return;
        try {
            await deleteGalleryItem(token, id);
            await loadItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const featured = items.find((i) => i.featured);

    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
                <h2 className="text-2xl font-bold text-white">Banner Manager</h2>
                <p className="mt-2 text-sm text-slate-400">Upload or choose a featured banner video for the site header.</p>
            </div>

            {message ? <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
            {error ? <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

            <section className="glass-panel rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white">Current Featured</h3>
                {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}
                {!loading && !featured ? <p className="text-sm text-slate-400">No featured banner set.</p> : null}
                {featured ? (
                    <div className="mt-4">
                        <video src={resolveMediaUrl(featured.mediaUrl)} controls className="w-full rounded-lg" />
                        <h4 className="mt-2 text-white font-semibold">{featured.title}</h4>
                        <p className="text-sm text-slate-300">{featured.caption}</p>
                    </div>
                ) : null}
            </section>

            <section className="glass-panel rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-white">Upload Banner Video</h3>
                <form className="mt-4 space-y-3" onSubmit={handleUpload}>
                    <label className="block space-y-2 text-sm text-slate-300">
                        <span>File</span>
                        <input name="file" type="file" accept="video/*" className="admin-input w-full" />
                    </label>
                    <div>
                        <button type="submit" disabled={uploading} className="admin-button-primary">
                            {uploading ? 'Uploading…' : 'Upload & Set Banner'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="glass-panel rounded-3xl p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">All Videos</h3>
                    <button type="button" onClick={loadItems} className="admin-button-secondary">Refresh</button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {items.map((item) => (
                        <article key={item._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <video src={resolveMediaUrl(item.mediaUrl)} controls className="w-full rounded-md" />
                            <h4 className="mt-2 text-white font-semibold">{item.title}</h4>
                            <p className="text-sm text-slate-300">{item.caption}</p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSetFeatured(item._id, true)}
                                    className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200"
                                >
                                    Make Banner
                                </button>
                                {item.featured ? (
                                    <button
                                        type="button"
                                        onClick={() => handleSetFeatured(item._id, false)}
                                        className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-200"
                                    >
                                        Unset Banner
                                    </button>
                                ) : null}
                                <button type="button" onClick={() => handleDelete(item._id)} className="rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200">Delete</button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
