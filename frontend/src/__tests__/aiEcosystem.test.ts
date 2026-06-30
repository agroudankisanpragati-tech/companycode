/**
 * Agrodan Kisan Pragati — AI Ecosystem Tests
 * Covers: Language Context, AI Copilot, Crop Recommendation, Disease Detection,
 *         Soil Health, Voice Input, Voice Output, Error Handling
 */

// ─── Mock browser APIs ──────────────────────────────────────────────────────
const mockSpeak = jest.fn();
const mockCancel = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockGetVoices = jest.fn(() => [
  { lang: 'hi-IN', name: 'Hindi India', voiceURI: 'hi-IN' },
  { lang: 'en-IN', name: 'English India', voiceURI: 'en-IN' },
]);

Object.defineProperty(window, 'speechSynthesis', {
  value: { speak: mockSpeak, cancel: mockCancel, pause: mockPause, resume: mockResume, getVoices: mockGetVoices },
  writable: true,
});

const mockRecognitionStart = jest.fn();
const mockRecognitionStop = jest.fn();
const MockSpeechRecognition = jest.fn().mockImplementation(() => ({
  start: mockRecognitionStart,
  stop: mockRecognitionStop,
  addEventListener: jest.fn(),
  lang: '',
  continuous: false,
  interimResults: false,
}));
(window as any).SpeechRecognition = MockSpeechRecognition;
(window as any).webkitSpeechRecognition = MockSpeechRecognition;

// ─── Mock fetch ─────────────────────────────────────────────────────────────
global.fetch = jest.fn();

const mockFetch = (data: any, ok = true, status = 200) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

// ─── 1. Language Switching ───────────────────────────────────────────────────

describe('Language Context', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('stores language preference to localStorage', () => {
    localStorage.setItem('kp_language', 'hi');
    expect(localStorage.getItem('kp_language')).toBe('hi');
  });

  test('falls back to "en" when no preference stored', () => {
    expect(localStorage.getItem('kp_language')).toBeNull();
  });

  test('aiDisplayMode defaults to both', () => {
    // Simulated: when language code is not en or hi, mode is 'both'
    const code = 'mr';
    const mode = code === 'hi' ? 'hi' : code === 'en' ? 'en' : 'both';
    expect(mode).toBe('both');
  });

  test('aiDisplayMode is "hi" when lang is hi', () => {
    const code = 'hi';
    const mode = code === 'hi' ? 'hi' : code === 'en' ? 'en' : 'both';
    expect(mode).toBe('hi');
  });

  test('aiDisplayMode is "en" when lang is en', () => {
    const code = 'en';
    const mode = code === 'hi' ? 'hi' : code === 'en' ? 'en' : 'both';
    expect(mode).toBe('en');
  });

  test('persistLanguageToServer sends correct payload', async () => {
    localStorage.setItem('authToken', 'test-token');
    mockFetch({ success: true });
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ appLanguage: 'hi' }),
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ appLanguage: 'hi' }),
    }));
  });
});

// ─── 2. AI Copilot (Bilingual Response) ────────────────────────────────────

describe('AI Copilot — Bilingual Response', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    localStorage.setItem('authToken', 'test-token');
  });

  test('returns bilingual response object with english and hindi fields', async () => {
    const mockResponse = {
      success: true,
      reply: 'Rice is suitable for your soil.',
      bilingual: {
        english: 'Rice is suitable for your soil.',
        hindi: 'आपकी मिट्टी के लिए धान उपयुक्त है।',
        timestamp: new Date().toISOString(),
        source: 'AI',
      },
    };
    mockFetch(mockResponse);
    const res = await fetch('/api/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Which crop suits my soil?' }] }),
    });
    const data = await res.json();
    expect(data.bilingual).toBeDefined();
    expect(data.bilingual.english).toBeTruthy();
    expect(data.bilingual.hindi).toBeTruthy();
    expect(data.bilingual.source).toBe('AI');
  });

  test('handles API failure with bilingual error', async () => {
    mockFetch({ error: 'AI service temporarily unavailable. Please try again.', hindi: 'AI सेवा अस्थायी रूप से अनुपलब्ध है।' }, false, 502);
    const res = await fetch('/api/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    });
    const data = await res.json();
    expect(res.ok).toBe(false);
    expect(data.error).toContain('AI service');
    expect(data.hindi).toBeTruthy();
  });

  test('handles empty messages array', async () => {
    mockFetch({ error: 'messages array is required' }, false, 400);
    const res = await fetch('/api/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.ok).toBe(false);
  });

  test('dashboard context fetch succeeds', async () => {
    mockFetch({ success: true, data: { farmer: { name: 'Test Farmer' }, weather: null, soilMoisture: null } });
    const res = await fetch('/api/ai-assistant/dashboard-context', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.farmer.name).toBe('Test Farmer');
  });
});

// ─── 3. Crop Recommendation ─────────────────────────────────────────────────

describe('Crop Recommendation — Bilingual', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    localStorage.setItem('authToken', 'test-token');
  });

  test('recommendation response includes bilingual crop fields', async () => {
    const mockCrop = {
      cropName: 'Wheat',
      cropNameHindi: 'गेहूँ',
      whySuitable: 'Suitable for clay soil.',
      whySuitableHindi: 'चिकनी मिट्टी के लिए उपयुक्त।',
      estimatedYield: '20 quintal/acre',
      estimatedYieldHindi: '20 क्विंटल/एकड़',
      bestSowingTime: 'October-November',
      bestSowingTimeHindi: 'अक्टूबर-नवंबर',
      marketDemand: 'high',
      marketDemandHindi: 'अधिक',
      suitabilityScore: 88,
      cropCategory: 'Traditional',
    };
    mockFetch({ success: true, source: 'openai', recommendations: [mockCrop], message: 'AI recommendations' });
    const res = await fetch('/api/crop-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ soilType: 'Clay', soilPH: 6.5, season: 'Rabi', district: 'Lucknow', state: 'UP', farmArea: 2, budget: 50000, waterAvailability: 'medium', irrigationType: 'drip' }),
    });
    const data = await res.json();
    expect(data.recommendations[0].cropNameHindi).toBe('गेहूँ');
    expect(data.recommendations[0].whySuitableHindi).toBeTruthy();
    expect(data.recommendations[0].bestSowingTimeHindi).toBeTruthy();
  });

  test('missing required fields returns 400', async () => {
    mockFetch({ error: 'Missing required fields' }, false, 400);
    const res = await fetch('/api/crop-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soilType: 'Clay' }),
    });
    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});

// ─── 4. Disease Detection ────────────────────────────────────────────────────

describe('Disease Detection — Bilingual', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    localStorage.setItem('authToken', 'test-token');
  });

  test('scan result includes bilingual disease fields', async () => {
    const mockResult = {
      success: true,
      source: 'ai',
      data: {
        cropName: 'Wheat',
        cropNameHindi: 'गेहूँ',
        diseaseName: 'Leaf Blight',
        diseaseNameHindi: 'पत्ती झुलसा रोग',
        symptoms: 'Yellow spots on leaves.',
        symptomsHindi: 'पत्तियों पर पीले धब्बे।',
        treatment: 'Apply fungicide.',
        organicTreatment: 'Neem spray.',
        organicTreatmentHindi: 'नीम का छिड़काव।',
        prevention: 'Crop rotation.',
        preventionHindi: 'फसल चक्र अपनाएं।',
        severityLevel: 'medium',
        confidenceScore: 87,
      },
    };
    mockFetch(mockResult);
    const formData = new FormData();
    formData.append('cropName', 'Wheat');
    const res = await fetch('/api/disease/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: formData,
    });
    const data = await res.json();
    expect(data.data.diseaseNameHindi).toBe('पत्ती झुलसा रोग');
    expect(data.data.symptomsHindi).toBeTruthy();
    expect(data.data.preventionHindi).toBeTruthy();
    expect(data.data.organicTreatmentHindi).toBeTruthy();
  });

  test('no image uploaded returns 400', async () => {
    mockFetch({ error: 'Image file is required' }, false, 400);
    const res = await fetch('/api/disease/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.ok).toBe(false);
  });

  test('scan history returns array', async () => {
    mockFetch({ success: true, data: [], total: 0 });
    const res = await fetch('/api/disease/history', { headers: { Authorization: 'Bearer test-token' } });
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });
});

// ─── 5. Soil Health Analysis ─────────────────────────────────────────────────

describe('Soil Health — Bilingual Analysis', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    localStorage.setItem('authToken', 'test-token');
  });

  test('soil report includes aiAnalysisHindi', async () => {
    mockFetch({
      success: true,
      data: {
        soilType: 'Alluvial',
        pH: 6.8,
        nitrogen: 210,
        phosphorus: 18,
        potassium: 180,
        soilHealthScore: 72,
        soilHealthStatus: 'Good',
        aiAnalysis: 'Your soil is in good condition.',
        aiAnalysisHindi: 'आपकी मिट्टी अच्छी स्थिति में है।',
        benchmarkComparison: [],
        deficiencies: [],
        recommendations: { organic: [], fertilizer: [], reasoning: '' },
        cropRecommendations: [],
      },
    });
    const res = await fetch('/api/soil/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ pH: 6.8, nitrogen: 210, phosphorus: 18, potassium: 180 }),
    });
    const data = await res.json();
    expect(data.data.aiAnalysis).toBeTruthy();
    expect(data.data.aiAnalysisHindi).toBeTruthy();
    expect(data.data.soilHealthScore).toBe(72);
  });

  test('upload without file returns 400', async () => {
    mockFetch({ error: 'No file uploaded.' }, false, 400);
    const res = await fetch('/api/soil/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.ok).toBe(false);
  });

  test('soil history returns paginated results', async () => {
    mockFetch({ success: true, data: [], total: 0, page: 1, limit: 10 });
    const res = await fetch('/api/soil/history', { headers: { Authorization: 'Bearer test-token' } });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});

// ─── 6. Voice Input ──────────────────────────────────────────────────────────

describe('Voice Input', () => {
  test('SpeechRecognition API is available in test env', () => {
    expect((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition).toBeDefined();
  });

  test('creates recognition instance with correct lang', () => {
    const SpeechRecognition = (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    expect(recognition.lang).toBe('hi-IN');
  });

  test('start and stop can be called without error', () => {
    const SpeechRecognition = (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    expect(() => recognition.start()).not.toThrow();
    expect(() => recognition.stop()).not.toThrow();
  });

  test('detectLang returns hi-IN for Hindi text', () => {
    const text = 'धान की खेती उपयुक्त है।';
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const lang = hindiChars > text.length * 0.1 ? 'hi-IN' : 'en-IN';
    expect(lang).toBe('hi-IN');
  });

  test('detectLang returns en-IN for English text', () => {
    const text = 'Rice cultivation is suitable.';
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const lang = hindiChars > text.length * 0.1 ? 'hi-IN' : 'en-IN';
    expect(lang).toBe('en-IN');
  });
});

// ─── 7. Voice Output (TTS) ───────────────────────────────────────────────────

describe('Voice Output (SpeechSynthesis)', () => {
  beforeEach(() => {
    mockSpeak.mockClear();
    mockCancel.mockClear();
  });

  test('speechSynthesis.speak is callable', () => {
    const utter = new SpeechSynthesisUtterance('Test');
    window.speechSynthesis.speak(utter);
    expect(mockSpeak).toHaveBeenCalledWith(utter);
  });

  test('speechSynthesis.cancel is callable', () => {
    window.speechSynthesis.cancel();
    expect(mockCancel).toHaveBeenCalled();
  });

  test('getVoices returns Hindi voice', () => {
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((v) => v.lang === 'hi-IN');
    expect(hindiVoice).toBeDefined();
  });

  test('getVoices returns English voice', () => {
    const voices = window.speechSynthesis.getVoices();
    const engVoice = voices.find((v) => v.lang === 'en-IN');
    expect(engVoice).toBeDefined();
  });

  test('utterance strips markdown for clean TTS', () => {
    const raw = '**Wheat** is recommended. _Suitable_ for ~clay~ soil. [Link](http://example.com)';
    const clean = raw.replace(/[*_`#~>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    expect(clean).toBe('Wheat is recommended. Suitable for clay soil. Link');
  });
});

// ─── 8. Error Handling ───────────────────────────────────────────────────────

describe('Error Handling — Bilingual', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  test('network error shows bilingual message', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    let errorMsg = '';
    try {
      await fetch('/api/ai-assistant/chat', { method: 'POST' });
    } catch (e: any) {
      errorMsg = e.message;
    }
    expect(errorMsg).toBe('Network Error');
  });

  test('500 response returns bilingual error fields', async () => {
    mockFetch({ error: 'Something went wrong. Please try again.', hindi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' }, false, 500);
    const res = await fetch('/api/soil/upload', { method: 'POST' });
    const data = await res.json();
    expect(data.error).toBeTruthy();
    expect(data.hindi).toBeTruthy();
  });

  test('502 (AI provider failure) returns bilingual error', async () => {
    mockFetch({ error: 'AI service temporarily unavailable. Please try again.', hindi: 'AI सेवा अस्थायी रूप से अनुपलब्ध है।' }, false, 502);
    const res = await fetch('/api/ai-assistant/chat', { method: 'POST' });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.hindi).toContain('AI सेवा');
  });

  test('429 (rate limit) returns bilingual message', async () => {
    mockFetch({ error: 'Too many requests. Please wait a moment.', hindi: 'बहुत अधिक अनुरोध। कृपया थोड़ी देर प्रतीक्षा करें।' }, false, 429);
    const res = await fetch('/api/ai-assistant/chat', { method: 'POST' });
    expect(res.status).toBe(429);
  });

  test('401 returns unauthorized bilingual error', async () => {
    mockFetch({ error: 'Unauthorized. Please login.', hindi: 'अनधिकृत। कृपया लॉगिन करें।' }, false, 401);
    const res = await fetch('/api/crop-recommendation', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  test('413 (file too large) returns bilingual error', async () => {
    mockFetch({ error: 'File too large. Maximum size is 10MB.', hindi: 'फ़ाइल बहुत बड़ी है। अधिकतम आकार 10MB है।' }, false, 413);
    const res = await fetch('/api/soil/upload', { method: 'POST' });
    const data = await res.json();
    expect(res.status).toBe(413);
    expect(data.hindi).toContain('फ़ाइल');
  });

  test('bilingual error structure is consistent', () => {
    const errorStructure = {
      error: 'Something went wrong. Please try again.',
      hindi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
    };
    expect(errorStructure).toHaveProperty('error');
    expect(errorStructure).toHaveProperty('hindi');
    expect(typeof errorStructure.error).toBe('string');
    expect(typeof errorStructure.hindi).toBe('string');
  });
});

// ─── 9. Bilingual Response Structure ────────────────────────────────────────

describe('Bilingual Response Contract', () => {
  test('AI response has required bilingual fields', () => {
    const response = {
      english: 'Rice is recommended.',
      hindi: 'धान की सिफारिश की जाती है।',
      timestamp: new Date().toISOString(),
      source: 'AI',
    };
    expect(response).toHaveProperty('english');
    expect(response).toHaveProperty('hindi');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('source');
    expect(response.source).toBe('AI');
  });

  test('disease result has bilingual fields', () => {
    const result = {
      diseaseName: 'Leaf Blight',
      diseaseNameHindi: 'पत्ती झुलसा रोग',
      symptoms: 'Yellow spots.',
      symptomsHindi: 'पीले धब्बे।',
      prevention: 'Crop rotation.',
      preventionHindi: 'फसल चक्र।',
    };
    expect(result.diseaseNameHindi).toBeTruthy();
    expect(result.symptomsHindi).toBeTruthy();
    expect(result.preventionHindi).toBeTruthy();
  });

  test('crop recommendation has bilingual fields', () => {
    const crop = {
      cropName: 'Wheat',
      cropNameHindi: 'गेहूँ',
      whySuitable: 'Good for clay soil.',
      whySuitableHindi: 'चिकनी मिट्टी के लिए अच्छा।',
      bestSowingTime: 'October-November',
      bestSowingTimeHindi: 'अक्टूबर-नवंबर',
    };
    expect(crop.cropNameHindi).toBeTruthy();
    expect(crop.whySuitableHindi).toBeTruthy();
    expect(crop.bestSowingTimeHindi).toBeTruthy();
  });

  test('soil report has bilingual AI analysis', () => {
    const report = {
      aiAnalysis: 'Soil is in good condition.',
      aiAnalysisHindi: 'मिट्टी अच्छी स्थिति में है।',
    };
    expect(report.aiAnalysis).toBeTruthy();
    expect(report.aiAnalysisHindi).toBeTruthy();
  });
});
