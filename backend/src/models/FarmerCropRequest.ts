import mongoose, { Schema, Document } from 'mongoose';

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

const FarmerCropRequestSchema = new Schema<IFarmerCropRequest>(
  {
    farmerId: { type: String, required: true, index: true },
    farmArea: { type: Number, required: true },
    areaUnit: { type: String, enum: ['acre', 'bigha', 'hectare'], default: 'acre' },
    state: { type: String, required: true },
    district: { type: String, required: true },
    village: { type: String },
    soilType: { type: String, required: true },
    soilPH: { type: Number, required: true },
    organicCarbon: { type: Number },
    nitrogen: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    ecValue: { type: Number },
    waterAvailability: { type: String, enum: ['low', 'medium', 'high'], required: true },
    irrigationType: { type: String, required: true },
    rainfall: { type: Number },
    averageTemperature: { type: Number },
    season: { type: String, enum: ['Kharif', 'Rabi', 'Zaid', 'Year-round'], required: true },
    farmingType: { type: String, enum: ['organic', 'conventional', 'mixed'], default: 'conventional' },
    budget: { type: Number, required: true },
    previousCrop: { type: String },
    preferredCrop: { type: String },
  },
  { timestamps: true }
);

export const FarmerCropRequest = mongoose.model<IFarmerCropRequest>('FarmerCropRequest', FarmerCropRequestSchema);
