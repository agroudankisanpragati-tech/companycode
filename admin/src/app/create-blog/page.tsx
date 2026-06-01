'use client';

import { FormEvent, useState } from 'react';
import { requestFormData, requestJson } from '@/components/admin/admin-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import ReactQuillEditor from '@/components/admin/ReactQuillEditor';

export default function CreateBlogPage() {
    const { token } = useAdmin();
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [content, setContent] = useState('');

    const extractFirstImageSrc = (html: string) => {
        if (!html) return '';

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const image = doc.querySelector('img[src]');

            return image?.getAttribute('src')?.trim() || '';
        } catch {
            return '';
        }
    };

    const resolveCoverImage = async () => {
        if (coverFile) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', coverFile);

            const uploadResponse = await requestFormData<{ success: boolean; data: { coverImage: string } }>('/blogs/admin/upload-cover', token as string, uploadFormData);
            return uploadResponse.data.coverImage;
        }

        return extractFirstImageSrc(content);
    };

    const handleContentChange = (val: string) => {
        // debug log to help trace disappearing text
        try {
            // eslint-disable-next-line no-console
            console.debug('[CreateBlogPage] content change length', val?.length);
        } catch (e) {}

        setContent(val);
    };
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [tags, setTags] = useState('');
    const [status, setStatus] = useState<'draft' | 'published'>('published');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token) {
            setError('Admin token missing. Please re-login.');
            return;
        }

        setSubmitting(true);
        setError('');
        setMessage('');

        try {
            const coverImage = await resolveCoverImage();

            if (!coverImage) {
                setError('Add a header image or insert at least one image in the content.');
                setSubmitting(false);
                return;
            }

            const blogData = {
                title,
                excerpt,
                content,
                coverImage,
                tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                status,
            };

            await requestJson('/blogs/admin', token, {
                method: 'POST',
                body: JSON.stringify(blogData),
            });

            setMessage(status === 'published' ? 'Blog post published successfully.' : 'Blog draft saved successfully.');

            setTitle('');
            setExcerpt('');
            setContent('');
            setCoverFile(null);
            setTags('');
            setStatus('published');
            event.currentTarget.reset();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Failed to upload header image');
        } finally {
            setSubmitting(false);
        }
    };

    const saveDraft = async () => {
        if (!token) {
            setError('Admin token missing. Please re-login.');
            return;
        }

        setSubmitting(true);
        setError('');
        setMessage('');

        try {
            const coverImage = await resolveCoverImage();

            const blogData = {
                title,
                excerpt,
                content,
                coverImage,
                tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                status: 'draft' as const,
            };

            await requestJson('/blogs/admin', token, {
                method: 'POST',
                body: JSON.stringify(blogData),
            });

            setMessage('Blog draft saved successfully.');
            setSubmitting(false);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Failed to save blog draft');
            setSubmitting(false);
        }
    };

    return (
        <div className="relative w-full h-[calc(100vh-8rem)] overflow-hidden bg-slate-950/70">
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute left-[-8%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
                    <div className="absolute right-[-12%] top-16 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="absolute bottom-[-14%] left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
                </div>

                <div className="mx-auto flex h-full w-full flex-col gap-6 px-4 md:px-6 lg:px-8">
                {message ? <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
                {error ? <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

                <form onSubmit={handleSubmit} className="create-blog-form glass-panel rounded-[1.5rem] border border-white/10 p-4 md:p-6 lg:p-8 flex h-full flex-col">
                        <div className="create-blog-top-actions mb-4">
                            <label className="space-y-1 text-sm text-slate-300 inline-block mr-4">
                                <span className="text-slate-200">Status</span>
                                <select className="admin-input w-44" value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'published')}>
                                    <option value="published">Publish now</option>
                                    <option value="draft">Save as draft</option>
                                </select>
                            </label>

                            <div className="inline-flex items-end gap-3">
                                <button type="button" onClick={() => { setStatus('draft'); void saveDraft(); }} className="admin-button-secondary">
                                    Save Draft
                                </button>

                                <button type="submit" disabled={submitting} className="admin-button-primary">
                                    {submitting ? 'Saving...' : (status === 'published' ? 'Publish' : 'Submit')}
                                </button>
                            </div>
                        </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="text-slate-200">Title</span>
                            <input className="admin-input w-full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter blog title" required />
                        </label>

                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="text-slate-200">Description</span>
                            <input className="admin-input w-full" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Short description for the blog" required />
                        </label>

                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="text-slate-200">Header image</span>
                            <input className="admin-input w-full" type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
                            <p className="text-xs text-slate-400">Optional. If you skip this, the first image in the content will be used as the cover.</p>
                        </label>

                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="text-slate-200">Tags</span>
                            <input className="admin-input w-full" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="farming, news, weather" />
                        </label>

                        <div className="space-y-2 text-sm text-slate-300 md:col-span-2 flex flex-col min-h-0 flex-1">
                            <span className="text-slate-200">Main content</span>
                            <div className="flex-1 min-h-0">
                                <ReactQuillEditor value={content} onChange={handleContentChange} />
                            </div>
                        </div>

                            {/* actions moved to top */}
                    </div>
                </form>
            </div>
        </div>
    );
}
