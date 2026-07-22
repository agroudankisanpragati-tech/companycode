const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const citizenSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true, lowercase: true },
  password: { type: String, required: true, select: false },
  janAadhaarId: { type: String, sparse: true },
  ssoId: { type: String, sparse: true },
  profile: {
    age: Number,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: Date,
    category: { type: String, enum: ['general', 'obc', 'sc', 'st', 'ews'] },
    religion: String,
    maritalStatus: { type: String, enum: ['single', 'married', 'widowed', 'divorced'] },
    annualIncome: Number,
    occupation: {
      type: String,
      enum: ['farmer', 'laborer', 'self_employed', 'government', 'private', 'unemployed', 'student', 'homemaker'],
    },
    education: {
      type: String,
      enum: ['illiterate', 'primary', 'secondary', 'higher_secondary', 'graduate', 'postgraduate'],
    },
    district: String,
    tehsil: String,
    village: String,
    pincode: String,
    isDisabled: { type: Boolean, default: false },
    disabilityType: String,
    disabilityPercentage: Number,
    isStudent: { type: Boolean, default: false },
    landOwnership: { type: Number, default: 0 },
    hasRationCard: { type: Boolean, default: false },
    rationCardType: { type: String, enum: ['apl', 'bpl', 'antyodaya'] },
    isBPL: { type: Boolean, default: false },
    familySize: Number,
    isMinority: { type: Boolean, default: false },
    isWidow: { type: Boolean, default: false },
    isSingleWoman: { type: Boolean, default: false },
  },
  profileCompleteness: { type: Number, default: 0 },
  preferredLanguage: { type: String, default: 'hi', enum: ['hi', 'mr', 'en'] },
  bookmarkedSchemes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' }],
  role: { type: String, default: 'citizen', enum: ['citizen', 'admin', 'operator'] },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
}, { timestamps: true });

citizenSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

citizenSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

citizenSchema.methods.calculateProfileCompleteness = function () {
  const fields = ['age', 'gender', 'category', 'annualIncome', 'occupation', 'education', 'district'];
  const filled = fields.filter(f => this.profile[f] !== undefined && this.profile[f] !== null).length;
  this.profileCompleteness = Math.round((filled / fields.length) * 100);
};

module.exports = mongoose.model('Citizen', citizenSchema);
