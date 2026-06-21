import mongoose, { Document } from 'mongoose';
export interface ISoilStandard extends Document {
    soilType: string;
    pH: {
        min: number;
        max: number;
        ideal: string;
    };
    nitrogen: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    phosphorus: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    potassium: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    organicCarbon: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    ec: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    micronutrients: {
        zinc: {
            min: number;
            max: number;
            ideal: string;
        };
        iron: {
            min: number;
            max: number;
            ideal: string;
        };
        manganese: {
            min: number;
            max: number;
            ideal: string;
        };
        copper: {
            min: number;
            max: number;
            ideal: string;
        };
        boron: {
            min: number;
            max: number;
            ideal: string;
        };
    };
    description: string;
    commonCrops: string[];
}
export declare const SoilStandard: mongoose.Model<ISoilStandard, {}, {}, {}, mongoose.Document<unknown, {}, ISoilStandard, {}, {}> & ISoilStandard & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const SOIL_STANDARDS_DATA: {
    soilType: string;
    pH: {
        min: number;
        max: number;
        ideal: string;
    };
    nitrogen: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    phosphorus: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    potassium: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    organicCarbon: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    ec: {
        min: number;
        max: number;
        ideal: string;
        unit: string;
    };
    micronutrients: {
        zinc: {
            min: number;
            max: number;
            ideal: string;
        };
        iron: {
            min: number;
            max: number;
            ideal: string;
        };
        manganese: {
            min: number;
            max: number;
            ideal: string;
        };
        copper: {
            min: number;
            max: number;
            ideal: string;
        };
        boron: {
            min: number;
            max: number;
            ideal: string;
        };
    };
    description: string;
    commonCrops: string[];
}[];
//# sourceMappingURL=SoilStandard.d.ts.map