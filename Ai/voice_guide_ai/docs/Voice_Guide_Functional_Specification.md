# Voice Guide Functional Specification
## 1. Purpose

Voice Guide AI is an offline-first multilingual digital assistant designed to guide farmers through every page of the Kisan Unnati platform using voice guidance and an animated avatar.

Its primary purpose is to help farmers—especially those with low digital literacy—understand how to use the application without requiring external assistance.

The guide automatically explains each page, important buttons, and available features in the farmer's selected language. It supports multiple Indian languages and regional dialects, with special focus on Rajasthan dialects such as Marwari, Mewari, Dhundhari, Hadoti, Shekhawati, Bagri, Mewati, and Wagdi.

Voice Guide AI is designed to work completely offline using locally stored dialogues, translations, and audio files. Internet connectivity is optional and only used for downloading updates or additional voice resources.

Voice Guide AI is not a chatbot and does not answer farming questions. It only guides users through the application. All agricultural intelligence, recommendations, disease analysis, and AI conversations are handled separately by Pragati AI.
## 2. Scope

Voice Guide AI is responsible only for guiding users throughout the Kisan Unnati platform.

Its scope includes:

- Welcoming users when they enter the application.
- Helping users navigate different pages.
- Explaining page features and available options.
- Providing voice guidance in the user's selected language.
- Working completely offline using pre-generated audio.
- Displaying an animated avatar while speaking.
- Repeating guidance after the configured time interval (default: 24 hours).
- Supporting multilingual and Rajasthan regional dialects.
- Allowing users to replay guidance whenever required.

Voice Guide AI is not responsible for AI conversations, crop recommendations, disease diagnosis, government scheme eligibility, weather prediction, or any decision-making functionality. These services remain under Pragati AI.
## 3. Features

- Offline-first architecture.
- Multilingual voice guidance.
- Rajasthan dialect support.
- Animated AI avatar.
- Automatic page explanation.
- Welcome messages for first-time users.
- Repeat guidance after configurable time intervals.
- Manual replay option.
- Subtitle support.
- Local audio playback.
- Local translation support.
- Fast response without internet.
- Modular architecture.
- Scalable language system.
- Future support for cloud voice providers like Amazon Polly and OpenAI TTS.
## 4. Limitations

Voice Guide AI only guides users through the application interface.

It does not answer farming questions.

It does not provide crop recommendations.

It does not detect crop diseases.

It does not predict weather.

It does not determine government scheme eligibility.

It does not perform AI chat.

It does not replace Pragati AI.

If a required audio file is unavailable, the system should gracefully fall back to subtitles or the default language without interrupting the user experience.
## 5. Design Principles

The Voice Guide AI module follows the following design principles:

### 1. Offline First
The system must work without an internet connection. All dialogues, translations, audio files, and configurations should be available locally.

### 2. Modular Architecture
Every component (Dialogue Engine, Language Engine, Voice Engine, Avatar Engine, Configuration System) must be independent and reusable.

### 3. No Hardcoded Content
All dialogues, translations, audio mappings, and settings must be loaded dynamically from JSON configuration files.

### 4. Multilingual by Design
Every feature must support multiple Indian languages and Rajasthan regional dialects without changing the application code.

### 5. Scalable Architecture
New languages, pages, dialogues, audio files, and future AI capabilities should be added without modifying the core system.

### 6. Independent Module
Voice Guide AI must remain completely independent from Pragati AI. It should integrate through interfaces without changing Pragati AI's internal implementation.

### 7. Performance First
The guide should start within milliseconds and consume minimal CPU, memory, and storage resources.

### 8. Consistent User Experience
The same behaviour should be maintained across Website, Android App, and future platforms.

### 9. Accessibility
Voice guidance, subtitles, and simple navigation should make the platform usable for digitally inexperienced farmers.

### 10. Future Ready
The architecture should support future integration with Amazon Polly, OpenAI TTS, ElevenLabs, animated avatars, and additional AI modules without redesigning the project.