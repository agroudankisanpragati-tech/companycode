import mongoose, { Schema, Document } from 'mongoose';

export interface IShop extends Document {
  ownerId: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  ownerName: string;
  businessType: string;
  category: string;
  description: string;
  gstNumber?: string;
  panNumber?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  telegram?: string;
  emergencyContact?: string;
  logo?: string;
  cover?: string;
  address: {
    state: string;
    district: string;
    tehsil?: string;
    village?: string;
    pincode?: string;
    landmark?: string;
    fullAddress: string;
  };
  location: {
    latitude: number;
    longitude: number;
    googleDirectionLink?: string;
    placeName?: string;
  };
  openingTime?: string;
  closingTime?: string;
  workingDays: string[];
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verified: boolean;
  featured: boolean;
  averageRating: number;
  totalReviews: number;
  totalViews: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const shopSchema = new Schema<IShop>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true },
    businessType: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    gstNumber: String,
    panNumber: String,
    phone: { type: String, required: true },
    whatsapp: String,
    email: String,
    website: String,
    facebook: String,
    instagram: String,
    youtube: String,
    telegram: String,
    emergencyContact: String,
    logo: String,
    cover: String,
    address: {
      state: { type: String, default: '' },
      district: { type: String, default: '' },
      tehsil: String,
      village: String,
      pincode: String,
      landmark: String,
      fullAddress: { type: String, default: '' },
    },
    location: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      googleDirectionLink: String,
      placeName: String,
    },
    openingTime: String,
    closingTime: String,
    workingDays: [String],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: String,
    deletedAt: Date,
  },
  { timestamps: true }
);

shopSchema.index({ 'address.state': 1, 'address.district': 1 });
shopSchema.index({ category: 1, status: 1 });
shopSchema.index({ name: 'text', description: 'text', 'address.fullAddress': 'text' });

export const Shop = mongoose.model<IShop>('Shop', shopSchema);
