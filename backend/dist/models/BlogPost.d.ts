import mongoose, { Document } from 'mongoose';
export type BlogPostStatus = 'draft' | 'published';
export interface IBlogPost extends Document {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    contentJson?: string;
    coverImage?: string;
    tags: string[];
    status: BlogPostStatus;
    authorId: mongoose.Types.ObjectId;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const BlogPost: mongoose.Model<IBlogPost, {}, {}, {}, mongoose.Document<unknown, {}, IBlogPost, {}, {}> & IBlogPost & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=BlogPost.d.ts.map