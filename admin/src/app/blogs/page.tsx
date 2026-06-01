"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchAdminBlogs, updateBlogPost, deleteBlogPost } from '@/components/admin/admin-api';

export default function BlogsListPage() {
  const { token } = useAdmin();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetchAdminBlogs(token);
      setPosts(resp.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const toggleStatus = async (post: any) => {
    if (!token) return;
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      await updateBlogPost(token, post._id, { status: newStatus });
      await load();
    } catch (e) {
      // ignore for now
    }
  };

  const handleDelete = async (post: any) => {
    if (!token || !confirm('Delete this blog post permanently?')) return;
    try {
      await deleteBlogPost(token, post._id);
      await load();
    } catch (e) {
      // ignore
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Blog posts</h2>
        <Link href="/create-blog" className="admin-button-primary">Create new</Link>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? <div className="text-red-400">{error}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="p-2">Title</th>
              <th className="p-2">Status</th>
              <th className="p-2">Author</th>
              <th className="p-2">Published</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post._id} className="border-t border-white/5">
                <td className="p-2">
                  <Link href={`/blogs/${post._id}`} className="text-cyan-300 hover:underline">
                    {post.title}
                  </Link>
                </td>
                <td className="p-2">{post.status}</td>
                <td className="p-2">{post.authorName || 'Admin'}</td>
                <td className="p-2">{post.publishedAt ? new Date(post.publishedAt).toLocaleString() : '-'}</td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => toggleStatus(post)} className="admin-button-secondary">{post.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                  <Link href={`/blogs/${post._id}`} className="admin-button-primary">Edit</Link>
                  <button onClick={() => handleDelete(post)} className="admin-button-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
