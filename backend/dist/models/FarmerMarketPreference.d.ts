import mongoose, { Document } from 'mongoose';
export interface IFarmerMarketPreference extends Document {
    farmerId: string;
    selectedCrop: string;
    selectedDistrict: string;
    selectedState: string;
    updatedAt: Date;
}
export declare const FarmerMarketPreference: mongoose.Model<IFarmerMarketPreference, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerMarketPreference, {}, {}> & IFarmerMarketPreference & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerMarketPreference.d.ts.map