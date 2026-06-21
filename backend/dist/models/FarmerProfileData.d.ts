import mongoose, { Document } from 'mongoose';
export interface ILandParcel {
    _id?: string;
    name: string;
    area: number;
    unit: 'acres' | 'hectares' | 'bigha';
    soilType: string;
    waterSource: string;
    latitude: number;
    longitude: number;
    ownershipType: 'owned' | 'leased' | 'shared';
}
export interface ICropRecord {
    _id?: string;
    cropName: string;
    season: string;
    sowingDate: string;
    harvestDate: string;
    yieldKg: number;
    marketPrice: number;
    profit: number;
    notes?: string;
}
export interface IFarmerProfileData extends Document {
    userId: string;
    village: string;
    pincode: string;
    dateOfBirth: string;
    gender: string;
    experience: number;
    farmName: string;
    totalArea: number;
    farmingType: string;
    farmingMethod: string;
    irrigationType: string;
    waterAvailability: string;
    soilType: string;
    landParcels: ILandParcel[];
    cropHistory: ICropRecord[];
}
export declare const FarmerProfileData: mongoose.Model<IFarmerProfileData, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerProfileData, {}, {}> & IFarmerProfileData & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerProfileData.d.ts.map