import mongoose, { Document } from 'mongoose';
export interface IActiveCrop extends Document {
    farmerId: string;
    myCropId: string;
    cropName: string;
    fieldLabel: string;
    sowingDate: Date;
    growingDurationDays: number;
    currentStage: string;
    progressPercent: number;
    isHarvested: boolean;
    harvestDate?: Date;
    notes?: string;
    aiRecommendation?: string;
    aiRecommendationTranslations?: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ActiveCrop: mongoose.Model<IActiveCrop, {}, {}, {}, mongoose.Document<unknown, {}, IActiveCrop, {}, {}> & IActiveCrop & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ActiveCrop.d.ts.map