'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaSearch, FaNewspaper } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchAdminBlogs, deleteBlog, updateBlog } from '@/components/admin/admin-api';
import type { BlogPost } from '@/components/admin/admin-types';

const formatDate = (d?: string) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

export default function BlogsPage() {
  const { token } = useAdmin();
  const router = useRouter();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [actionId, setActionId] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const res = await fetchAdminBlogs(token);
      setBlogs(res.data);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleDelete = async (id: string, title: string) => {
    if (!token || !window.confirm(`Delete "${title}"?`)) return;
    setActionId(id);
    try {
      await deleteBlog(token, id);
      setMsg({ type: 'success', text: 'Blog deleted' });
      setBlogs(b => b.filter(x => x._id !== id));
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setActionId('');
    }
  };

  const toggleStatus = async (blog: BlogPost) => {
    if (!token) return;
    const newStatus = blog.status === 'published' ? 'draft' : 'published';
    setActionId(blog._id);
    try {
      const res = await updateBlog(token, blog._id, { status: newStatus });
      setBlogs(b => b.map(x => x._id === blog._id ? { ...x, ...res.data } : x));
      setMsg({ type: 'success', text: `Blog ${newStatus}` });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setActionId('');
    }
  };

  const filtered = blogs.filter(b => {
    const matchFilter = filter === 'all' || b.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || b.title.toLowerCase().includes(q) || b.tags.some(t => t.includes(q));
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
            <FaNewspaper className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Blog Management</h1>
            <p className="text-xs text-slate-400">{blogs.length} total posts</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/create-blog')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
        >
          <FaPlus size={12} /> New Blog Post
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/15 text-red-300 border border-red-500/20'}`}>
          {msg.text}
          <button className="ml-3 opacity-60 hover:opacity-100" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            placeholder="Search by title or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition capitalize ${filter === f ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FaNewspaper size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No blog posts found</p>
            <button onClick={() => router.push('/create-blog')} className="mt-3 text-xs text-emerald-400 hover:underline">Create your first post →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4 hidden md:table-cell">Tags</th>
                  <th className="px-5 py-4 hidden sm:table-cell">Author</th>
                  <th className="px-5 py-4 hidden lg:table-cell">Date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(blog => (
                  <tr key={blog._id} className="group hover:bg-white/3 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {blog.coverImage ? (
                          <img src={blog.coverImage} alt="" className="h-10 w-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <FaNewspaper size={14} className="text-slate-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white line-clamp-1">{blog.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{blog.excerpt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {blog.tags.slice(0, 3).map(t => (
                          <span key={t} className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-slate-400">{t}</span>
                        ))}
                        {blog.tags.length > 3 && <span className="text-xs text-slate-600">+{blog.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell text-slate-400 text-xs">{blog.authorName || 'Admin'}</td>
                    <td className="px-5 py-4 hidden lg:table-cell text-slate-400 text-xs">{formatDate(blog.publishedAt || blog.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${blog.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {blog.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(blog)}
                          disabled={actionId === blog._id}
                          title={blog.status === 'published' ? 'Unpublish' : 'Publish'}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                        >
                          {blog.status === 'published' ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                        </button>
                        <button
                          onClick={() => router.push(`/create-blog?id=${blog._id}`)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-cyan-400"
                        >
                          <FaEdit size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(blog._id, blog.title)}
                          disabled={actionId === blog._id}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-40"
                        >
                          <FaTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
