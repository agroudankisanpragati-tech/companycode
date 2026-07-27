import mongoose, { Schema, Document } from 'mongoose';

export interface IInternCertificate extends Document {
  internId: string;
  certificateNumber: string;
  name: string;
  collegeName: string;
  internshipDomain: string;
  internshipType: 'Paid' | 'Unpaid';
  duration: string;
  startDate: Date;
  endDate: Date;
  email?: string;
  phone?: string;
  remarks?: string;
  certificateDescription: string;
  verificationUrl: string;
  qrCodeUrl: string;
  pdfUrl: string;
  status: 'active' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

const InternCertificateSchema = new Schema<IInternCertificate>(
  {
    internId:               { type: String, required: true, unique: true },
    certificateNumber:      { type: String, required: true, unique: true },
    name:                   { type: String, required: true, trim: true },
    collegeName:            { type: String, required: true, trim: true },
    internshipDomain:       { type: String, required: true, trim: true },
    internshipType:         { type: String, enum: ['Paid', 'Unpaid'], required: true },
    duration:               { type: String, required: true, trim: true },
    startDate:              { type: Date, required: true },
    endDate:                { type: Date, required: true },
    email:                  { type: String, default: '', trim: true, lowercase: true },
    phone:                  { type: String, default: '', trim: true },
    remarks:                { type: String, default: '', trim: true },
    certificateDescription: { type: String, required: true },
    verificationUrl:        { type: String, required: true },
    qrCodeUrl:              { type: String, default: '' },
    pdfUrl:                 { type: String, default: '' },
    status:                 { type: String, enum: ['active', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

InternCertificateSchema.index({ name: 'text', collegeName: 'text', internshipDomain: 'text' });
InternCertificateSchema.index({ certificateNumber: 1 });
InternCertificateSchema.index({ internshipType: 1 });
InternCertificateSchema.index({ createdAt: -1 });

export const InternCertificate = mongoose.model<IInternCertificate>('InternCertificate', InternCertificateSchema);
