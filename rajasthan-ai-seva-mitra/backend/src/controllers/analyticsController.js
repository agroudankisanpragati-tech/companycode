const Citizen = require('../models/Citizen');
const Scheme = require('../models/Scheme');
const Application = require('../models/Application');
const { VoiceLog } = require('../models/VoiceLog');

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalCitizens, totalSchemes, totalApplications,
      approvedApplications, pendingApplications, rejectedApplications,
      voiceSessions, recentApplications, popularSchemes, districtStats,
    ] = await Promise.all([
      Citizen.countDocuments({ role: 'citizen' }),
      Scheme.countDocuments({ isActive: true }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'approved' }),
      Application.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Application.countDocuments({ status: 'rejected' }),
      VoiceLog.countDocuments(),
      Application.find().populate('citizen', 'name profile.district').populate('scheme', 'nameHindi').sort({ createdAt: -1 }).limit(10),
      Scheme.find({ isActive: true }).sort({ 'statistics.viewCount': -1 }).limit(5).select('name nameHindi statistics category'),
      Application.aggregate([
        { $lookup: { from: 'citizens', localField: 'citizen', foreignField: '_id', as: 'citizenData' } },
        { $unwind: '$citizenData' },
        { $group: { _id: '$citizenData.profile.district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const monthlyData = await Application.aggregate([
      { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    const categoryStats = await Application.aggregate([
      { $lookup: { from: 'schemes', localField: 'scheme', foreignField: '_id', as: 'schemeData' } },
      { $unwind: '$schemeData' },
      { $group: { _id: '$schemeData.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalCitizens,
          totalSchemes,
          totalApplications,
          approvedApplications,
          pendingApplications,
          rejectedApplications,
          voiceSessions,
          approvalRate: totalApplications > 0 ? Math.round((approvedApplications / totalApplications) * 100) : 0,
        },
        recentApplications,
        popularSchemes,
        districtStats,
        monthlyData,
        categoryStats,
        aiInsights: [
          { insight: `${districtStats[0]?._id || 'जयपुर'} जिले से सबसे अधिक आवेदन`, type: 'info' },
          { insight: `${popularSchemes[0]?.nameHindi || 'पालनहार योजना'} सबसे लोकप्रिय योजना`, type: 'success' },
          { insight: `${Math.round((approvedApplications / Math.max(totalApplications, 1)) * 100)}% आवेदन स्वीकृत`, type: 'success' },
          { insight: `${voiceSessions} वॉइस सत्र पूर्ण`, type: 'info' },
        ],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'डैशबोर्ड लोड करने में त्रुटि' });
  }
};
