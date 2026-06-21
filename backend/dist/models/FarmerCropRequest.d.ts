import mongoose, { Document } from 'mongoose';
export interface IFarmerCropRequest extends Document {
    farmerId: string;
    farmArea: number;
    areaUnit: 'acre' | 'bigha' | 'hectare';
    state: string;
    district: string;
    village?: string;
    soilType: string;
    soilPH: number;
    organicCarbon?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    ecValue?: number;
    waterAvailability: 'low' | 'medium' | 'high';
    irrigationType: string;
    rainfall?: number;
    averageTemperature?: number;
    season: 'Kharif' | 'Rabi' | 'Zaid' | 'Year-round';
    farmingType: 'organic' | 'conventional' | 'mixed';
    budget: number;
    previousCrop?: string;
    preferredCrop?: string;
    createdAt: Date;
}
export declare const FarmerCropRequest: mongoose.Model<IFarmerCropRequest, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerCropRequest, {}, {}> & IFarmerCropRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerCropRequest.d.ts.map