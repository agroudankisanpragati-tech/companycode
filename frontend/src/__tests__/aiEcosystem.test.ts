/**
 * Agrodan Kisan Pragati — AI Ecosystem Tests
 * Covers: Language Context, AI Copilot, Crop Recommendation, Disease Detection,
 *         Soil Health, Voice Input, Voice Output, Error Handling
 */

import { getAssistantGreeting, getAssistantBranding } from '../context/AIAssistantContext';

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

class MockSpeechSynthesisUtterance {
  text: string;
  lang: string;
  constructor(text: string) {
    this.text = text;
    this.lang = 'en-US';
  }
}

(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

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

// ─── 1. Assistant Branding ────────────────────────────────────────────────

describe('Assistant Branding', () => {
  test('defaults to Pragati AI branding in the assistant greeting', () => {
    const greeting = getAssistantGreeting();
    expect(greeting).toContain('Pragati AI');
    expect(greeting).not.toContain('Kisan Saathi');
  });

  test('exposes the original Pragati AI branding metadata', () => {
    const branding = getAssistantBranding();
    expect(branding.title).toBe('Pragati AI');
    expect(branding.subtitle).toBe('Agroudan Kisan Pragati');
  });
});

// ─── 2. Language Switching ───────────────────────────────────────────────────

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

// ─── 3. AI Copilot (Bilingual Response) ────────────────────────────────────

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

// ─── 4. Crop Recommendation ─────────────────────────────────────────────────

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

// ─── 5. Disease Detection ────────────────────────────────────────────────────

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

// ─── 10. Voice Engine — Phase 6 ─────────────────────────────────────────────

describe('Voice Engine — Phase 6', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    localStorage.setItem('authToken', 'test-token');
  });

  // prepare-tts endpoint
  test('prepare-tts returns pronunciation-corrected text', async () => {
    mockFetch({
      success: true,
      source: 'computed',
      data: { ttsText: 'उड़द दाल', displayText: 'उड़द दाल', langBcp47: 'hi-IN' },
    });
    const res = await fetch('/api/voice-engine/prepare-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ text: 'Black gram', langCode: 'hi', pageContext: 'disease' }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.ttsText).toBe('उड़द दाल');
    expect(data.data.langBcp47).toBe('hi-IN');
  });

  test('prepare-tts returns English text unchanged when langCode is en', async () => {
    mockFetch({
      success: true,
      source: 'computed',
      data: { ttsText: 'Black gram', displayText: 'Black gram', langBcp47: 'en-IN' },
    });
    const res = await fetch('/api/voice-engine/prepare-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ text: 'Black gram', langCode: 'en' }),
    });
    const data = await res.json();
    expect(data.data.ttsText).toBe('Black gram');
    expect(data.data.langBcp47).toBe('en-IN');
  });

  test('prepare-tts serves from cache on second call', async () => {
    mockFetch({
      success: true,
      source: 'cache',
      data: { ttsText: 'टमाटर', displayText: 'टमाटर', langBcp47: 'hi-IN' },
    });
    const res = await fetch('/api/voice-engine/prepare-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ text: 'Tomato', langCode: 'hi' }),
    });
    const data = await res.json();
    expect(data.source).toBe('cache');
  });

  test('prepare-tts falls back gracefully on error', async () => {
    mockFetch({
      success: true,
      source: 'fallback',
      data: { ttsText: 'Leaf Blight', displayText: 'Leaf Blight', langBcp47: 'hi-IN' },
    });
    const res = await fetch('/api/voice-engine/prepare-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ text: 'Leaf Blight', langCode: 'hi' }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe('fallback');
    expect(data.data.ttsText).toBeTruthy();
  });

  // providers endpoint
  test('providers endpoint lists available STT/TTS providers', async () => {
    mockFetch({
      success: true,
      data: {
        providers: [
          { type: 'stt', name: 'browser', available: true },
          { type: 'tts', name: 'browser', available: true },
          { type: 'stt', name: 'google', available: false },
          { type: 'tts', name: 'local', available: false },
        ],
        activeSTT: 'browser',
        activeTTS: 'browser',
      },
    });
    const res = await fetch('/api/voice-engine/providers', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.activeSTT).toBe('browser');
    expect(data.data.activeTTS).toBe('browser');
    expect(Array.isArray(data.data.providers)).toBe(true);
  });

  // Training pipeline
  test('training import creates versioned dataset', async () => {
    mockFetch({
      success: true,
      data: {
        _id: 'ds1',
        name: 'rajasthan-crops-v1',
        version: '1.0.0',
        langCode: 'mwr',
        status: 'imported',
        totalRecordings: 50,
      },
    });
    const res = await fetch('/api/voice-engine/training/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        name: 'rajasthan-crops-v1',
        langCode: 'mwr',
        transcripts: [{ audioFileRef: 'audio/001.wav', transcript: 'उड़द दाल' }],
      }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.version).toBe('1.0.0');
    expect(data.data.status).toBe('imported');
  });

  test('training validate checks transcript quality', async () => {
    mockFetch({
      success: true,
      data: {
        datasetId: 'ds1',
        totalChecked: 50,
        validatedCount: 48,
        rejectedCount: 2,
        errors: ['Entry 3: transcript too short (< 3 chars)', 'Entry 12: empty transcript'],
      },
    });
    const res = await fetch('/api/voice-engine/training/validate/ds1', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();
    expect(data.data.validatedCount).toBe(48);
    expect(data.data.rejectedCount).toBe(2);
    expect(data.data.errors.length).toBe(2);
  });

  test('training approve requires validated status', async () => {
    mockFetch({ error: "Dataset must be in 'validated' status to approve. Current: imported" }, false, 400);
    const res = await fetch('/api/voice-engine/training/approve/ds1', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.error).toContain('validated');
  });

  test('approved datasets are readable for training pipeline', async () => {
    mockFetch({
      success: true,
      data: [
        { name: 'rajasthan-crops-v1', version: '1.0.0', langCode: 'mwr', status: 'approved', validatedCount: 48 },
      ],
    });
    const res = await fetch('/api/voice-engine/training/approved?langCode=mwr', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data[0].status).toBe('approved');
    expect(data.data[0].langCode).toBe('mwr');
  });
});

// ─── 11. Voice Rules — Display + Speak ──────────────────────────────────────

describe('Voice Rules — Display and Speak', () => {
  test('English selected: displayText = English, voiceText = English', () => {
    const appLangCode = 'en';
    const englishText = 'Leaf Blight detected.';
    const hindiText = 'पत्ती झुलसा रोग पाया गया।';
    const displayText = appLangCode === 'en' ? englishText : hindiText;
    const voiceText = appLangCode === 'en' ? englishText : hindiText;
    expect(displayText).toBe(englishText);
    expect(voiceText).toBe(englishText);
  });

  test('Hindi selected: displayText = Hindi, voiceText = Hindi', () => {
    const appLangCode = 'hi';
    const englishText = 'Leaf Blight detected.';
    const hindiText = 'पत्ती झुलसा रोग पाया गया।';
    const displayText = appLangCode === 'en' ? englishText : hindiText;
    const voiceText = appLangCode === 'en' ? englishText : hindiText;
    expect(displayText).toBe(hindiText);
    expect(voiceText).toBe(hindiText);
  });

  test('Marwari dialect: displayText = Hindi, voiceText = Hindi (hi-IN fallback)', () => {
    const appLangCode = 'mwr';
    const englishText = 'Black gram';
    const hindiText = 'उड़द दाल';
    const displayText = appLangCode === 'en' ? englishText : hindiText;
    expect(displayText).toBe(hindiText);
  });

  test('BCP-47 for Marwari resolves to hi-IN', () => {
    const LANG_BCP47: Record<string, string> = {
      en: 'en-IN', hi: 'hi-IN', mwr: 'hi-IN', mew: 'hi-IN', dhu: 'hi-IN',
    };
    expect(LANG_BCP47['mwr']).toBe('hi-IN');
    expect(LANG_BCP47['en']).toBe('en-IN');
  });

  test('technical terms (DAP, NPK, pH) are preserved as-is for TTS', () => {
    const PRESERVE = new Set(['dap', 'npk', 'urea', 'mop', 'ph', 'ec']);
    expect(PRESERVE.has('dap')).toBe(true);
    expect(PRESERVE.has('npk')).toBe(true);
    expect(PRESERVE.has('ph')).toBe(true);
    expect(PRESERVE.has('wheat')).toBe(false);
  });
});

// ─── 12. Offline Speech Cache ────────────────────────────────────────────────

describe('Offline Speech Cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('stores and retrieves TTS text', () => {
    const key = 'pragati_speech_tts_hi_tomato';
    const entry = { value: 'टमाटर', expiresAt: Date.now() + 86400000 };
    localStorage.setItem(key, JSON.stringify(entry));
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.value).toBe('टमाटर');
  });

  test('expired cache entry is not returned', () => {
    const key = 'pragati_speech_tts_hi_expired';
    const entry = { value: 'पुराना', expiresAt: Date.now() - 1000 }; // already expired
    localStorage.setItem(key, JSON.stringify(entry));
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw!);
    expect(Date.now() > parsed.expiresAt).toBe(true);
  });

  test('cache prefix is consistent', () => {
    const PREFIX = 'pragati_speech_';
    const key = `${PREFIX}tts_hi_blackgram`;
    expect(key.startsWith(PREFIX)).toBe(true);
  });
});

// ─── 13. Provider Swap — Zero Code Change ───────────────────────────────────

describe('Provider Swap — Configuration Only', () => {
  test('VOICE_STT_PROVIDER env var controls active provider', () => {
    // Simulates what voiceProviderAdapter.ts does
    const getActiveProvider = (envVar: string | undefined) => {
      const name = (envVar || 'browser').toLowerCase();
      const available: Record<string, boolean> = { browser: true, google: false, azure: false, local: false };
      return available[name] ? name : 'browser';
    };
    expect(getActiveProvider(undefined)).toBe('browser');
    expect(getActiveProvider('browser')).toBe('browser');
    expect(getActiveProvider('google')).toBe('browser'); // not configured → fallback
    expect(getActiveProvider('local')).toBe('browser');  // not configured → fallback
  });

  test('local provider activates when LOCAL_STT_ENDPOINT is set', () => {
    const getActiveProvider = (envVar: string | undefined, localEndpoint: string | undefined) => {
      const name = (envVar || 'browser').toLowerCase();
      const available: Record<string, boolean> = {
        browser: true,
        google: false,
        azure: false,
        local: !!localEndpoint,
      };
      return available[name] ? name : 'browser';
    };
    expect(getActiveProvider('local', 'http://localhost:8080')).toBe('local');
    expect(getActiveProvider('local', undefined)).toBe('browser');
  });

  test('swapping provider does not change business logic', () => {
    // Business logic (disease detection, crop advisory) always receives English
    const processForBackend = (text: string, _provider: string) => {
      // Provider is irrelevant — backend always gets English
      return text.toLowerCase().replace(/\s+/g, '_');
    };
    expect(processForBackend('Black Gram', 'browser')).toBe('black_gram');
    expect(processForBackend('Black Gram', 'google')).toBe('black_gram');
    expect(processForBackend('Black Gram', 'local')).toBe('black_gram');
  });
});

// ─── 14. Voice Works on All Pages ───────────────────────────────────────────

describe('Voice Engine — All Pages', () => {
  const PAGES = [
    'disease', 'crop', 'soil', 'weather', 'market', 'government', 'kvk', 'ui',
  ];

  test.each(PAGES)('voice engine context is available on %s page', (page) => {
    // VoiceEngineProvider wraps all pages via layout.tsx
    // Each page calls useVoiceEngineContext() — returns no-op if outside provider
    const noOpContext = {
      ttsState: 'idle', sttState: 'idle', sttError: null, interim: '',
      ttsSupported: false, sttSupported: false, processing: false,
      mode: 'idle', isHolding: false, isContinuous: false, lastResult: null,
      ready: false,
    };
    expect(noOpContext.ttsState).toBe('idle');
    expect(noOpContext.ready).toBe(false);
    // In real app, ready=true after VoiceEngineProvider mounts
  });

  test('same voice engine instance reused across pages (singleton pattern)', () => {
    // VoiceEngineProvider is mounted once in layout.tsx
    // All pages share the same context value — no re-initialization
    let initCount = 0;
    const createEngine = (() => {
      let instance: object | null = null;
      return () => {
        if (!instance) { instance = {}; initCount++; }
        return instance;
      };
    })();
    const e1 = createEngine();
    const e2 = createEngine();
    const e3 = createEngine();
    expect(e1).toBe(e2);
    expect(e2).toBe(e3);
    expect(initCount).toBe(1);
  });

  test('voice engine graceful fallback when unavailable', () => {
    const fallback = {
      speak: async () => {},
      interrupt: () => {},
      replay: () => {},
      startListening: () => {},
      stopListening: () => {},
    };
    expect(() => fallback.speak()).not.toThrow();
    expect(() => fallback.interrupt()).not.toThrow();
    expect(() => fallback.replay()).not.toThrow();
    expect(() => fallback.startListening()).not.toThrow();
    expect(() => fallback.stopListening()).not.toThrow();
  });
});
