import mongoose, { Schema, Document } from 'mongoose';

export interface IFertilizerProduct extends Document {
  shopkeeperId: mongoose.Types.ObjectId;
  productName: string;
  brandName: string;
  category: string;
  productSubCategory: 'seed' | 'fertilizer' | 'pesticide' | 'herbicide' | 'fungicide' | 'micronutrient' | 'bio_fertilizer' | 'growth_regulator' | 'other';
  cropType: string;   // normalized crop name for AI seed search e.g. "Wheat", "Rice"
  variety: string;    // e.g. "HD-2967", "Pioneer Hybrid"
  productImages: string[];
  quantity: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  description: string;
  usageInstructions: string;
  dosage: string;
  cropSuitability: string[];
  nutrientComposition: string;
  manufacturingCompany: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  stockStatus: 'in_stock' | 'out_of_stock';
  aiScanned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fertilizerProductSchema = new Schema<IFertilizerProduct>(
  {
    shopkeeperId: { type: Schema.Types.ObjectId, ref: 'ShopkeeperProfile', required: true, index: true },
    productName: { type: String, required: true, trim: true },
    brandName: { type: String, default: '' },
    category: { type: String, default: 'Fertilizer' },
    productSubCategory: {
      type: String,
      enum: ['seed','fertilizer','pesticide','herbicide','fungicide','micronutrient','bio_fertilizer','growth_regulator','other'],
      default: 'fertilizer',
      index: true,
    },
    cropType: { type: String, default: '', trim: true, index: true },
    variety: { type: String, default: '' },
    productImages: [String],
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'kg' },
    mrp: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    usageInstructions: { type: String, default: '' },
    dosage: { type: String, default: '' },
    cropSuitability: [String],
    nutrientComposition: { type: String, default: '' },
    manufacturingCompany: { type: String, default: '' },
    manufacturingDate: Date,
    expiryDate: Date,
    stockStatus: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock', index: true },
    aiScanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fertilizerProductSchema.index({ shopkeeperId: 1, stockStatus: 1 });
fertilizerProductSchema.index({ cropType: 1, productSubCategory: 1, stockStatus: 1 });
fertilizerProductSchema.index({ productName: 'text', brandName: 'text', cropType: 'text', variety: 'text', description: 'text' });

export const FertilizerProduct = mongoose.model<IFertilizerProduct>('FertilizerProduct', fertilizerProductSchema);
