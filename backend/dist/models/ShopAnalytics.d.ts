import mongoose, { Document } from 'mongoose';
export interface IShopAnalytics extends Document {
    shopId: mongoose.Types.ObjectId;
    date: string;
    views: number;
    uniqueVisitors: number;
    phoneClicks: number;
    whatsappClicks: number;
    productViews: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ShopAnalytics: mongoose.Model<IShopAnalytics, {}, {}, {}, mongoose.Document<unknown, {}, IShopAnalytics, {}, {}> & IShopAnalytics & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ShopAnalytics.d.ts.map