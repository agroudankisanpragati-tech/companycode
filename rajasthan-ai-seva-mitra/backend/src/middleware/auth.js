const jwt = require('jsonwebtoken');
const Citizen = require('../models/Citizen');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'कृपया लॉगिन करें' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const citizen = await Citizen.findById(decoded.id);
    if (!citizen || !citizen.isActive) return res.status(401).json({ success: false, message: 'अमान्य टोकन' });

    req.user = citizen;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'अमान्य टोकन' });
  }
};

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await Citizen.findById(decoded.id);
    }
    next();
  } catch {
    next();
  }
};

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'आपको यह करने की अनुमति नहीं है' });
  }
  next();
};
