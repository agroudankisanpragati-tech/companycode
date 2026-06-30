import mongoose, { Document } from 'mongoose';
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
export declare const ShopReview: mongoose.Model<IShopReview, {}, {}, {}, mongoose.Document<unknown, {}, IShopReview, {}, {}> & IShopReview & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ShopReview.d.ts.map