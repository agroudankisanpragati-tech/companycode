import mongoose, { Document } from 'mongoose';
export type TaskType = 'irrigation' | 'fertilizer' | 'pesticide' | 'weeding' | 'monitoring' | 'harvest' | 'general';
export type TaskStatus = 'pending' | 'done' | 'skipped';
export interface ICropTask extends Document {
    farmerId: string;
    activeCropId: string;
    cropName: string;
    dayNumber: number;
    scheduledDate: Date;
    title: string;
    description: string;
    taskType: TaskType;
    status: TaskStatus;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CropTask: mongoose.Model<ICropTask, {}, {}, {}, mongoose.Document<unknown, {}, ICropTask, {}, {}> & ICropTask & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CropTask.d.ts.map