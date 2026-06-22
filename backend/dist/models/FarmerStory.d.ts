import mongoose, { Document } from 'mongoose';
export type StoryCategory = 'Success Story' | 'Organic Farming' | 'Medicinal Farming' | 'High Profit Farming' | 'Innovation' | 'Water Saving' | 'Technology Adoption';
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
    uploadedBy?: string;
    uploadedByAdmin: boolean;
    likes: number;
    views: number;
    likedBy: string[];
    savedBy: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const FarmerStory: mongoose.Model<IFarmerStory, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerStory, {}, {}> & IFarmerStory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerStory.d.ts.map