// Jest test setup — browser API mocks
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-IN';
  rate = 1;
  pitch = 1;
  voice = null;
  onstart = null;
  onend = null;
  onerror = null;
  onpause = null;
  onresume = null;
  constructor(text: string) { this.text = text; }
}
(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Mock URL.createObjectURL
(global as any).URL.createObjectURL = jest.fn(() => 'blob:mock-url');
(global as any).URL.revokeObjectURL = jest.fn();

// Mock FormData
(global as any).FormData = class {
  private data: Record<string, any> = {};
  append(key: string, value: any) { this.data[key] = value; }
  get(key: string) { return this.data[key]; }
};
