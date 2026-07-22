/**
 * AI Chat Service - Hybrid NLP + Rule-Based Conversation Engine
 * Supports Hindi, Marwari, and English
 */

const Scheme = require('../models/Scheme');
const eligibilityEngine = require('./eligibilityEngine');

const INTENTS = {
  GREETING: 'greeting',
  SCHEME_SEARCH: 'scheme_search',
  ELIGIBILITY_CHECK: 'eligibility_check',
  APPLICATION_HELP: 'application_help',
  DOCUMENT_HELP: 'document_help',
  PROFILE_UPDATE: 'profile_update',
  COMPLAINT: 'complaint',
  GENERAL_INFO: 'general_info',
};

const INTENT_PATTERNS = {
  [INTENTS.GREETING]: [/नमस्ते|नमस्कार|खम्मा|राम राम|hello|hi\b|हेलो|प्रणाम/i],
  [INTENTS.SCHEME_SEARCH]: [/योजना|scheme|सरकारी|लाभ|benefit|subsidy|सब्सिडी|अनुदान/i],
  [INTENTS.ELIGIBILITY_CHECK]: [/पात्र|eligible|योग्य|qualify|check eligibility|पात्रता/i],
  [INTENTS.APPLICATION_HELP]: [/आवेदन|apply|application|form|फॉर्म|कैसे करें/i],
  [INTENTS.DOCUMENT_HELP]: [/दस्तावेज़|document|कागज|certificate|प्रमाण पत्र/i],
  [INTENTS.PROFILE_UPDATE]: [/प्रोफाइल|profile|जानकारी|update|अपडेट/i],
};

const RESPONSES = {
  greeting: {
    hi: [
      'खम्मा घणी सा! 🙏 मैं सेवा मित्र हूँ। आपकी क्या सेवा करूँ?',
      'राम राम सा! 🙏 मैं आपको सरकारी योजनाओं की जानकारी देने के लिए यहाँ हूँ।',
      'नमस्ते! 🙏 आज मैं आपकी कैसे मदद कर सकता हूँ?',
    ],
    mr: ['खम्मा घणी सा! म्हारो नाम सेवा मित्र है। आपरी सेवा में हाजर हूँ! 🙏'],
  },
  scheme_search: {
    hi: 'मैं आपके लिए उपयुक्त सरकारी योजनाएं खोज रहा हूँ... 🔍',
  },
  not_understood: {
    hi: 'माफ़ करें, मैं समझ नहीं पाया। क्या आप दोबारा बता सकते हैं? आप हिंदी या मारवाड़ी में बोल सकते हैं।',
  },
};

const SUGGESTIONS = {
  default: [
    'मेरे लिए कौन सी योजनाएं हैं?',
    'किसान योजनाएं दिखाएं',
    'छात्रवृत्ति की जानकारी',
    'आवेदन कैसे करें?',
    'दस्तावेज़ क्या चाहिए?',
  ],
  after_scheme: [
    'इस योजना में आवेदन करें',
    'दस्तावेज़ सूची दिखाएं',
    'पात्रता जांचें',
    'अन्य योजनाएं देखें',
  ],
};

class AIChatService {
  detectIntent(message) {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (patterns.some(p => p.test(message))) return intent;
    }
    return INTENTS.GENERAL_INFO;
  }

  extractEntities(message) {
    const entities = {};
    const categories = {
      farmer: /किसान|kisan|farmer|खेती|agriculture/i,
      student: /छात्र|student|पढ़ाई|scholarship|छात्रवृत्ति/i,
      women: /महिला|women|woman|बेटी|विधवा/i,
      elderly: /बुजुर्ग|elderly|वृद्ध|pension|पेंशन/i,
      disabled: /दिव्यांग|disabled|विकलांग/i,
      housing: /घर|house|आवास|housing/i,
      health: /स्वास्थ्य|health|बीमारी|hospital/i,
    };
    for (const [cat, pattern] of Object.entries(categories)) {
      if (pattern.test(message)) entities.category = cat;
    }
    const districtMatch = message.match(/जयपुर|जोधपुर|उदयपुर|कोटा|बीकानेर|अजमेर|alwar|भरतपुर/i);
    if (districtMatch) entities.district = districtMatch[0];
    return entities;
  }

  async generateResponse(message, citizen, conversationHistory = [], language = 'hi') {
    const intent = this.detectIntent(message);
    const entities = this.extractEntities(message);
    let responseText = '';
    let schemes = [];
    let suggestions = SUGGESTIONS.default;
    let action = null;

    switch (intent) {
      case INTENTS.GREETING:
        const greetings = RESPONSES.greeting[language] || RESPONSES.greeting.hi;
        responseText = greetings[Math.floor(Math.random() * greetings.length)];
        break;

      case INTENTS.SCHEME_SEARCH:
        responseText = RESPONSES.scheme_search.hi;
        const query = {};
        if (entities.category) query.category = entities.category;
        query.isActive = true;
        schemes = await Scheme.find(query).limit(5).select('name nameHindi category benefits.description');
        if (schemes.length > 0) {
          responseText = `मुझे आपके लिए ${schemes.length} योजनाएं मिली हैं:\n\n`;
          schemes.forEach((s, i) => {
            responseText += `${i + 1}. **${s.nameHindi}** - ${s.benefits?.description || ''}\n`;
          });
          responseText += '\nकिसी भी योजना के बारे में अधिक जानकारी के लिए उसका नाम बताएं।';
          suggestions = SUGGESTIONS.after_scheme;
          action = 'show_schemes';
        } else {
          responseText = 'अभी इस श्रेणी में कोई योजना उपलब्ध नहीं है। कृपया अन्य श्रेणी आज़माएं।';
        }
        break;

      case INTENTS.ELIGIBILITY_CHECK:
        if (citizen && citizen.profile) {
          const allSchemes = await Scheme.find({ isActive: true }).limit(20);
          const results = eligibilityEngine.evaluateAll(citizen, allSchemes);
          const eligible = results.filter(r => r.isEligible).slice(0, 3);
          if (eligible.length > 0) {
            responseText = `🎉 आप ${eligible.length} योजनाओं के लिए पात्र हैं:\n\n`;
            eligible.forEach((r, i) => {
              responseText += `${i + 1}. **${r.schemeNameHindi}** - ${r.score}% पात्रता\n`;
            });
            action = 'show_eligibility';
          } else {
            responseText = 'आपकी प्रोफाइल के अनुसार अभी कोई योजना नहीं मिली। कृपया अपनी प्रोफाइल पूरी करें।';
            action = 'complete_profile';
          }
        } else {
          responseText = 'पात्रता जांचने के लिए पहले अपनी प्रोफाइल पूरी करें। 📝';
          action = 'complete_profile';
        }
        break;

      case INTENTS.APPLICATION_HELP:
        responseText = 'आवेदन करने के लिए:\n1. अपनी प्रोफाइल पूरी करें\n2. योजना चुनें\n3. दस्तावेज़ अपलोड करें\n4. फॉर्म भरें\n5. सबमिट करें\n\nक्या आप किसी विशेष योजना में आवेदन करना चाहते हैं?';
        action = 'start_application';
        break;

      case INTENTS.DOCUMENT_HELP:
        responseText = 'सामान्यतः आवश्यक दस्तावेज़:\n• आधार कार्ड\n• जन आधार कार्ड\n• आय प्रमाण पत्र\n• जाति प्रमाण पत्र\n• निवास प्रमाण पत्र\n• बैंक पासबुक\n• पासपोर्ट साइज़ फोटो\n\nकिस योजना के दस्तावेज़ चाहिए?';
        break;

      default:
        if (message.length > 3) {
          const searchSchemes = await Scheme.find(
            { $text: { $search: message } },
            { score: { $meta: 'textScore' } }
          ).sort({ score: { $meta: 'textScore' } }).limit(3);

          if (searchSchemes.length > 0) {
            responseText = `"${message}" से संबंधित योजनाएं:\n\n`;
            searchSchemes.forEach((s, i) => {
              responseText += `${i + 1}. **${s.nameHindi}**\n`;
            });
            schemes = searchSchemes;
            action = 'show_schemes';
          } else {
            responseText = RESPONSES.not_understood.hi;
          }
        } else {
          responseText = RESPONSES.not_understood.hi;
        }
    }

    return {
      message: responseText,
      intent,
      entities,
      schemes: schemes.map(s => ({ id: s._id, name: s.name, nameHindi: s.nameHindi })),
      suggestions,
      action,
      language,
    };
  }
}

module.exports = new AIChatService();
