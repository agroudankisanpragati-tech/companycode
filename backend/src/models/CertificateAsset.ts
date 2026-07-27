import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificateAsset extends Document {
  companyLogo: string;
  founderSignature: string;
  companySeal: string;
  uploadedAt: Date;
  updatedAt: Date;
}

const CertificateAssetSchema = new Schema<ICertificateAsset>(
  {
    companyLogo:      { type: String, default: '' },
    founderSignature: { type: String, default: '' },
    companySeal:      { type: String, default: '' },
    uploadedAt:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const CertificateAsset = mongoose.model<ICertificateAsset>('CertificateAsset', CertificateAssetSchema);
