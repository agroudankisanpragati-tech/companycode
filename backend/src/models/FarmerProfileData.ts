import mongoose, { Schema, Document } from 'mongoose';

export interface ILandParcel {
  _id?: string;
  name: string;
  area: number;
  unit: 'acres' | 'hectares' | 'bigha';
  soilType: string;
  waterSource: string;
  latitude: number;
  longitude: number;
  ownershipType: 'owned' | 'leased' | 'shared';
  khasraNumber?: string;
  soilHealthStatus?: string;
}

export interface ICropRecord {
  _id?: string;
  cropName: string;
  season: string;
  year?: number;
  sowingDate: string;
  harvestDate: string;
  yieldKg: number;
  marketPrice: number;
  profit: number;
  production?: number;
  remarks?: string;
  notes?: string;
}

export interface IFarmDetail {
  _id?: string;
  farmName: string;
  farmSize: number;
  farmSizeUnit: 'acres' | 'hectares' | 'bigha';
  irrigationType: string;
  soilType: string;
  farmingCategory: string;
  organicCertified: boolean;
  waterSource?: string;
}

export interface IFarmerProfileData extends Document {
  userId: string;
  village: string;
  pincode: string;
  dateOfBirth: string;
  gender: string;
  age?: number;
  education?: string;
  experience: number;
  address?: string;
  district?: string;
  state?: string;
  languagePreference?: string;
  // Farm
  farmName: string;
  totalArea: number;
  farmingType: string;
  farmingMethod: string;
  irrigationType: string;
  waterAvailability: string;
  soilType: string;
  organicCertified?: boolean;
  farmDetails: IFarmDetail[];
  // Land
  landParcels: ILandParcel[];
  // Crops
  cropHistory: ICropRecord[];
  // Language prefs
  appLanguage?: string;
  voiceEnabled?: boolean;
  notificationLanguage?: string;
}

const LandParcelSchema = new Schema<ILandParcel>({
  name: { type: String, default: '' },
  area: { type: Number, default: 0 },
  unit: { type: String, enum: ['acres', 'hectares', 'bigha'], default: 'acres' },
  soilType: { type: String, default: '' },
  waterSource: { type: String, default: '' },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  ownershipType: { type: String, enum: ['owned', 'leased', 'shared'], default: 'owned' },
  khasraNumber: { type: String, default: '' },
  soilHealthStatus: { type: String, default: '' },
});

const CropRecordSchema = new Schema<ICropRecord>({
  cropName: { type: String, required: true },
  season: { type: String, default: '' },
  year: { type: Number, default: 0 },
  sowingDate: { type: String, default: '' },
  harvestDate: { type: String, default: '' },
  yieldKg: { type: Number, default: 0 },
  marketPrice: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  production: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
  notes: { type: String, default: '' },
});

const FarmDetailSchema = new Schema<IFarmDetail>({
  farmName: { type: String, default: '' },
  farmSize: { type: Number, default: 0 },
  farmSizeUnit: { type: String, enum: ['acres', 'hectares', 'bigha'], default: 'acres' },
  irrigationType: { type: String, default: '' },
  soilType: { type: String, default: '' },
  farmingCategory: { type: String, default: 'Crop Farming' },
  organicCertified: { type: Boolean, default: false },
  waterSource: { type: String, default: '' },
});

const schema = new Schema<IFarmerProfileData>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    village: { type: String, default: '' },
    pincode: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    age: { type: Number, default: 0 },
    education: { type: String, default: '' },
    experience: { type: Number, default: 0 },
    address: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    languagePreference: { type: String, default: 'English' },
    farmName: { type: String, default: '' },
    totalArea: { type: Number, default: 0 },
    farmingType: { type: String, default: 'Crop Farming' },
    farmingMethod: { type: String, default: 'Traditional' },
    irrigationType: { type: String, default: '' },
    waterAvailability: { type: String, default: 'Medium' },
    soilType: { type: String, default: '' },
    organicCertified: { type: Boolean, default: false },
    farmDetails: { type: [FarmDetailSchema], default: [] },
    landParcels: { type: [LandParcelSchema], default: [] },
    cropHistory: { type: [CropRecordSchema], default: [] },
    appLanguage: { type: String, default: 'English' },
    voiceEnabled: { type: Boolean, default: false },
    notificationLanguage: { type: String, default: 'English' },
  },
  { timestamps: true }
);

export const FarmerProfileData = mongoose.model<IFarmerProfileData>('FarmerProfileData', schema);
