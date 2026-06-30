import mongoose, { Document } from 'mongoose';
export interface IShopGallery extends Document {
    shopId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;
    url: string;
    caption?: string;
    order: number;
    createdAt: Date;
}
export declare const ShopGallery: mongoose.Model<IShopGallery, {}, {}, {}, mongoose.Document<unknown, {}, IShopGallery, {}, {}> & IShopGallery & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ShopGallery.d.ts.map