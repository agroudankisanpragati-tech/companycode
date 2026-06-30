import mongoose, { Schema, Document } from 'mongoose';

export interface IShopkeeperProfile extends Document {
  userId: mongoose.Types.ObjectId;
  shopType: 'fertilizer' | 'nursery';
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  email: string;
  address: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  pincode: string;
  profileImage?: string;
  coverImage?: string;
  latitude: number;
  longitude: number;
  registrationDate?: Date;
  // Fertilizer verification fields
  gstNumber?: string;
  gstCertificate?: string;
  shopLicenseNumber?: string;
  shopRegistrationImage?: string;
  // Nursery verification fields
  nurseryName?: string;
  nurseryPhoto?: string;
  nurseryDescription?: string;
  nurseryRegistrationCertificate?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  rejectedAt?: Date;
  reApplicationAllowed: boolean;
  profileCompleted: boolean;
  verificationSubmitted: boolean;
  suspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const shopkeeperProfileSchema = new Schema<IShopkeeperProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    shopType: { type: String, enum: ['fertilizer', 'nursery'], required: true },
    shopName: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    mobileNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    village: { type: String, default: '' },
    tehsil: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    profileImage: String,
    coverImage: String,
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    registrationDate: Date,
    gstNumber: String,
    gstCertificate: String,
    shopLicenseNumber: String,
    shopRegistrationImage: String,
    nurseryName: String,
    nurseryPhoto: String,
    nurseryDescription: String,
    nurseryRegistrationCertificate: String,
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    rejectedAt: Date,
    reApplicationAllowed: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false, index: true },
    verificationSubmitted: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

shopkeeperProfileSchema.index({ district: 1, state: 1 });
shopkeeperProfileSchema.index({ latitude: 1, longitude: 1 });
shopkeeperProfileSchema.index({ shopType: 1, verificationStatus: 1 });

export const ShopkeeperProfile = mongoose.model<IShopkeeperProfile>('ShopkeeperProfile', shopkeeperProfileSchema);
