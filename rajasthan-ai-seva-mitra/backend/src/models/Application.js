const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationNumber: { type: String, unique: true, required: true },
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'Citizen', required: true },
  scheme: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'pending_documents'],
    default: 'draft',
  },
  currentStep: { type: Number, default: 1 },
  totalSteps: { type: Number, default: 5 },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  documents: [{
    documentType: String,
    fileName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String,
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  eligibilityScore: Number,
  eligibilityReason: String,
  reviewNotes: String,
  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  receiptGenerated: { type: Boolean, default: false },
  receiptPath: String,
  qrCode: String,
  timeline: [{
    status: String,
    message: String,
    messageHindi: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: String,
  }],
}, { timestamps: true });

applicationSchema.pre('save', function (next) {
  if (!this.applicationNumber) {
    this.applicationNumber = `RJ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema);
