import mongoose, { Schema, Document } from 'mongoose';

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

const irrigationLogSchema = new Schema<IIrrigationLog>({
  date: { type: Date, required: true },
  durationMinutes: { type: Number, required: true },
  method: { type: String, required: true },
  aiDecision: { type: String },
  soilMoistureAtTime: { type: Number },
  weatherCondition: { type: String },
});

const irrigationScheduleSchema = new Schema<IIrrigationSchedule>(
  {
    farmerId: { type: String, required: true },
    cropName: { type: String, default: 'General' },
    fieldName: { type: String, default: 'My Field' },
    irrigationMethod: { type: String, enum: ['drip', 'sprinkler', 'flood', 'furrow'], default: 'drip' },
    fieldAreaAcres: { type: Number, default: 1 },
    soilType: { type: String, default: 'Loamy' },
    currentMoisture: { type: Number, default: 50 },
    moistureStatus: { type: String, default: 'Moderate' },
    aiDecision: { type: String, default: 'monitor' },
    aiReason: { type: String, default: '' },
    aiReasonHindi: { type: String, default: '' },
    recommendedDurationMinutes: { type: Number, default: 0 },
    nextIrrigationDate: { type: Date, default: null },
    rainForecastMm: { type: Number, default: 0 },
    rainForecastDays: { type: Number, default: 0 },
    weatherCondition: { type: String, default: 'Clear' },
    temperature: { type: Number, default: 28 },
    humidity: { type: Number, default: 60 },
    alertSent: { type: Boolean, default: false },
    logs: { type: [irrigationLogSchema], default: [] },
    lastAnalyzed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

irrigationScheduleSchema.index({ farmerId: 1 }, { unique: true });

export const IrrigationSchedule = mongoose.model<IIrrigationSchedule>('IrrigationSchedule', irrigationScheduleSchema);
