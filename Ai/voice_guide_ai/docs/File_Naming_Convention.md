# File Naming Convention

## 1. Overview

This document defines the naming standards for all files, folders, assets, audio resources, translations, configurations, logs, and documentation used in the Voice Guide AI project.

A consistent naming convention improves maintainability, scalability, readability, and automation.

---

# 2. General Naming Rules

All file names must:

- Use lowercase letters.
- Use underscores (_) instead of spaces.
- Avoid special characters.
- Be descriptive.
- Remain unique.
- Follow a consistent pattern.

Example

voice_config.json

language_config.json

home_welcome_001.mp3

---

# 3. Folder Naming

Folders must use lowercase names.

Examples

config/

dialogues/

translations/

voice/

avatar/

utils/

tests/

docs/

---

# 4. Python File Naming

Python modules should use snake_case.

Examples

json_manager.py

language_manager.py

dialogue_loader.py

audio_manager.py

session_manager.py

scheduler.py

---

# 5. Configuration File Naming

Examples

app_config.json

language_config.json

voice_config.json

avatar_config.json

provider_config.json

trigger_config.json

offline_config.json

audio_config.json

---

# 6. Dialogue File Naming

Examples

welcome.json

revisit.json

help.json

exit.json

success.json

error.json

offline.json

retry.json

Each page should maintain identical naming.

---

# 7. Translation File Naming

Examples

home.json

login.json

register.json

weather.json

mandi.json

profile.json

common.json

language_popup.json

---

# 8. Audio File Naming

Pattern

page_dialoguetype_number.mp3

Examples

home_welcome_001.mp3

home_revisit_001.mp3

login_help_001.mp3

disease_upload_001.mp3

weather_forecast_001.mp3

mandi_price_001.mp3

---

# 9. Avatar Asset Naming

Examples

avatar_idle.png

avatar_wave.json

avatar_smile.json

avatar_speaking.json

avatar_warning.json

---

# 10. Metadata Naming

Examples

audio_index.json

duration.json

checksum.json

versions.json

---

# 11. Log File Naming

Examples

system.log

voice.log

error.log

session.log

debug.log

---

# 12. Documentation Naming

Examples

01_Voice_Guide_Functional_Specification.md

02_User_Flow_Document.md

03_Page_Behaviour_Document.md

04_Dialogue_Design_Document.md

---

# 13. Versioning Rules

Avoid version numbers inside filenames.

Correct

voice_config.json

Incorrect

voice_config_v2.json

Version should remain inside the JSON content.

---

# 14. Reserved Characters

Do not use

Space

-

+

%

@

#

()

[]

{}

Use only:

a-z

0-9

_

---

# 15. Future Naming Strategy

Future modules should follow the same convention to ensure compatibility with automation tools and code generators.

---

# 16. Design Principles

- Consistent
- Predictable
- Human Readable
- Automation Friendly
- Platform Independent
- Scalable
- Maintainable