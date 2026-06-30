import mongoose, { Document } from 'mongoose';
export interface IShopkeeperProfile extends Document {
    userId: mongoose.Types.ObjectId;
    shopType: 'fertilizer' | 'nursery';
    shopName: string;
    ownerName: string;
    mobileNumber: string;
    email: string;
    address: string;
    village: string;
    tehsil: string;
    district: string;
    state: string;
    pincode: string;
    profileImage?: string;
    coverImage?: string;
    latitude: number;
    longitude: number;
    registrationDate?: Date;
    gstNumber?: string;
    gstCertificate?: string;
    shopLicenseNumber?: string;
    shopRegistrationImage?: string;
    nurseryName?: string;
    nurseryPhoto?: string;
    nurseryDescription?: string;
    nurseryRegistrationCertificate?: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
    rejectionReason?: string;
    rejectedAt?: Date;
    reApplicationAllowed: boolean;
    profileCompleted: boolean;
    verificationSubmitted: boolean;
    suspended: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ShopkeeperProfile: mongoose.Model<IShopkeeperProfile, {}, {}, {}, mongoose.Document<unknown, {}, IShopkeeperProfile, {}, {}> & IShopkeeperProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ShopkeeperProfile.d.ts.map