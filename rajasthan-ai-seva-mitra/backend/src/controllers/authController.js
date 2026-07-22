const jwt = require('jsonwebtoken');
const Citizen = require('../models/Citizen');
const { AuditLog } = require('../models/VoiceLog');
const logger = require('../utils/logger');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const sendTokenResponse = (citizen, statusCode, res) => {
  const token = signToken(citizen._id);
  citizen.password = undefined;
  res.status(statusCode).json({ success: true, token, data: citizen });
};

exports.register = async (req, res) => {
  try {
    const { name, phone, password, email } = req.body;
    const existing = await Citizen.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, message: 'इस नंबर से पहले से खाता है' });
    const citizen = await Citizen.create({ name, phone, password, email });
    await AuditLog.create({ user: citizen._id, userType: 'citizen', action: 'REGISTER', resource: 'auth', success: true });
    sendTokenResponse(citizen, 201, res);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'पंजीकरण में त्रुटि हुई' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const citizen = await Citizen.findOne({ phone }).select('+password');
    if (!citizen || !(await citizen.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'गलत फ़ोन नंबर या पासवर्ड' });
    }
    citizen.lastLogin = new Date();
    citizen.loginCount += 1;
    await citizen.save({ validateBeforeSave: false });
    await AuditLog.create({ user: citizen._id, userType: 'citizen', action: 'LOGIN', resource: 'auth', success: true });
    sendTokenResponse(citizen, 200, res);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'लॉगिन में त्रुटि हुई' });
  }
};

exports.getMe = async (req, res) => {
  const citizen = await Citizen.findById(req.user.id).populate('bookmarkedSchemes', 'name nameHindi category');
  res.json({ success: true, data: citizen });
};

exports.updateProfile = async (req, res) => {
  try {
    const citizen = await Citizen.findById(req.user.id);
    if (req.body.profile) {
      citizen.profile = { ...citizen.profile.toObject?.() || citizen.profile, ...req.body.profile };
      citizen.calculateProfileCompleteness();
    }
    if (req.body.preferredLanguage) citizen.preferredLanguage = req.body.preferredLanguage;
    await citizen.save();
    res.json({ success: true, data: citizen, message: 'प्रोफाइल अपडेट हो गई' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'प्रोफाइल अपडेट में त्रुटि' });
  }
};

exports.bookmarkScheme = async (req, res) => {
  try {
    const citizen = await Citizen.findById(req.user.id);
    const { schemeId } = req.params;
    const idx = citizen.bookmarkedSchemes.indexOf(schemeId);
    if (idx > -1) {
      citizen.bookmarkedSchemes.splice(idx, 1);
    } else {
      citizen.bookmarkedSchemes.push(schemeId);
    }
    await citizen.save();
    res.json({ success: true, bookmarked: idx === -1, message: idx === -1 ? 'बुकमार्क हो गया' : 'बुकमार्क हटाया गया' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};
