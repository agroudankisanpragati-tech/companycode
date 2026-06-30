import mongoose, { Schema, Document } from 'mongoose';

export interface IShopAnalytics extends Document {
  shopId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  views: number;
  uniqueVisitors: number;
  phoneClicks: number;
  whatsappClicks: number;
  productViews: number;
  createdAt: Date;
  updatedAt: Date;
}

const shopAnalyticsSchema = new Schema<IShopAnalytics>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    views: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    phoneClicks: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    productViews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

shopAnalyticsSchema.index({ shopId: 1, date: 1 }, { unique: true });

export const ShopAnalytics = mongoose.model<IShopAnalytics>('ShopAnalytics', shopAnalyticsSchema);
