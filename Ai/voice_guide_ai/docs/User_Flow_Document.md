# User Flow Document

## 1. Overview
The User Flow defines how Voice Guide AI behaves throughout the Kisan Unnati platform. It ensures every farmer receives simple, multilingual, and offline voice guidance without interrupting normal application usage.

Voice Guide AI automatically guides users based on their language preference, page navigation, and previous session history.

---
## 2. First-Time User Flow
When a farmer opens the Kisan Unnati platform for the very first time, Voice Guide AI starts automatically.

### Step 1 – Application Launch
- User opens the website or mobile application.
- Voice Guide AI initializes in the background.
- Configuration files are loaded.
- Offline resources are verified.

### Step 2 – Language Selection
- Display the language selection popup.
- Ask the user to select their preferred language.
- Save the selected language locally.
- Set the selected language as the default language.

### Step 3 – Voice Guide Initialization
- Load dialogues for the selected language.
- Load the corresponding audio resources.
- Load the avatar configuration.
- Prepare the subtitle system.

### Step 4 – Home Page Welcome
- Navigate to the Home page.
- Display the AI avatar.
- Play the welcome message.
- Show subtitles while speaking.

### Step 5 – Feature Introduction
The Voice Guide introduces:
- Disease Detection
- Crop Recommendation
- Government Schemes
- Weather
- Mandi Prices
- Soil Health
- Marketplace
- AI Chat

### Step 6 – User Navigation
- Allow the user to navigate freely.
- Explain each page only when visited for the first time.
- Do not interrupt user actions while speaking.

### Step 7 – Save Session
Store:
- Selected language
- First visit completed
- Last voice played
- Last visit time

The first-time onboarding process is now complete.
## 3. Returning User Flow
When an existing farmer opens the Kisan Unnati platform again, Voice Guide AI should recognize the user's previous session and provide guidance accordingly.

### Step 1 – Application Launch
- Initialize Voice Guide AI.
- Load saved user preferences.
- Verify offline resources.

### Step 2 – Load User Profile
Load:
- Selected language
- Last visit time
- Last played dialogue
- First visit status
- Voice settings

### Step 3 – Check Repeat Rule
Voice Guide AI compares the current time with the last voice playback time.

If less than 24 hours have passed:
- Do not automatically play the welcome message.
- Allow the farmer to manually replay the guide if required.

If 24 hours or more have passed:
- Automatically play the Home welcome dialogue.
- Update the last playback timestamp.

### Step 4 – Page Behaviour
When the user visits a page:
- If the page has never been visited before, explain it once.
- If it has already been explained, do not interrupt the user.
- If the user presses the replay button, play the guide again.

### Step 5 – Session Update
Update:
- Last visit time
- Last page visited
- Last dialogue played
- Replay count

The returning session continues normally without repeating unnecessary guidance.
## 4. Guest User Flow
Guest users can access:

- Home
- Disease Detection
- Crop Recommendation
- Weather
- Mandi
- Government Schemes

Voice Guide:

- Explains available features.
- Encourages registration when premium features require login.
- Never forces login immediately.

---
## 5. Registered User Flow
After login:

Voice Guide welcomes the user.

Explains:

- Dashboard
- Saved Reports
- Profile
- Notifications
- Personalized Features

Previously completed tutorials should not repeat.

---
## 6. Page Navigation Flow
Whenever the user opens a page:

Page Opens

↓

Voice Guide checks:

- Has this page already been explained?

If NO

↓

Play Guide

If YES

↓

Do Nothing

Replay button always remains available.

---
## 7. Language Selection Flow
Application Starts

↓

Language Popup

↓

User Selects Language

↓

Save Language

↓

Load Translation

↓

Load Audio

↓

Load Avatar

↓

Continue

Users can change language anytime from Settings.

---
## 8. Voice Playback Flow
When a dialogue starts:

Load Dialogue

↓

Load Translation

↓

Find Audio

↓

Display Avatar

↓

Show Subtitle

↓

Play Voice

↓

Update Last Played Timestamp

If audio is unavailable:

Fallback:

Subtitle

↓

Default Language Audio

---
## 9. Avatar Behaviour Flow
Before speaking:

- Avatar appears.

During speaking:

- Lip movement.
- Facial expressions.
- Hand animation.

After speaking:

- Return to idle animation.

---
## 10. 24-Hour Repeat Flow
Save:

Last Voice Playback Time

Whenever application opens:

Current Time

↓

Compare with Last Playback

If less than 24 hours:

Skip Welcome

If 24 hours or more:

Play Welcome Again

Update Timestamp

---
## 11. Offline Flow
Without Internet:

- Voice Guide starts normally.
- Local dialogues are loaded.
- Local translations are loaded.
- Local audio files are played.
- Avatar works normally.

Cloud services remain disabled.

---
## 12. Online Flow
With Internet:

Voice Guide behaves normally.

Additionally it may:

- Download updated audio files.
- Download updated translations.
- Download configuration updates.
- Check new voice packages.

Core guidance continues to work offline.

---

## 13. Error Handling Flow
If Translation Missing:

↓

Use Default Language

If Audio Missing:

↓

Show Subtitle

↓

Play Default Audio

If Configuration Missing:

↓

Load Default Configuration

Application should never crash because of Voice Guide.

---
## 14. Replay Voice Flow
Every supported page contains a Replay button.

When pressed:

Load Dialogue

↓

Load Translation

↓

Load Audio

↓

Play Again

Replay does not affect the 24-hour rule.

---
## 15. Future Flow
Future versions may support:

- Personalized greetings.
- AI-generated dynamic guidance.
- Voice commands.
- Live TTS generation.
- Cloud synchronization.
- Emotion-aware avatars.
- Multiple avatar characters.
- Gesture recognition.
- Smart contextual guidance.

The current architecture is designed to support these features without major redesign.