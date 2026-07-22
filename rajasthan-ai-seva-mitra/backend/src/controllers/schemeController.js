const Scheme = require('../models/Scheme');
const eligibilityEngine = require('../services/eligibilityEngine');
const logger = require('../utils/logger');

exports.getSchemes = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, level, search, district } = req.query;
    const query = { isActive: true };
    if (category) query.category = category;
    if (level) query.level = level;
    if (search) query.$text = { $search: search };
    const skip = (page - 1) * limit;
    const [schemes, total] = await Promise.all([
      Scheme.find(query).skip(skip).limit(Number(limit)).sort({ 'aiMetadata.popularityScore': -1, createdAt: -1 }),
      Scheme.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: schemes,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'योजनाएं लोड करने में त्रुटि' });
  }
};

exports.getScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: 'योजना नहीं मिली' });
    scheme.statistics.viewCount += 1;
    await scheme.save({ validateBeforeSave: false });
    res.json({ success: true, data: scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};

exports.checkEligibility = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: 'योजना नहीं मिली' });
    const citizen = req.user;
    const result = eligibilityEngine.evaluate(citizen, scheme);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'पात्रता जांच में त्रुटि' });
  }
};

exports.getRecommendedSchemes = async (req, res) => {
  try {
    const citizen = req.user;
    const schemes = await Scheme.find({ isActive: true });
    const results = eligibilityEngine.evaluateAll(citizen, schemes);
    const eligible = results.filter(r => r.score >= 50).slice(0, 10);
    res.json({ success: true, data: eligible, total: eligible.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुशंसाएं लोड करने में त्रुटि' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Scheme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};

exports.createScheme = async (req, res) => {
  try {
    const scheme = await Scheme.create(req.body);
    res.status(201).json({ success: true, data: scheme, message: 'योजना बनाई गई' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'योजना बनाने में त्रुटि' });
  }
};

exports.updateScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!scheme) return res.status(404).json({ success: false, message: 'योजना नहीं मिली' });
    res.json({ success: true, data: scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अपडेट में त्रुटि' });
  }
};

exports.deleteScheme = async (req, res) => {
  try {
    await Scheme.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'योजना निष्क्रिय की गई' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};
