import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface ISchemeApplication extends Document {
    phone: string;
    pinHash: string;
    schemeId: string;
    schemeTitle: string;
    receiptNumber: string;
    applyData: {
        bankAccount: string;
        ifsc: string;
        mutationNumber?: string;
        phone: string;
    };
    profile: {
        name: string;
        occupation: string;
        ageGroup: string;
        incomeRange: string;
        stateName: string;
        district: string;
        category: string;
        land: string;
    };
    status: 'submitted' | 'under_review' | 'approved' | 'rejected';
    submittedAt: Date;
    verifyPin(pin: string): Promise<boolean>;
}

const SchemeApplicationSchema = new Schema<ISchemeApplication>(
    {
        phone:         { type: String, required: true, index: true },
        pinHash:       { type: String, required: true },
        schemeId:      { type: String, required: true },
        schemeTitle:   { type: String, required: true },
        receiptNumber: { type: String, required: true, unique: true },
        applyData: {
            bankAccount:    { type: String, default: '' },
            ifsc:           { type: String, default: '' },
            mutationNumber: { type: String, default: '' },
            phone:          { type: String, default: '' },
        },
        profile: {
            name:       { type: String, default: '' },
            occupation: { type: String, default: '' },
            ageGroup:   { type: String, default: '' },
            incomeRange:{ type: String, default: '' },
            stateName:  { type: String, default: '' },
            district:   { type: String, default: '' },
            category:   { type: String, default: '' },
            land:       { type: String, default: '' },
        },
        status:      { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted' },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

SchemeApplicationSchema.methods.verifyPin = async function (pin: string): Promise<boolean> {
    return bcrypt.compare(pin, this.pinHash);
};

export const SchemeApplication = mongoose.model<ISchemeApplication>('SchemeApplication', SchemeApplicationSchema);
