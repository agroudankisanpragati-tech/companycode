export type GalleryMediaType = 'photo' | 'video';

export type GalleryItem = {
    _id: string;
    title: string;
    caption?: string;
    mediaType: GalleryMediaType;
    mediaUrl: string;
    fileName: string;
    mimeType: string;
    featured?: boolean;
    status: 'draft' | 'published';
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

// Uploads are served from backend root — resolve absolute URL at runtime
const resolveMediaUrl = (value: string) => {
    if (value.startsWith('http')) return value;
    // /uploads/* served from backend port 5000 directly
    const backendOrigin = process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/i, '')
        : 'http://localhost:5000';
    if (value.startsWith('/uploads')) return `${backendOrigin}${value}`;
    return `${backendOrigin}/api${value}`;
};

export async function fetchPublishedGallery() {
    const response = await fetch(`${API_ROOT}/gallery`, { next: { revalidate: 60 } });
    const payload = await parseJsonSafe(response);
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch gallery items');
    return ((payload?.data || []) as GalleryItem[]).map((item) => ({
        ...item,
        mediaUrl: resolveMediaUrl(item.mediaUrl),
    }));
}
