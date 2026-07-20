import mongoose, { Document } from 'mongoose';
export type DictionaryCategory = 'crops' | 'diseases' | 'pests' | 'fertilizers' | 'soil' | 'weather' | 'government' | 'agriculture' | 'ui';
export interface ILanguageDictionary extends Document {
    normalizedKey: string;
    english: string;
    hindi: string;
    marwari?: string;
    mewari?: string;
    dhundhari?: string;
    hadoti?: string;
    shekhawati?: string;
    bagri?: string;
    wagdi?: string;
    mewati?: string;
    godwari?: string;
    ahirwati?: string;
    malvi?: string;
    category: DictionaryCategory;
    aliases: string[];
    confidence: number;
    approved: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const LanguageDictionary: mongoose.Model<ILanguageDictionary, {}, {}, {}, mongoose.Document<unknown, {}, ILanguageDictionary, {}, {}> & ILanguageDictionary & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=LanguageDictionary.d.ts.map