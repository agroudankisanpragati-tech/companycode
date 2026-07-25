# Audio Naming Convention

## 1. Overview

This document defines the standard naming convention for all audio resources used by Voice Guide AI. A consistent naming system ensures easy management, quick lookup, scalability, and compatibility with offline playback and future cloud voice providers.

---

# 2. Objectives

- Maintain consistent audio naming.
- Avoid duplicate filenames.
- Support multilingual audio.
- Support offline playback.
- Easy integration with JSON dialogue IDs.
- Future scalable.

---

# 3. Naming Pattern

Every audio file must follow:

page_dialoguetype_number.mp3

Example

home_welcome_001.mp3

---

# 4. General Rules

- Use lowercase letters.
- Use underscores (_).
- No spaces.
- No special characters.
- Keep names descriptive.
- Every filename must be unique.

---

# 5. Home Page Audio

Examples

home_welcome_001.mp3

home_revisit_001.mp3

home_help_001.mp3

home_exit_001.mp3

---

# 6. Login Audio

Examples

login_welcome_001.mp3

login_help_001.mp3

login_otp_001.mp3

login_success_001.mp3

login_error_001.mp3

---

# 7. Registration Audio

Examples

register_welcome_001.mp3

register_mobile_001.mp3

register_otp_001.mp3

register_success_001.mp3

register_error_001.mp3

---

# 8. Disease Detection Audio

Examples

disease_welcome_001.mp3

disease_upload_001.mp3

disease_camera_001.mp3

disease_gallery_001.mp3

disease_processing_001.mp3

disease_result_001.mp3

disease_retry_001.mp3

---

# 9. Crop Recommendation Audio

Examples

crop_welcome_001.mp3

crop_soil_001.mp3

crop_season_001.mp3

crop_water_001.mp3

crop_result_001.mp3

---

# 10. Government Scheme Audio

Examples

scheme_welcome_001.mp3

scheme_search_001.mp3

scheme_document_001.mp3

scheme_apply_001.mp3

---

# 11. Weather Audio

Examples

weather_welcome_001.mp3

weather_forecast_001.mp3

weather_rain_001.mp3

weather_alert_001.mp3

---

# 12. Mandi Audio

Examples

mandi_welcome_001.mp3

mandi_crop_001.mp3

mandi_market_001.mp3

mandi_price_001.mp3

---

# 13. Soil Health Audio

Examples

soil_welcome_001.mp3

soil_report_001.mp3

soil_nutrient_001.mp3

soil_result_001.mp3

---

# 14. Marketplace Audio

Examples

market_welcome_001.mp3

market_search_001.mp3

market_order_001.mp3

market_payment_001.mp3

---

# 15. Profile Audio

Examples

profile_welcome_001.mp3

profile_edit_001.mp3

profile_save_001.mp3

---

# 16. Settings Audio

Examples

settings_welcome_001.mp3

settings_language_001.mp3

settings_voice_001.mp3

settings_avatar_001.mp3

settings_offline_001.mp3

---

# 17. Common Audio

Examples

common_loading_001.mp3

common_success_001.mp3

common_error_001.mp3

common_retry_001.mp3

common_offline_001.mp3

---

# 18. Language Storage

Example

voice/

↓

audio/

↓

hi/

↓

home/

↓

home_welcome_001.mp3

Each language stores the same filenames.

Only the audio content changes.

---

# 19. Versioning

Never include version numbers in filenames.

Correct

home_welcome_001.mp3

Incorrect

home_welcome_v2.mp3

Store version information inside metadata.

---

# 20. Design Principles

- Consistent
- Modular
- Offline First
- Easy Search
- Easy Mapping
- JSON Compatible
- Future Ready