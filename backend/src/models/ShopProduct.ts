import mongoose, { Schema, Document } from 'mongoose';

export interface IShopProduct extends Document {
  shopId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  sku?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  description: string;
  specifications?: Record<string, string>;
  mrp: number;
  sellingPrice: number;
  discount: number;
  tax?: number;
  stock: number;
  minOrderQty: number;
  unit: string;
  images: string[];
  featured: boolean;
  status: 'active' | 'inactive' | 'out_of_stock' | 'deleted';
  tags: string[];
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  totalViews: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const shopProductSchema = new Schema<IShopProduct>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    sku: String,
    category: { type: String, required: true },
    subcategory: String,
    brand: String,
    description: { type: String, default: '' },
    specifications: { type: Map, of: String },
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    tax: Number,
    stock: { type: Number, default: 0, min: 0 },
    minOrderQty: { type: Number, default: 1, min: 1 },
    unit: { type: String, default: 'piece' },
    images: [String],
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'out_of_stock', 'deleted'], default: 'active', index: true },
    tags: [String],
    weight: Number,
    dimensions: { length: Number, width: Number, height: Number },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: String,
    totalViews: { type: Number, default: 0 },
    deletedAt: Date,
  },
  { timestamps: true }
);

shopProductSchema.index({ shopId: 1, slug: 1 }, { unique: true });
shopProductSchema.index({ category: 1, status: 1 });
shopProductSchema.index({ name: 'text', description: 'text', brand: 'text' });

export const ShopProduct = mongoose.model<IShopProduct>('ShopProduct', shopProductSchema);
