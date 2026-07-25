# JSON Schema Document

## 1. Overview

This document defines the standard JSON schemas used throughout the Voice Guide AI project. Every module must follow these schemas to ensure consistency, maintainability, and compatibility.

All JSON files must use UTF-8 encoding, 4-space indentation, and a consistent key naming convention.

---

# 2. Dialogue JSON Schema

Purpose

Stores page-wise dialogue information.

Required Fields

- id
- page
- dialogueType
- title
- version
- text
- repeat
- voice
- avatar
- display
- conditions
- status

Example Structure

{
    "id": "home_welcome_001",
    "page": "home",
    "dialogueType": "welcome",
    "title": "Home Welcome",
    "version": "1.0.0",
    "text": "",
    "repeat": {},
    "voice": {},
    "avatar": {},
    "display": {},
    "conditions": {},
    "status": "active"
}

---

# 3. Translation JSON Schema

Purpose

Stores translated text for every dialogue.

Required Fields

- Dialogue ID
- Translation Text

Example

{
    "home_welcome_001": "Welcome to Pragati AI"
}

---

# 4. Configuration JSON Schema

Purpose

Stores application configuration.

Required Fields

- version
- settings

Example

{
    "version": "1.0.0",
    "settings": {}
}

---

# 5. Voice Configuration Schema

Required Fields

- enabled
- provider
- language
- speed
- volume

Example

{
    "enabled": true,
    "provider": "offline",
    "language": "hi",
    "speed": 1.0,
    "volume": 1.0
}

---

# 6. Avatar Configuration Schema

Required Fields

- enabled
- animation
- expression
- showAvatar

Example

{
    "enabled": true,
    "animation": "wave",
    "expression": "smile",
    "showAvatar": true
}

---

# 7. Audio Metadata Schema

Purpose

Stores metadata of generated audio.

Required Fields

- id
- filename
- language
- duration
- provider
- checksum
- version

Example

{
    "id": "home_welcome_001",
    "filename": "home_welcome_001.mp3",
    "language": "hi",
    "duration": 12.5,
    "provider": "offline",
    "checksum": "",
    "version": "1.0.0"
}

---

# 8. Session Schema

Stores user runtime information.

Required Fields

- language
- firstVisit
- lastVisit
- lastDialogue
- lastPlayback
- replayCount

Example

{
    "language": "hi",
    "firstVisit": false,
    "lastVisit": "",
    "lastDialogue": "",
    "lastPlayback": "",
    "replayCount": 0
}

---

# 9. Validation Rules

Every JSON file must:

- Follow UTF-8 encoding.
- Use valid JSON syntax.
- Contain required fields.
- Avoid duplicate IDs.
- Maintain schema compatibility.
- Include version information where applicable.

---

# 10. Versioning

Every schema should support versioning.

Example

{
    "version": "1.0.0"
}

Future schema changes should maintain backward compatibility whenever possible.

---

# 11. Error Handling

If a JSON file is:

- Missing
- Invalid
- Corrupted

The system should:

- Load backup.
- Use fallback.
- Log the error.
- Continue running.

---

# 12. Future Enhancements

Future schemas may include:

- Analytics
- Personalization
- AI-generated dialogues
- Voice cloning metadata
- Cloud synchronization
- Plugin support

---

# 13. Design Principles

- Consistent
- Modular
- Reusable
- Version Controlled
- Human Readable
- Offline First
- Extensible