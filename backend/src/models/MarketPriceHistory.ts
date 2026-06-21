import mongoose, { Schema, Document } from 'mongoose';

export interface IMarketPriceHistory extends Document {
  farmerId: mongoose.Types.ObjectId;
  cropName: string;
  district: string;
  state: string;
  market: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  date: string; // YYYY-MM-DD
}

const schema = new Schema<IMarketPriceHistory>(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cropName: { type: String, required: true },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    market: { type: String, default: '' },
    modalPrice: { type: Number, required: true },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index: one record per farmer+crop+date
schema.index({ farmerId: 1, cropName: 1, date: 1 }, { unique: true });

export const MarketPriceHistory = mongoose.model<IMarketPriceHistory>(
  'MarketPriceHistory',
  schema
);
