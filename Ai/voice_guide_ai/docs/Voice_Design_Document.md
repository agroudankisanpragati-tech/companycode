# Voice Design Document

## 1. Overview

Voice Guide AI uses pre-recorded offline audio as its primary voice system to provide a fast, reliable, and internet-independent experience for farmers. The system is designed to support multiple languages, regional dialects, and future cloud-based TTS providers without changing the application architecture.

---

# 2. Objectives

- Provide natural voice guidance.
- Work completely offline.
- Support multiple languages.
- Support Rajasthan regional dialects.
- Maintain consistent voice quality.
- Minimize response time.
- Support future cloud voice providers.

---

# 3. Voice Architecture

Voice Guide follows an Offline First architecture.

Priority Order:

1. Offline Audio
2. Amazon Polly
3. OpenAI TTS
4. ElevenLabs
5. Subtitle Only (Fallback)

---

# 4. Voice Characteristics

The voice should be:

- Friendly
- Calm
- Natural
- Slow
- Clear
- Farmer-friendly
- Professional
- Easy to understand

Avoid robotic or overly expressive voices.

---

# 5. Speaking Rules

- Speak slowly.
- Pause naturally.
- Avoid technical terms.
- Pronounce crop names correctly.
- Do not interrupt users.
- Complete the current sentence before stopping.

---

# 6. Voice Speed

Default Speed

1.0x

Supported Range

0.8x – 1.2x

Users may change speed from Settings.

---

# 7. Voice Volume

Default

100%

User Adjustable

Yes

---

# 8. Subtitle Rules

Whenever voice is playing:

- Display subtitles.
- Synchronize subtitle timing with speech.
- Support every language.

---

# 9. Audio Format

Preferred Format

MP3

Future Support

- WAV
- OGG

---

# 10. Audio Quality

Sample Rate

44.1 kHz

Bitrate

128 kbps minimum

Channels

Mono or Stereo

---

# 11. Audio Naming Standard

Examples

home_welcome_001.mp3

home_revisit_001.mp3

disease_upload_001.mp3

weather_forecast_001.mp3

---

# 12. Offline Behaviour

Without Internet

- Load local audio.
- Play immediately.
- No online request.
- No waiting.

---

# 13. Online Behaviour

If internet is available:

- Check for updated voice packs.
- Download new audio if required.
- Continue using local audio during download.

---

# 14. Error Handling

If audio is missing:

↓

Display subtitle

↓

Play default language audio

↓

If unavailable

↓

Display text only

Application must never crash.

---

# 15. Future Enhancements

Future versions may support:

- Voice cloning
- Personalized voice
- Dynamic TTS
- Voice commands
- Emotion-aware speech
- Real-time speech generation
- AI-generated greetings

---

# 16. Design Principles

- Offline First
- Fast Playback
- Modular Design
- Provider Independent
- Scalable
- No Hardcoded Audio
- JSON-based Configuration