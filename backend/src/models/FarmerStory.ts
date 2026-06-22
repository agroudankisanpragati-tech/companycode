import mongoose, { Schema, Document } from 'mongoose';

export type StoryCategory =
  | 'Success Story'
  | 'Organic Farming'
  | 'Medicinal Farming'
  | 'High Profit Farming'
  | 'Innovation'
  | 'Water Saving'
  | 'Technology Adoption';

export interface IFarmerStory extends Document {
  farmerName: string;
  village?: string;
  district?: string;
  state?: string;
  cropName?: string;
  title: string;
  caption?: string;
  successDescription?: string;
  category: StoryCategory;
  videoUrl: string;
  thumbnailUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  uploadedBy?: string; // userId — null for admin uploads
  uploadedByAdmin: boolean;
  likes: number;
  views: number;
  likedBy: string[]; // userIds
  savedBy: string[]; // userIds
  createdAt: Date;
  updatedAt: Date;
}

const FarmerStorySchema = new Schema<IFarmerStory>(
  {
    farmerName: { type: String, required: true },
    village: { type: String },
    district: { type: String },
    state: { type: String },
    cropName: { type: String },
    title: { type: String, required: true },
    caption: { type: String },
    successDescription: { type: String },
    category: {
      type: String,
      enum: ['Success Story', 'Organic Farming', 'Medicinal Farming', 'High Profit Farming', 'Innovation', 'Water Saving', 'Technology Adoption'],
      default: 'Success Story',
    },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    featured: { type: Boolean, default: false },
    uploadedBy: { type: String, index: true },
    uploadedByAdmin: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    savedBy: [{ type: String }],
  },
  { timestamps: true }
);

FarmerStorySchema.index({ status: 1, createdAt: -1 });
FarmerStorySchema.index({ featured: 1, status: 1 });

export const FarmerStory = mongoose.model<IFarmerStory>('FarmerStory', FarmerStorySchema);
