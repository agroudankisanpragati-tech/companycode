import mongoose, { Schema, Document } from 'mongoose';

export interface ISoilReport extends Document {
  farmerId: string;
  reportUrl?: string;
  uploadDate: Date;
  soilType?: string;
  pH?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  organicCarbon?: number;
  ec?: number;
  micronutrients?: {
    zinc?: number;
    iron?: number;
    manganese?: number;
    copper?: number;
    boron?: number;
  };
  soilHealthScore?: number;
  soilHealthStatus?: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
  deficiencies?: Array<{
    nutrient: string;
    type: 'Low' | 'Excess' | 'Imbalance';
    severity: 'Low' | 'Medium' | 'High';
    description: string;
  }>;
  benchmarkComparison?: Array<{
    parameter: string;
    farmerValue: number | string;
    idealValue: string;
    status: 'Optimal' | 'Low' | 'High' | 'Deficient';
  }>;
  recommendations?: {
    organic: string[];
    fertilizer: string[];
    reasoning: string;
  };
  cropRecommendations?: Array<{
    cropName: string;
    suitabilityScore: number;
    expectedBenefits: string;
    reason: string;
  }>;
  aiAnalysis?: string;
  translations?: Record<string, Record<string, any>>;
  createdAt: Date;
  updatedAt: Date;
}

const soilReportSchema = new Schema<ISoilReport>(
  {
    farmerId: { type: String, required: true, index: true },
    reportUrl: { type: String },
    uploadDate: { type: Date, default: Date.now },
    soilType: { type: String },
    pH: { type: Number },
    nitrogen: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    organicCarbon: { type: Number },
    ec: { type: Number },
    micronutrients: {
      zinc: Number,
      iron: Number,
      manganese: Number,
      copper: Number,
      boron: Number,
    },
    soilHealthScore: { type: Number, min: 0, max: 100 },
    soilHealthStatus: {
      type: String,
      enum: ['Excellent', 'Good', 'Moderate', 'Poor', 'Critical'],
    },
    deficiencies: [
      {
        nutrient: String,
        type: { type: String, enum: ['Low', 'Excess', 'Imbalance'] },
        severity: { type: String, enum: ['Low', 'Medium', 'High'] },
        description: String,
      },
    ],
    benchmarkComparison: [
      {
        parameter: String,
        farmerValue: Schema.Types.Mixed,
        idealValue: String,
        status: { type: String, enum: ['Optimal', 'Low', 'High', 'Deficient'] },
      },
    ],
    recommendations: {
      organic: [String],
      fertilizer: [String],
      reasoning: String,
    },
    cropRecommendations: [
      {
        cropName: String,
        suitabilityScore: Number,
        expectedBenefits: String,
        reason: String,
      },
    ],
    aiAnalysis: { type: String },
    translations: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const SoilReport = mongoose.model<ISoilReport>('SoilReport', soilReportSchema);
