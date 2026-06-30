import mongoose, { Document } from 'mongoose';
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
export declare const NurseryProduct: mongoose.Model<INurseryProduct, {}, {}, {}, mongoose.Document<unknown, {}, INurseryProduct, {}, {}> & INurseryProduct & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=NurseryProduct.d.ts.map