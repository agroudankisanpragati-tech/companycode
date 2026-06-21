import mongoose, { Document } from 'mongoose';
export interface ISoilMoisture extends Document {
    farmerId: string;
    state: string;
    district: string;
    moisturePercentage: number;
    moistureStatus: string;
    rainfallMm?: number;
    humidity?: number;
    lastUpdated: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SoilMoisture: mongoose.Model<ISoilMoisture, {}, {}, {}, mongoose.Document<unknown, {}, ISoilMoisture, {}, {}> & ISoilMoisture & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SoilMoisture.d.ts.map