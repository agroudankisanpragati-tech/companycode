import mongoose, { Schema, Document } from 'mongoose';

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

const soilMoistureSchema = new Schema<ISoilMoisture>(
  {
    farmerId: { type: String, required: true },
    state: { type: String, required: true },
    district: { type: String, required: true },
    moisturePercentage: { type: Number, required: true },
    moistureStatus: { type: String, required: true },
    rainfallMm: { type: Number },
    humidity: { type: Number },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One record per farmer (upsert on fetch)
soilMoistureSchema.index({ farmerId: 1 }, { unique: true });

export const SoilMoisture = mongoose.model<ISoilMoisture>('SoilMoisture', soilMoistureSchema);
