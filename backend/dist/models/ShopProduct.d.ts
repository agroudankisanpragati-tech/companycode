import mongoose, { Document } from 'mongoose';
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
    dimensions?: {
        length?: number;
        width?: number;
        height?: number;
    };
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    totalViews: number;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ShopProduct: mongoose.Model<IShopProduct, {}, {}, {}, mongoose.Document<unknown, {}, IShopProduct, {}, {}> & IShopProduct & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ShopProduct.d.ts.map