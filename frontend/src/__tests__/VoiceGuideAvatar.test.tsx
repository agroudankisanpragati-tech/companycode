import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import VoiceGuideAvatar from '../components/VoiceGuideAvatar';
import { useVoiceGuideContext } from '../context/VoiceGuideContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

jest.mock('../context/VoiceGuideContext', () => ({
  useVoiceGuideContext: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../context/LanguageContext', () => ({
  useLanguage: jest.fn(),
}));

describe('VoiceGuideAvatar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    (useLanguage as jest.Mock).mockReturnValue({ langCode: 'en' });
    (useVoiceGuideContext as jest.Mock).mockReturnValue({
      avatarState: 'idle',
      bridgeOnline: false,
      subtitle: '',
      isPlaying: false,
      isMuted: false,
      replay: jest.fn(),
      dismiss: jest.fn(),
      toggleMute: jest.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it('renders even when the bridge is offline and no dialogue is playing', () => {
    act(() => {
      root.render(<VoiceGuideAvatar />);
    });

    expect(container.querySelector('[aria-label="Kisan Saathi Voice Guide"]')).not.toBeNull();
  });
});
