import mongoose, { Document } from 'mongoose';
export interface IMarketPriceHistory extends Document {
    farmerId: mongoose.Types.ObjectId;
    cropName: string;
    district: string;
    state: string;
    market: string;
    modalPrice: number;
    minPrice: number;
    maxPrice: number;
    date: string;
}
export declare const MarketPriceHistory: mongoose.Model<IMarketPriceHistory, {}, {}, {}, mongoose.Document<unknown, {}, IMarketPriceHistory, {}, {}> & IMarketPriceHistory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=MarketPriceHistory.d.ts.map