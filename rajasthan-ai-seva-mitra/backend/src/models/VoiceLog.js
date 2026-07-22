const mongoose = require('mongoose');

const voiceLogSchema = new mongoose.Schema({
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'Citizen' },
  sessionId: { type: String, required: true },
  language: { type: String, default: 'hi' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    contentHindi: String,
    isVoice: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    intent: String,
    entities: mongoose.Schema.Types.Mixed,
  }],
  schemesRecommended: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' }],
  district: String,
  deviceType: String,
  platform: { type: String, enum: ['web', 'whatsapp', 'mobile', 'emitra'], default: 'web' },
  resolved: { type: Boolean, default: false },
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'Citizen', required: true },
  title: String,
  titleHindi: String,
  message: String,
  messageHindi: String,
  type: { type: String, enum: ['scheme', 'application', 'document', 'deadline', 'system'] },
  isRead: { type: Boolean, default: false },
  link: String,
  scheme: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
}, { timestamps: true });

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId },
  userType: { type: String, enum: ['citizen', 'admin', 'system'] },
  action: String,
  resource: String,
  resourceId: String,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  success: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = {
  VoiceLog: mongoose.model('VoiceLog', voiceLogSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
};
