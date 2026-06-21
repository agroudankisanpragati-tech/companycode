import mongoose, { Schema, Document } from 'mongoose';

export type TaskType = 'irrigation' | 'fertilizer' | 'pesticide' | 'weeding' | 'monitoring' | 'harvest' | 'general';
export type TaskStatus = 'pending' | 'done' | 'skipped';

export interface ICropTask extends Document {
  farmerId:      string;
  activeCropId:  string;
  cropName:      string;
  dayNumber:     number;   // day from sowing (1-based)
  scheduledDate: Date;
  title:         string;
  description:   string;
  taskType:      TaskType;
  status:        TaskStatus;
  completedAt?:  Date;
  createdAt:     Date;
  updatedAt:     Date;
}

const schema = new Schema<ICropTask>(
  {
    farmerId:      { type: String, required: true, index: true },
    activeCropId:  { type: String, required: true, index: true },
    cropName:      { type: String, required: true },
    dayNumber:     { type: Number, required: true },
    scheduledDate: { type: Date,   required: true },
    title:         { type: String, required: true },
    description:   { type: String, default: '' },
    taskType:      { type: String, enum: ['irrigation','fertilizer','pesticide','weeding','monitoring','harvest','general'], default: 'general' },
    status:        { type: String, enum: ['pending','done','skipped'], default: 'pending' },
    completedAt:   { type: Date },
  },
  { timestamps: true }
);

schema.index({ farmerId: 1, scheduledDate: 1 });
schema.index({ activeCropId: 1, dayNumber: 1 });

export const CropTask = mongoose.model<ICropTask>('CropTask', schema);
