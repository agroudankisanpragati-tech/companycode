import mongoose, { Document } from 'mongoose';
export interface IShop extends Document {
    ownerId: mongoose.Types.ObjectId;
    slug: string;
    name: string;
    ownerName: string;
    businessType: string;
    category: string;
    description: string;
    gstNumber?: string;
    panNumber?: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    telegram?: string;
    emergencyContact?: string;
    logo?: string;
    cover?: string;
    address: {
        state: string;
        district: string;
        tehsil?: string;
        village?: string;
        pincode?: string;
        landmark?: string;
        fullAddress: string;
    };
    location: {
        latitude: number;
        longitude: number;
        googleDirectionLink?: string;
        placeName?: string;
    };
    openingTime?: string;
    closingTime?: string;
    workingDays: string[];
    status: 'pending' | 'approved' | 'rejected' | 'suspended';
    verified: boolean;
    featured: boolean;
    averageRating: number;
    totalReviews: number;
    totalViews: number;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Shop: mongoose.Model<IShop, {}, {}, {}, mongoose.Document<unknown, {}, IShop, {}, {}> & IShop & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Shop.d.ts.map