import mongoose, { Document } from 'mongoose';
export interface IKVK extends Document {
    name: string;
    address: string;
    village?: string;
    district: string;
    state: string;
    pincode?: string;
    latitude: number;
    longitude: number;
    phone?: string;
    altPhone?: string;
    email?: string;
    website?: string;
    officeTimings?: string;
    servicesOffered?: string[];
    notes?: string;
    photoUrl?: string;
    isActive: boolean;
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const KVK: mongoose.Model<IKVK, {}, {}, {}, mongoose.Document<unknown, {}, IKVK, {}, {}> & IKVK & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=KVK.d.ts.map