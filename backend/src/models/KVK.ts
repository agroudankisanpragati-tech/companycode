import mongoose, { Schema, Document } from 'mongoose';

export interface IKVK extends Document {
  name: string;
  address: string;
  village?: string;
  district: string;
  state: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  altPhone?: string;
  email?: string;
  website?: string;
  officeTimings?: string;
  servicesOffered?: string[];
  notes?: string;
  photoUrl?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KVKSchema = new Schema<IKVK>(
  {
    name:           { type: String, required: true, trim: true },
    address:        { type: String, required: true, trim: true },
    village:        { type: String, default: '', trim: true },
    district:       { type: String, required: true, trim: true },
    state:          { type: String, required: true, trim: true },
    pincode:        { type: String, default: '', trim: true },
    latitude:       { type: Number, required: true },
    longitude:      { type: Number, required: true },
    phone:          { type: String, default: '', trim: true },
    altPhone:       { type: String, default: '', trim: true },
    email:          { type: String, default: '', trim: true, lowercase: true },
    website:        { type: String, default: '', trim: true },
    officeTimings:  { type: String, default: '', trim: true },
    servicesOffered:{ type: [String], default: [] },
    notes:          { type: String, default: '', trim: true },
    photoUrl:       { type: String, default: '', trim: true },
    isActive:       { type: Boolean, default: true },
    createdBy:      { type: String, default: '' },
    updatedBy:      { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index to prevent exact duplicates
KVKSchema.index({ name: 1, district: 1, state: 1 }, { unique: true });
// Geospatial-style index for fast distance queries
KVKSchema.index({ latitude: 1, longitude: 1 });
KVKSchema.index({ state: 1, district: 1 });

export const KVK = mongoose.model<IKVK>('KVK', KVKSchema);
