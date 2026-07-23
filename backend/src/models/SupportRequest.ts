import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportRequest extends Document {
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  category: string;
  subject: string;
  message: string;
  attachments: string[];
  status: 'new' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

const SupportRequestSchema = new Schema<ISupportRequest>(
  {
    userId: { type: String, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    attachments: [{ type: String, trim: true }],
    status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
  },
  { timestamps: true }
);

SupportRequestSchema.index({ status: 1, category: 1, createdAt: -1 });

export const SupportRequest = mongoose.model<ISupportRequest>('SupportRequest', SupportRequestSchema);
