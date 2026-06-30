import mongoose, { Document } from 'mongoose';
export interface IFertilizerProduct extends Document {
    shopkeeperId: mongoose.Types.ObjectId;
    productName: string;
    brandName: string;
    category: string;
    productSubCategory: 'seed' | 'fertilizer' | 'pesticide' | 'herbicide' | 'fungicide' | 'micronutrient' | 'bio_fertilizer' | 'growth_regulator' | 'other';
    cropType: string;
    variety: string;
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
export declare const FertilizerProduct: mongoose.Model<IFertilizerProduct, {}, {}, {}, mongoose.Document<unknown, {}, IFertilizerProduct, {}, {}> & IFertilizerProduct & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FertilizerProduct.d.ts.map