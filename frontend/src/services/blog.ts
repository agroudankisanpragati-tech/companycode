export type BlogPost = {
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage?: string;
    tags: string[];
    status: 'draft' | 'published';
    authorName?: string;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
};

const API_ROOT = '/api';

async function parseJsonSafe(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function fetchPublishedBlogs() {
    const response = await fetch(`${API_ROOT}/blogs`, { next: { revalidate: 60 } });
    const payload = await parseJsonSafe(response);
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch blogs');
    return (payload?.data || []) as BlogPost[];
}

export async function fetchBlogBySlug(slug: string) {
    const response = await fetch(`${API_ROOT}/blogs/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    const payload = await parseJsonSafe(response);
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch blog details');
    return payload?.data as BlogPost;
}
