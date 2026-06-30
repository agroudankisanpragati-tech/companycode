import mongoose, { Schema, Document } from 'mongoose';

export interface IShopGallery extends Document {
  shopId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  url: string;
  caption?: string;
  order: number;
  createdAt: Date;
}

const shopGallerySchema = new Schema<IShopGallery>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true },
    caption: String,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ShopGallery = mongoose.model<IShopGallery>('ShopGallery', shopGallerySchema);
