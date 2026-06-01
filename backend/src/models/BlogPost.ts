import mongoose, { Document, Schema } from 'mongoose';

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

const blogPostSchema = new Schema<IBlogPost>(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        excerpt: { type: String, required: true, trim: true, maxlength: 320 },
        content: { type: String, required: true, trim: true },
        contentJson: { type: String },
        coverImage: { type: String, trim: true },
        tags: [{ type: String, trim: true, lowercase: true }],
        status: { type: String, enum: ['draft', 'published'], default: 'draft' },
        authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        publishedAt: { type: Date },
    },
    { timestamps: true }
);

blogPostSchema.index({ createdAt: -1 });

export const BlogPost = mongoose.model<IBlogPost>('BlogPost', blogPostSchema);
