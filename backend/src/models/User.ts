import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  profileImage?: string;
  farmSize: number;
  companyName?: string;
  businessType?: string;
  location: {
    country: string;
    state: string;
    district: string;
    village: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  soilType: string;
  waterSource: string;
  role: 'farmer' | 'vendor' | 'admin';
  authProvider?: 'local' | 'google';
  googleId?: string;
  crops: string[];
  points: number;
  verified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    profileImage: { type: String, default: '' },
    farmSize: { type: Number, required: true },
    companyName: { type: String },
    businessType: { type: String },
    location: {
      country: { type: String, default: '' },
      state: { type: String, default: '' },
      district: { type: String, default: '' },
      village: { type: String, default: '' },
      coordinates: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
      },
    },
    soilType: { type: String },
    waterSource: { type: String },
    role: { type: String, enum: ['farmer', 'vendor', 'admin'], default: 'farmer' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String },
    crops: [String],
    points: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
