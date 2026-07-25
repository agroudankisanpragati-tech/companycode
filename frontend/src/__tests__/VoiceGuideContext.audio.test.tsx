import React, { useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VoiceGuideProvider, useVoiceGuideContext } from '../context/VoiceGuideContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../context/LanguageContext', () => ({
  useLanguage: jest.fn(),
}));

function Consumer() {
  const { play } = useVoiceGuideContext();

  useEffect(() => {
    void play('home', 'welcome');
  }, [play]);

  return null;
}

describe('VoiceGuide audio playback', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    (useAuth as jest.Mock).mockReturnValue({ user: { id: '1' }, isAuthenticated: true });
    (useLanguage as jest.Mock).mockReturnValue({ langCode: 'en' });

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        getVoices: jest.fn(() => []),
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          success: true,
          text: 'Welcome to the farm guide',
        },
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it('speaks the dialogue text when the play response includes text', async () => {
    // Simulate user interaction to unlock audio context
    await act(async () => {
      window.dispatchEvent(new MouseEvent('click'));
    });

    await act(async () => {
      root.render(
        <VoiceGuideProvider>
          <Consumer />
        </VoiceGuideProvider>,
      );
    });

    // Allow setTimeout(speakText, 300) to fire
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
