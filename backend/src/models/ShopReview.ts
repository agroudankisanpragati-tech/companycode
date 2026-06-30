import mongoose, { Schema, Document } from 'mongoose';

export interface IShopReview extends Document {
  shopId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  rating: number;
  comment: string;
  reply?: string;
  repliedAt?: Date;
  status: 'active' | 'reported' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const shopReviewSchema = new Schema<IShopReview>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    reply: String,
    repliedAt: Date,
    status: { type: String, enum: ['active', 'reported', 'deleted'], default: 'active' },
  },
  { timestamps: true }
);

shopReviewSchema.index({ shopId: 1, userId: 1 });

export const ShopReview = mongoose.model<IShopReview>('ShopReview', shopReviewSchema);
