import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    name: string;
    email: string;
    phone?: string;
    password: string;
    profileImage?: string;
    farmSize: number;
    companyName?: string;
    businessType?: string;
    location: {
        country: string;
        state: string;
        district: string;
        village: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
    };
    soilType: string;
    waterSource: string;
    role: 'farmer' | 'vendor' | 'admin';
    authProvider?: 'local' | 'google';
    googleId?: string;
    crops: string[];
    points: number;
    verified: boolean;
    isActive: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map