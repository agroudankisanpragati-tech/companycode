import mongoose, { Document } from 'mongoose';
export interface ISupportRequest extends Document {
    userId?: string;
    name: string;
    email: string;
    phone?: string;
    category: string;
    subject: string;
    message: string;
    attachments: string[];
    status: 'new' | 'in_progress' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
}
export declare const SupportRequest: mongoose.Model<ISupportRequest, {}, {}, {}, mongoose.Document<unknown, {}, ISupportRequest, {}, {}> & ISupportRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SupportRequest.d.ts.map