import mongoose, { Schema, Document } from 'mongoose';

export interface IFarmerMarketPreference extends Document {
  farmerId: string;
  selectedCrop: string;
  selectedDistrict: string;
  selectedState: string;
  updatedAt: Date;
}

const schema = new Schema<IFarmerMarketPreference>(
  {
    farmerId: { type: String, ref: 'User', required: true, unique: true },
    selectedCrop: { type: String, default: 'Wheat' },
    selectedDistrict: { type: String, default: '' },
    selectedState: { type: String, default: '' },
  },
  { timestamps: true }
);

export const FarmerMarketPreference = mongoose.model<IFarmerMarketPreference>(
  'FarmerMarketPreference',
  schema
);
