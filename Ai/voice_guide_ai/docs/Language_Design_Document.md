# Language Design Document

## 1. Overview

The Voice Guide AI language system is designed to provide a multilingual and offline-first experience for farmers across India. Every dialogue, subtitle, and voice should automatically adapt to the user's selected language without modifying the application code.

The system supports multiple Indian languages and Rajasthan regional dialects using a modular translation architecture.

---

# 2. Objectives

- Support multiple Indian languages.
- Support Rajasthan regional dialects.
- Work completely offline.
- Easy to add new languages.
- No hardcoded text.
- One translation source for every dialogue.

---

# 3. Supported Languages

Primary Languages

- English
- Hindi
- Gujarati
- Punjabi
- Bengali
- Odia
- Urdu
- Tamil
- Telugu
- Kannada
- Malayalam

Rajasthan Languages

- Marwari
- Mewari
- Dhundhari
- Hadoti
- Shekhawati
- Bagri
- Mewati
- Wagdi

Future Languages

- Assamese
- Konkani
- Sanskrit
- Nepali
- Bhojpuri
- Maithili
- Chhattisgarhi

---

# 4. Default Language

Default Language

Hindi

Fallback Language

English

If both are unavailable

Display subtitles only.

---

# 5. Language Selection

Language popup appears on first launch.

After selection

↓

Save locally

↓

Load translations

↓

Load audio

↓

Load avatar configuration

Users may change language anytime from Settings.

---

# 6. Translation Architecture

Every dialogue has a unique ID.

Example

home_welcome_001

↓

English

↓

Hindi

↓

Marwari

↓

Gujarati

↓

Tamil

Only translated text changes.

Dialogue ID remains identical.

---

# 7. Translation Rules

Every translation must

- Keep original meaning.
- Use simple language.
- Avoid technical words.
- Be understandable by farmers.
- Preserve dialogue IDs.
- Support subtitles.
- Support offline mode.

---

# 8. Dialect Rules

Rajasthan dialects should preserve local pronunciation and common farming terminology.

Avoid direct machine translation.

Use natural spoken dialect.

---

# 9. Language Switching

When user changes language

↓

Save preference

↓

Reload translations

↓

Reload audio

↓

Continue without restarting application.

---

# 10. Offline Behaviour

All translations are stored locally.

No internet required.

Missing translation

↓

Fallback language

↓

Subtitle

Application must never crash.

---

# 11. Storage Structure

translations/

↓

language/

↓

page.json

Example

translations/

↓

hi/

↓

home.json

---

# 12. Future Support

Future versions may support

- Auto language detection
- Voice cloning
- AI translation
- Cloud translation updates
- Community translations
- Personalized dialect selection

---

# 13. Design Principles

- Offline First
- Translation Independence
- Easy Expansion
- Fast Loading
- No Hardcoding
- JSON Based
- Modular Architecture