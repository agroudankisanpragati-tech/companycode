import mongoose, { Document } from 'mongoose';
export interface IIrrigationLog {
    date: Date;
    durationMinutes: number;
    method: string;
    aiDecision: string;
    soilMoistureAtTime: number;
    weatherCondition: string;
}
export interface IIrrigationSchedule extends Document {
    farmerId: string;
    cropName: string;
    fieldName: string;
    irrigationMethod: 'drip' | 'sprinkler' | 'flood' | 'furrow';
    fieldAreaAcres: number;
    soilType: string;
    currentMoisture: number;
    moistureStatus: string;
    aiDecision: string;
    aiReason: string;
    aiReasonHindi: string;
    recommendedDurationMinutes: number;
    nextIrrigationDate: Date | null;
    rainForecastMm: number;
    rainForecastDays: number;
    weatherCondition: string;
    temperature: number;
    humidity: number;
    alertSent: boolean;
    logs: IIrrigationLog[];
    lastAnalyzed: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const IrrigationSchedule: mongoose.Model<IIrrigationSchedule, {}, {}, {}, mongoose.Document<unknown, {}, IIrrigationSchedule, {}, {}> & IIrrigationSchedule & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=IrrigationSchedule.d.ts.map