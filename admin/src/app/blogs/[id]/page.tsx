"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/AdminProvider';
import ReactQuillEditor from '@/components/admin/ReactQuillEditor';
import { fetchAdminBlogById, requestFormData, updateBlogPost, deleteBlogPost } from '@/components/admin/admin-api';

export default function EditBlogPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { token } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const resp = await fetchAdminBlogById(token, id);
      const post = resp.data;
      setTitle(post.title || '');
      setExcerpt(post.excerpt || '');
      setContent(post.content || post.contentJson || '');
      setCoverImage(post.coverImage || undefined);
      setTags((post.tags || []).join(', '));
      setStatus(post.status || 'draft');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load blog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, id]);

  const handleUploadCover = async () => {
    if (!token || !coverFile) return;
    const form = new FormData();
    form.append('file', coverFile);
    const resp = await requestFormData<{ success: boolean; data: { coverImage: string } }>('/blogs/admin/upload-cover', token, form);
    setCoverImage(resp.data.coverImage);
    setCoverFile(null);
  };

  const handleSave = async () => {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      await updateBlogPost(token, id, {
        title,
        excerpt,
        content,
        coverImage,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        status,
      } as any);

      router.push('/blogs');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !confirm('Delete this blog post permanently?')) return;
    try {
      await deleteBlogPost(token, id);
      router.push('/blogs');
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Edit Blog</h2>
        <div className="flex gap-2">
          <button onClick={() => router.push('/blogs')} className="admin-button-secondary">Back</button>
          <button onClick={handleDelete} className="admin-button-danger">Delete</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? <div className="text-red-400">{error}</div> : null}

      <div className="space-y-4">
        <label className="space-y-1 text-sm">
          <div>Title</div>
          <input className="admin-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="space-y-1 text-sm">
          <div>Excerpt</div>
          <input className="admin-input w-full" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>

        <label className="space-y-1 text-sm">
          <div>Cover image</div>
          {coverImage ? <img src={coverImage} alt="cover" className="max-h-40 mb-2" /> : null}
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
          {coverFile ? <button onClick={handleUploadCover} className="admin-button-primary mt-2">Upload</button> : null}
        </label>

        <label className="space-y-1 text-sm">
          <div>Tags (comma separated)</div>
          <input className="admin-input w-full" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        <label className="space-y-1 text-sm">
          <div>Main content</div>
          <ReactQuillEditor value={content} onChange={setContent} />
        </label>

        <div className="flex items-center gap-4">
          <label className="space-y-1 text-sm">
            <div>Status</div>
            <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          <div className="ml-auto flex gap-2">
            <button onClick={() => router.push('/blogs')} className="admin-button-secondary">Cancel</button>
            <button onClick={handleSave} disabled={submitting} className="admin-button-primary">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
