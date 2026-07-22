const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema({
  schemeId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  nameHindi: { type: String, required: true },
  description: String,
  descriptionHindi: String,
  category: {
    type: String,
    enum: ['agriculture', 'education', 'health', 'housing', 'employment', 'women', 'disability', 'elderly', 'youth', 'minority', 'social_security'],
    required: true,
  },
  level: { type: String, enum: ['central', 'state', 'district'], default: 'state' },
  department: String,
  departmentHindi: String,
  benefits: {
    type: { type: String, enum: ['financial', 'material', 'service', 'scholarship', 'loan', 'subsidy'] },
    amount: Number,
    description: String,
    descriptionHindi: String,
  },
  eligibility: {
    minAge: Number,
    maxAge: Number,
    gender: [{ type: String, enum: ['male', 'female', 'other', 'all'] }],
    categories: [{ type: String, enum: ['general', 'obc', 'sc', 'st', 'ews', 'all'] }],
    maxAnnualIncome: Number,
    occupations: [String],
    educationRequired: String,
    mustBeDisabled: Boolean,
    mustBeStudent: Boolean,
    mustBeBPL: Boolean,
    mustBeWidow: Boolean,
    mustBeFarmer: Boolean,
    districts: [String],
    minLandOwnership: Number,
    maxLandOwnership: Number,
    customRules: [String],
  },
  documents: [{
    name: String,
    nameHindi: String,
    mandatory: { type: Boolean, default: true },
    description: String,
  }],
  applicationProcess: {
    mode: [{ type: String, enum: ['online', 'offline', 'emitra', 'csc'] }],
    steps: [{ step: Number, description: String, descriptionHindi: String }],
    officialLink: String,
    eMitraServiceCode: String,
  },
  deadline: Date,
  launchDate: Date,
  isActive: { type: Boolean, default: true },
  tags: [String],
  faqs: [{ question: String, questionHindi: String, answer: String, answerHindi: String }],
  statistics: {
    totalApplicants: { type: Number, default: 0 },
    totalApproved: { type: Number, default: 0 },
    totalBeneficiaries: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
  },
  aiMetadata: {
    keywords: [String],
    embedding: [Number],
    popularityScore: { type: Number, default: 0 },
  },
}, { timestamps: true });

schemeSchema.index({ name: 'text', nameHindi: 'text', tags: 'text', 'aiMetadata.keywords': 'text' });
schemeSchema.index({ category: 1, level: 1, isActive: 1 });

module.exports = mongoose.model('Scheme', schemeSchema);
