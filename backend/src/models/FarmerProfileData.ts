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
}

export interface ICropRecord {
  _id?: string;
  cropName: string;
  season: string;
  sowingDate: string;
  harvestDate: string;
  yieldKg: number;
  marketPrice: number;
  profit: number;
  notes?: string;
}

export interface IFarmerProfileData extends Document {
  userId: string;
  // Personal extras
  village: string;
  pincode: string;
  dateOfBirth: string;
  gender: string;
  experience: number;
  // Farm details
  farmName: string;
  totalArea: number;
  farmingType: string;
  farmingMethod: string;
  irrigationType: string;
  waterAvailability: string;
  soilType: string;
  // Land parcels
  landParcels: ILandParcel[];
  // Crop history
  cropHistory: ICropRecord[];
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
});

const CropRecordSchema = new Schema<ICropRecord>({
  cropName: { type: String, required: true },
  season: { type: String, default: '' },
  sowingDate: { type: String, default: '' },
  harvestDate: { type: String, default: '' },
  yieldKg: { type: Number, default: 0 },
  marketPrice: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  notes: { type: String, default: '' },
});

const schema = new Schema<IFarmerProfileData>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    village: { type: String, default: '' },
    pincode: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    experience: { type: Number, default: 0 },
    farmName: { type: String, default: '' },
    totalArea: { type: Number, default: 0 },
    farmingType: { type: String, default: 'Crop Farming' },
    farmingMethod: { type: String, default: 'Traditional' },
    irrigationType: { type: String, default: '' },
    waterAvailability: { type: String, default: 'Medium' },
    soilType: { type: String, default: '' },
    landParcels: { type: [LandParcelSchema], default: [] },
    cropHistory: { type: [CropRecordSchema], default: [] },
  },
  { timestamps: true }
);

export const FarmerProfileData = mongoose.model<IFarmerProfileData>('FarmerProfileData', schema);
