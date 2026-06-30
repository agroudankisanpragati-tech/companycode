import mongoose, { Schema, Document } from 'mongoose';

export interface INurseryProduct extends Document {
  shopkeeperId: mongoose.Types.ObjectId;
  plantName: string;
  variety: string;
  productImages: string[];
  price: number;
  description: string;
  availableQuantity: number;
  plantAge: string;
  plantHeight: string;
  sunlightRequirement: string;
  waterRequirement: string;
  suitableSeason: string[];
  growthDuration: string;
  maintenanceLevel: 'low' | 'medium' | 'high';
  organicCertified: boolean;
  stockStatus: 'in_stock' | 'out_of_stock';
  createdAt: Date;
  updatedAt: Date;
}

const nurseryProductSchema = new Schema<INurseryProduct>(
  {
    shopkeeperId: { type: Schema.Types.ObjectId, ref: 'ShopkeeperProfile', required: true, index: true },
    plantName: { type: String, required: true, trim: true },
    variety: { type: String, default: '' },
    productImages: [String],
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    availableQuantity: { type: Number, default: 0, min: 0 },
    plantAge: { type: String, default: '' },
    plantHeight: { type: String, default: '' },
    sunlightRequirement: { type: String, default: '' },
    waterRequirement: { type: String, default: '' },
    suitableSeason: [String],
    growthDuration: { type: String, default: '' },
    maintenanceLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    organicCertified: { type: Boolean, default: false },
    stockStatus: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock', index: true },
  },
  { timestamps: true }
);

nurseryProductSchema.index({ shopkeeperId: 1, stockStatus: 1 });
nurseryProductSchema.index({ plantName: 'text', variety: 'text', description: 'text' });

export const NurseryProduct = mongoose.model<INurseryProduct>('NurseryProduct', nurseryProductSchema);
