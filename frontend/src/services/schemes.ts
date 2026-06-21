export type GovtScheme = {
    _id: string;
    title: string;
    slug: string;
    summary: string;
    description: string;
    department: string;
    audience: string;
    benefits: string[];
    applicationLink?: string;
    coverImage?: string;
    tags: string[];
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

export async function fetchPublishedSchemes() {
    const response = await fetch(`${API_ROOT}/schemes`, { next: { revalidate: 60 } });
    const payload = await parseJsonSafe(response);
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch government schemes');
    return (payload?.data || []) as GovtScheme[];
}

export async function fetchSchemeBySlug(slug: string) {
    const response = await fetch(`${API_ROOT}/schemes/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    const payload = await parseJsonSafe(response);
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch scheme details');
    return payload?.data as GovtScheme;
}
