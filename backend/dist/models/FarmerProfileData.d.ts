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
    khasraNumber?: string;
    soilHealthStatus?: string;
}
export interface ICropRecord {
    _id?: string;
    cropName: string;
    season: string;
    year?: number;
    sowingDate: string;
    harvestDate: string;
    yieldKg: number;
    marketPrice: number;
    profit: number;
    production?: number;
    remarks?: string;
    notes?: string;
}
export interface IFarmDetail {
    _id?: string;
    farmName: string;
    farmSize: number;
    farmSizeUnit: 'acres' | 'hectares' | 'bigha';
    irrigationType: string;
    soilType: string;
    farmingCategory: string;
    organicCertified: boolean;
    waterSource?: string;
}
export interface IFarmerProfileData extends Document {
    userId: string;
    village: string;
    pincode: string;
    dateOfBirth: string;
    gender: string;
    age?: number;
    education?: string;
    experience: number;
    address?: string;
    district?: string;
    state?: string;
    languagePreference?: string;
    farmName: string;
    totalArea: number;
    farmingType: string;
    farmingMethod: string;
    irrigationType: string;
    waterAvailability: string;
    soilType: string;
    organicCertified?: boolean;
    farmDetails: IFarmDetail[];
    landParcels: ILandParcel[];
    cropHistory: ICropRecord[];
    appLanguage?: string;
    voiceEnabled?: boolean;
    notificationLanguage?: string;
}
export declare const FarmerProfileData: mongoose.Model<IFarmerProfileData, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerProfileData, {}, {}> & IFarmerProfileData & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerProfileData.d.ts.map