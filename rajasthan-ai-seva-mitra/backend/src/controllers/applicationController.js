const Application = require('../models/Application');
const Scheme = require('../models/Scheme');
const eligibilityEngine = require('../services/eligibilityEngine');
const logger = require('../utils/logger');

exports.createApplication = async (req, res) => {
  try {
    const { schemeId } = req.body;
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) return res.status(404).json({ success: false, message: 'योजना नहीं मिली' });

    const eligibility = eligibilityEngine.evaluate(req.user, scheme);

    const existing = await Application.findOne({ citizen: req.user._id, scheme: schemeId, status: { $in: ['draft', 'submitted'] } });
    if (existing) return res.status(400).json({ success: false, message: 'आपने पहले से इस योजना में आवेदन किया है', data: existing });

    const application = await Application.create({
      citizen: req.user._id,
      scheme: schemeId,
      eligibilityScore: eligibility.score,
      eligibilityReason: eligibility.summary?.hi,
      totalSteps: scheme.applicationProcess?.steps?.length || 5,
      timeline: [{ status: 'draft', message: 'Application started', messageHindi: 'आवेदन शुरू किया गया' }],
    });

    scheme.statistics.totalApplicants += 1;
    await scheme.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, data: application, eligibility });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'आवेदन बनाने में त्रुटि' });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ citizen: req.user._id })
      .populate('scheme', 'name nameHindi category benefits department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications, total: applications.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};

exports.getApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, citizen: req.user._id })
      .populate('scheme');
    if (!application) return res.status(404).json({ success: false, message: 'आवेदन नहीं मिला' });
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};

exports.updateApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, citizen: req.user._id });
    if (!application) return res.status(404).json({ success: false, message: 'आवेदन नहीं मिला' });
    if (application.status === 'submitted') return res.status(400).json({ success: false, message: 'सबमिट किया गया आवेदन बदला नहीं जा सकता' });

    if (req.body.formData) application.formData = { ...application.formData, ...req.body.formData };
    if (req.body.currentStep) application.currentStep = req.body.currentStep;
    await application.save();
    res.json({ success: true, data: application });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अपडेट में त्रुटि' });
  }
};

exports.submitApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, citizen: req.user._id }).populate('scheme');
    if (!application) return res.status(404).json({ success: false, message: 'आवेदन नहीं मिला' });

    application.status = 'submitted';
    application.submittedAt = new Date();
    application.receiptGenerated = true;
    application.qrCode = `RJ-QR-${application.applicationNumber}`;
    application.timeline.push({
      status: 'submitted',
      message: 'Application submitted successfully',
      messageHindi: 'आवेदन सफलतापूर्वक जमा किया गया',
    });
    await application.save();

    res.json({
      success: true,
      data: application,
      message: 'आवेदन सफलतापूर्वक जमा किया गया!',
      receipt: {
        applicationNumber: application.applicationNumber,
        submittedAt: application.submittedAt,
        qrCode: application.qrCode,
        schemeName: application.scheme?.nameHindi,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'सबमिट करने में त्रुटि' });
  }
};

exports.getAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, district } = req.query;
    const query = {};
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [applications, total] = await Promise.all([
      Application.find(query).populate('citizen', 'name phone profile.district').populate('scheme', 'name nameHindi').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Application.countDocuments(query),
    ]);
    res.json({ success: true, data: applications, pagination: { page: Number(page), total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};
