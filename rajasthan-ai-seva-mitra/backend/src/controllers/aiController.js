const aiChatService = require('../services/aiChatService');
const { VoiceLog } = require('../models/VoiceLog');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

exports.chat = async (req, res) => {
  try {
    const { message, sessionId, language = 'hi', conversationHistory = [] } = req.body;
    const citizen = req.user || null;
    const sid = sessionId || uuidv4();

    const response = await aiChatService.generateResponse(message, citizen, conversationHistory, language);

    // Save to voice log
    let voiceLog = await VoiceLog.findOne({ sessionId: sid });
    if (!voiceLog) {
      voiceLog = new VoiceLog({
        sessionId: sid,
        citizen: citizen?._id,
        language,
        platform: 'web',
        district: citizen?.profile?.district,
      });
    }
    voiceLog.messages.push(
      { role: 'user', content: message, isVoice: req.body.isVoice || false },
      { role: 'assistant', content: response.message, intent: response.intent }
    );
    if (response.schemes?.length) {
      voiceLog.schemesRecommended.push(...response.schemes.map(s => s.id).filter(Boolean));
    }
    await voiceLog.save();

    res.json({ success: true, data: { ...response, sessionId: sid } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: 'AI सेवा में त्रुटि हुई' });
  }
};

exports.getConversationHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const log = await VoiceLog.findOne({ sessionId }).populate('schemesRecommended', 'name nameHindi');
    if (!log) return res.json({ success: true, data: { messages: [] } });
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'त्रुटि हुई' });
  }
};

exports.getSuggestions = async (req, res) => {
  const suggestions = [
    'मेरे लिए कौन सी योजनाएं हैं?',
    'किसान योजनाएं दिखाएं',
    'छात्रवृत्ति की जानकारी',
    'महिला योजनाएं',
    'आवास योजना',
    'स्वास्थ्य बीमा',
    'पेंशन योजना',
    'रोजगार योजनाएं',
  ];
  res.json({ success: true, data: suggestions });
};
