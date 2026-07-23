import mongoose, { Document, Schema } from 'mongoose';

export interface ISevaMitraProfile extends Document {
    phone: string;
    language: string;
    name: string;
    occupation: string;
    ageGroup: string;
    incomeRange: string;
    stateType: string;
    stateName: string;
    district: string;
    category: string;
    land: string;
    savedAt: Date;
}

const SevaMitraProfileSchema = new Schema<ISevaMitraProfile>(
    {
        phone:      { type: String, required: true, unique: true, index: true },
        language:   { type: String, default: 'hi' },
        name:       { type: String, default: '' },
        occupation: { type: String, default: 'farmer' },
        ageGroup:   { type: String, default: '18to60' },
        incomeRange:{ type: String, default: '1lto5l' },
        stateType:  { type: String, default: 'Rajasthan' },
        stateName:  { type: String, default: 'Rajasthan' },
        district:   { type: String, default: 'Jaipur' },
        category:   { type: String, default: 'obc' },
        land:       { type: String, default: '0' },
        savedAt:    { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const SevaMitraProfile = mongoose.model<ISevaMitraProfile>('SevaMitraProfile', SevaMitraProfileSchema);
