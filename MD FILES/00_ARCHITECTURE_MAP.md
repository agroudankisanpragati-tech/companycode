# COMPANYCODE — COMPLETE ARCHITECTURE MAP
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGROUDAN KISAN PRAGATI                        │
│                         COMPANYCODE REPOSITORY                       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   FRONTEND       │    │   BACKEND        │    │   ADMIN          │
│   (Next.js)      │    │   (Express)      │    │   (Next.js)      │
│   Port: 3000     │    │   Port: 4000     │    │   Port: 3001     │
│                  │    │                  │    │                  │
│  - React 18      │    │  - Node.js/TS    │    │  - Admin panel   │
│  - Next.js 14    │    │  - Express       │    │  - Separate app  │
│  - Tailwind CSS  │    │  - Mongoose      │    │                  │
│  - Axios         │    │  - Passport      │    │                  │
└────────┬─────────┘    └────────┬─────────┘    └──────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                                 │
│                    localhost:27017                                  │
│                    Database: kisan-pragati                          │
│                    Location: data/mongo/                            │
└─────────────────────────────────────────────────────────────────────┘

         │                       │
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   AI SERVICES    │    │   AI BRIDGES     │    │   EXTERNAL APIs  │
│                  │    │                  │    │                  │
│  - YOLO v8       │    │  - Pragati AI    │    │  - OpenAI/       │
│    (Port 8000)   │    │    Bridge        │    │    OpenRouter    │
│  - Crop AI       │    │    (Port 8001)   │    │  - WeatherAPI    │
│  - Voice Guide   │    │  - Voice Guide   │    │  - data.gov.in   │
│  - Speech to Text│    │    Bridge        │    │  - Google Maps   │
│                  │    │    (Port 8002)   │    │  - Cloudinary    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 2. TECHNOLOGY STACK

### 2.1 Frontend (Next.js)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS 3.3
- **HTTP Client**: Axios 1.6 + native fetch
- **State**: React Context (Auth, AI, Voice Guide, Language, Location)
- **Animations**: Framer Motion
- **Icons**: Lucide React, React Icons
- **Testing**: Jest + React Testing Library

### 2.2 Backend (Express)
- **Framework**: Express.js 4.18
- **Language**: TypeScript
- **Runtime**: Node.js
- **Database**: MongoDB (Mongoose 8.0)
- **Auth**: JWT (jsonwebtoken), Passport (Google OAuth), bcrypt
- **Upload**: Multer
- **AI/ML**: Direct HTTP calls to Python bridges
- **Email**: Nodemailer
- **Queue/BG**: child_process spawn for Python bridges
- **Validation**: Express middleware

### 2.3 AI Services (Python)
- **Framework**: FastAPI + Uvicorn
- **ML**: PyTorch 2.6, Ultralytics YOLOv8 8.2.103
- **STT**: Faster-Whisper 1.0.3
- **TTS**: pyttsx3 / gTTS (via bridges)
- **NLP**: scikit-learn (TF-IDF + LogReg for intent)
- **Data**: pandas, numpy
- **Image**: OpenCV, Pillow, Albumentations
- **MongoDB**: pymongo (direct DB access from Python)

### 2.4 Admin Panel
- **Framework**: Next.js (separate from main frontend)
- **Purpose**: Admin management of disease knowledge base, users, schemes

---

## 3. PROJECT STRUCTURE

```
companycode/
├── frontend/                    # Next.js frontend (port 3000)
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # React contexts (Auth, AI, Voice, Language)
│   │   ├── hooks/               # Custom hooks
│   │   ├── i18n/                # Internationalization
│   │   ├── lib/                 # API client, utilities
│   │   ├── services/            # Frontend API service layer
│   │   ├── styles/              # CSS/Tailwind
│   │   └── utils/               # Client-side utilities
│   ├── .env.local               # Frontend environment
│   ├── next.config.js
│   └── package.json
│
├── backend/                     # Express backend (port 4000)
│   ├── src/
│   │   ├── agents/              # AI agent implementations
│   │   ├── config/              # Database config
│   │   ├── middleware/          # Auth, error handling, language context
│   │   ├── models/              # Mongoose models (47 files)
│   │   ├── routes/              # Express route handlers (38 files)
│   │   ├── scripts/             # Seed scripts
│   │   ├── services/            # Business logic services (38 files)
│   │   └── utils/               # Utilities (logger, OTP, SMS, etc.)
│   ├── .env.example             # Backend environment template
│   ├── uploads/                 # Uploaded files (avatars, disease images, soil reports)
│   └── package.json
│
├── admin/                       # Admin panel (port 3001)
│   ├── src/
│   │   ├── app/                 # Admin pages
│   │   ├── components/          # Admin components
│   │   └── styles/              # Admin styles
│   └── package.json
│
├── Ai/                          # Python AI services
│   ├── fastapi_server.py        # YOLO inference service (port 8000)
│   ├── ai_controller.py         # Legacy AI controller
│   ├── ai_pipeline.py           # AI processing pipeline
│   ├── pragati_ai_controller/   # Pragati AI FastAPI bridge (port 8001)
│   │   ├── fastapi_bridge.py    # HTTP bridge for Node.js
│   │   ├── controller.py        # Root agent controller
│   │   ├── pipeline.py          # Processing pipeline
│   │   └── ...
│   ├── voice_guide_ai/          # Voice Guide FastAPI bridge (port 8002)
│   │   ├── api_bridge.py        # HTTP bridge
│   │   ├── runtime/             # Runtime manager
│   │   ├── core/                # Core dialogue engine
│   │   └── ...
│   ├── speech_to_text/          # STT service (Faster-Whisper)
│   ├── intent_engine/           # Intent classification (TF-IDF + LogReg)
│   ├── knowledge_base/          # Knowledge base services
│   ├── voice_models/            # TTS voice models
│   ├── weights/                 # YOLO model weights
│   │   └── yolov8s-cls.pt       # YOLOv8 classification model
│   ├── configs/                 # Configuration files
│   ├── outputs/                 # Generated audio/video outputs
│   └── requirements.txt         # Python dependencies
│
├── data/                        # Runtime data
│   └── mongo/                   # MongoDB WiredTiger storage files
│
├── start_all.bat                # Windows startup script
└── scan_bom.py                  # BOM scanning utility
```

---

## 4. SERVER/PORT MAP

| SERVICE | HOST | PORT | ENV VARIABLE | PURPOSE |
|---------|------|------|--------------|---------|
| Frontend | localhost | 3000 | - | Next.js web app |
| Backend | localhost | 4000 | `PORT=4000` | Express API server |
| Admin | localhost | 3001 | `ADMIN_URL` | Admin panel |
| YOLO Inference | localhost | 8000 | `YOLO_SERVICE_URL`, `YOLO_PORT` | Disease detection AI |
| Pragati AI Bridge | localhost | 8001 | `PRAGATI_AI_BRIDGE_URL`, `PAC_BRIDGE_PORT` | Root agent, intent, TTS |
| Voice Guide Bridge | localhost | 8002 | `VOICE_GUIDE_BRIDGE_URL`, `VOICE_GUIDE_BRIDGE_PORT` | Avatar dialogues |
| MongoDB | localhost | 27017 | `MONGODB_URI`, `MONGO_URI` | Database |

---

## 5. ENVIRONMENT VARIABLES

### 5.1 Backend (.env.example)
```
# Server
PORT=4000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/kisan-pragati
MONGO_URI=mongodb://localhost:27017/kisan-pragati
MONGO_DB_NAME=kisan-pragati

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# URLs
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# AI Services
OPENAI_API_KEY=your_openai_or_openrouter_key
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_BASE_URL=https://openrouter.ai/api/v1

YOLO_SERVICE_URL=http://localhost:8000
YOLO_TIMEOUT_MS=15000

PRAGATI_AI_BRIDGE_URL=http://localhost:8001
PRAGATI_AI_TIMEOUT_MS=60000

VOICE_GUIDE_BRIDGE_URL=http://localhost:8002
VOICE_GUIDE_BRIDGE_TIMEOUT_MS=8000
VOICE_GUIDE_BRIDGE_TIMEOUT_COLD_MS=15000

# External APIs
WEATHER_API_KEY=your_weather_api_key
WEATHER_API_BASE_URL=http://localhost:4000  # SELF-REFERENTIAL DEFAULT
DATA_GOV_API_KEY=your_data_gov_key
MANDI_API_KEY=your_mandi_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

### 5.2 Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDUMMY_REPLACE_WITH_REAL_KEY
NEXT_PUBLIC_MANDI_API_URL=
```

### 5.3 AI (.env)
```
# YOLO
YOLO_PORT=8000
YOLO_HOST=0.0.0.0

# Pragati AI Bridge
PAC_BRIDGE_PORT=8001

# Voice Guide Bridge
VOICE_GUIDE_BRIDGE_PORT=8002
VOICE_GUIDE_BRIDGE_HOST=0.0.0.0
```

---

## 6. DATABASE INVENTORY

### 6.1 Database Technology
- **Type**: MongoDB (WiredTiger storage engine)
- **Connection**: Mongoose ODM
- **URI**: `mongodb://localhost:27017/kisan-pragati`
- **Files**: `data/mongo/` contains actual database files

### 6.2 Collections (47 Models)

| MODEL | COLLECTION | PURPOSE |
|-------|-----------|---------|
| User | users | Authentication, profile base |
| FarmerProfileData | farmerprofiledata | Extended farmer profile |
| AgroudAnKisanCard | agroudankisancards | Kisan Card identity |
| UserSettings | usersettings | App preferences |
| DiseaseRecommendation | diseaserecommendations | Scan history |
| DiseasePestSolution | diseasepestsolutions | Knowledge base (admin-managed) |
| CropKnowledgeBase | cropknowledgebases | Crop recommendation cache |
| FarmerCropRequest | farmercroprequests | Recommendation request log |
| MyCrop | mycrops | Farmer's saved crops |
| ActiveCrop | activecrops | AI-FOS active growing crops |
| CropTask | croptasks | AI-FOS daily tasks |
| SoilReport | soilreports | Soil analysis reports |
| SoilStandard | soilstandards | Soil benchmark data |
| SoilMoisture | soilmoistures | Cached moisture data |
| FarmerMarketPreference | farmermarketpreferences | Mandi preferences |
| MarketPriceHistory | marketpricehistories | Historical mandi prices |
| GovtScheme | govtschemes | Government schemes |
| SchemeApplication | schemeapplications | Scheme applications |
| BlogPost | blogposts | Blog content |
| GalleryItem | galleryitems | Gallery images |
| KVK | kvks | Krishi Vigyan Kendra centers |
| Shop | shops | Marketplace shops |
| ShopProduct | shopproducts | Shop products |
| ShopReview | shopreviews | Shop reviews |
| ShopkeeperProfile | shopkeeperprofiles | Shopkeeper data |
| ShopAnalytics | shopanalytics | Shop analytics |
| ShopGallery | shopgalleries | Shop galleries |
| CertificateAsset | certificateassets | Certificates |
| InternCertificate | interncertificates | Intern certificates |
| TrainingDataset | trainingdatasets | ML training data |
| AIConversation | aiconversations | Pragati AI chat history |
| FarmerMemory | farmermemories | AI conversation memory |
| FarmerStory | farmerstories | Farmer success stories |
| NurseryProduct | nurseryproducts | Nursery products |
| OrganicProduct | organicproducts | Organic products |
| Marketplace | marketplaces | Marketplace listings |
| SupportRequest | supportrequests | Customer support |
| Career | careers | Career postings |
| IrrigationSchedule | irrigationschedules | Irrigation schedules |
| FertilizerProduct | fertilizerproducts | Fertilizer products |
| LanguageDictionary | languagedictionaries | Translation dictionary |
| TranslationCache | translationcaches | Translation cache |
| SpeechCacheEntry | speechcacheentries | Speech cache |
| DictionaryReviewQueue | dictionaryreviewqueues | Admin review queue |
| CropMismatchLog | cropmismatchlogs | Crop mismatch logs |
| SevaMitraProfile | seamitraprofiles | Seva Mitra profiles |
| ShopkeeperProfile | (duplicate) | Shopkeeper profiles |

---

## 7. BACKEND ROUTES (38 Route Files)

| ROUTE FILE | MOUNT PATH | AUTH | PURPOSE |
|------------|-----------|------|---------|
| auth.ts | /api/auth | No (except /me) | Login, register, OTP, Google OAuth |
| cardLogin.ts | /api/auth/card | No | Kisan Card OTP login |
| users.ts | /api/users | Yes | User management |
| admin.ts | /api/admin | Admin | Admin operations |
| crops.ts | /api/crops | Yes | Crop data |
| weather.ts | /api/weather | No | Weather data |
| mandi.ts | /api/mandi | Yes (mostly) | Market prices |
| blogs.ts | /api/blogs | No | Blog posts |
| gallery.ts | /api/gallery | No | Gallery |
| schemes.ts | /api/schemes | No | Government schemes |
| shops.ts | /api/shops | No | Marketplace shops |
| rewards.ts | /api/rewards | Yes | Rewards |
| cropRecommendation.ts | /api/crop-recommendation | Yes | AI crop recommendations |
| myCrops.ts | /api/my-crops | Yes | Farmer's crops |
| soil.ts | /api/soil | Yes | Soil health reports |
| soilMoisture.ts | /api/soil-moisture | Yes | Soil moisture data |
| irrigation.ts | /api/irrigation | Yes | Irrigation schedules |
| aiFos.ts | /api/ai-fos | Yes | AI Farm Operating System |
| aiAssistant.ts | /api/ai-assistant | Yes | Pragati AI chat |
| settings.ts | /api/settings | Yes | User settings |
| farmerProfile.ts | /api/farmer-profile | Yes | Farmer profile CRUD |
| disease.ts | /api/disease | Yes | Disease detection |
| fertilizerCalculator.ts | /api/fertilizer-calculator | Yes | Fertilizer calculation |
| farmerStories.ts | /api/farmer-stories | No | Farmer stories |
| shopkeeper.ts | /api/shopkeeper | Yes | Shopkeeper operations |
| adminShopkeeper.ts | /api/admin/shopkeeper | Admin | Admin shopkeeper |
| diseasePestSolutions.ts | /api/disease-pest-solutions | Admin | KB management |
| kvk.ts | /api/kvk | No | KVK centers |
| languageDictionary.ts | /api/language-dictionary | Admin | Translation dictionary |
| languageEngine.ts | /api/language-engine | Yes | Translation pipeline |
| memoryEngine.ts | /api/memory-engine | Yes | AI memory |
| voiceEngine.ts | /api/voice-engine | Yes | Voice processing |
| voiceGuide.ts | /api/voice-guide | Yes | Voice Guide AI |
| pragatiAI.ts | /api/pragati-ai | Yes | Pragati AI |
| support.ts | /api/support | Yes | Support requests |
| career.ts | /api/career | No | Careers |
| kisanCard.ts | /api/kisan-card | Yes | Kisan Card |
| health.ts | /api/health | No | Health check |

---

## 8. FRONTEND PAGES (App Router)

```
frontend/src/app/
├── page.tsx                    # Home page
├── layout.tsx                  # Root layout
├── auth/                       # Login/Register
│   ├── login/
│   └── register/
├── dashboard/
│   └── farmer/
│       ├── profile/            # Farmer profile
│       ├── soil-health/        # Soil health
│       ├── my-crops/           # My Crops
│       └── ...
├── disease-detection/          # DigiScan
├── crop-recommendation/        # Crop recommendations
├── weather/                    # Weather
├── mandi-prices/               # Mandi prices
├── marketplace/                # Marketplace
├── schemes/                    # Government schemes
├── gallery/                    # Gallery
├── kvk/                        # KVK centers
├── ai-assistant/               # Pragati AI chat
├── settings/                   # Settings
├── shop/                       # Shop
├── shops/                      # Shops list
├── farmer-stories/             # Farmer stories
├── careers/                    # Careers
├── contact/                    # Contact
├── about/                      # About
├── verify/                     # Verification
├── rajasthan/                  # Rajasthan-specific
└── not-found.tsx               # 404
```

---

## 9. SERVICE COMMUNICATION FLOW

```
Frontend (Next.js)
    │
    ├──→ /api/* → Backend (Express)
    │       │
    │       ├──→ MongoDB (direct)
    │       │
    │       ├──→ http://localhost:8000 → YOLO FastAPI (Disease Scan)
    │       │
    │       ├──→ http://localhost:8001 → Pragati AI Bridge (AI Assistant)
    │       │       │
    │       │       └──→ OpenAI/OpenRouter API (LLM fallback)
    │       │
    │       └──→ http://localhost:8002 → Voice Guide Bridge (Voice AI)
    │
    ├──→ External APIs (direct from frontend)
    │       ├── Google Maps
    │       └── WeatherAPI.com (via backend proxy)
    │
    └──→ External APIs (direct from backend)
            ├── data.gov.in (Mandi, Rainfall)
            ├── WeatherAPI.com
            └── OpenAI/OpenRouter
```

---

## 10. KEY ARCHITECTURAL PATTERNS

### 10.1 Authentication Flow
1. Frontend stores JWT in `localStorage` as `authToken`
2. All authenticated requests include `Authorization: Bearer <token>` header
3. Backend `authenticate` middleware validates JWT, attaches `req.user`
4. Session restore on app load via `/api/auth/me`

### 10.2 AI Pipeline Architecture
```
User Input (text/voice/image)
    ↓
Backend (/api/pragati-ai/* or /api/ai-assistant/chat)
    ↓
Pragati AI Controller (TypeScript)
    ↓
    ├── Language Engine (normalize/translate)
    ├── Intent Engine (Python ML bridge → TF-IDF+LogReg)
    ├── Root Router (routeIntent)
    │       ├── Static responses (greeting, navigation)
    │       ├── Local KB agents (disease, crop, soil, weather, market)
    │       └── LLM Fallback (OpenAI/OpenRouter) — only for 'general' intent
    ↓
Response (bilingual: english, hindi, native)
    ↓
Persist to MongoDB (AIConversation, FarmerMemory)
    ↓
Frontend displays response
```

### 10.3 Disease Detection Pipeline
```
Image Upload + Crop Selection
    ↓
Backend /api/disease/scan
    ↓
YOLO Service (http://localhost:8000)
    ↓
    ├── POST /predict (image + crop_hint)
    ├── Crop-filtered YOLOv8 inference
    └── Returns: class_name, confidence, category, top5
    ↓
Knowledge Base Lookup (DiseasePestSolution)
    ↓
    ├── Exact match on diseasePestName
    ├── aiLabel match
    ├── Aliases match
    ├── Fuzzy similarity (>= 0.55)
    └── Keyword/tag match
    ↓
Build advisory (symptoms, treatment, prevention)
    ↓
Persist to DiseaseRecommendation
    ↓
Return to frontend
```

### 10.4 Voice Guide Pipeline
```
User navigates page
    ↓
Frontend VoiceGuideContext
    ↓
Backend /api/voice-guide/initialize
    ↓
Voice Guide Bridge (http://localhost:8002)
    ↓
    ├── RuntimeManager (pygame + serial worker)
    ├── DialogueLoader (JSON dialogues)
    ├── LanguageManager (translations)
    └── TTS Engine (pyttsx3 / gTTS)
    ↓
Returns: { success, data: { runtime, avatar, page } }
    ↓
Frontend displays subtitle + avatar animation
```

---

## 11. CRITICAL ARCHITECTURAL OBSERVATIONS

### 11.1 Multi-Service Dependency
The entire platform depends on **4 local services** running simultaneously:
- MongoDB (port 27017)
- Node.js backend (port 4000)
- YOLO FastAPI (port 8000)
- Pragati AI Bridge (port 8001)
- Voice Guide Bridge (port 8002)

If any service is down, multiple features fail.

### 11.2 Self-Referential Defaults
- `WEATHER_API_BASE_URL` defaults to `http://localhost:4000` (the backend itself)
- This means if not explicitly set, weather service calls itself

### 11.3 Localhost-Only Configuration
- All AI services hardcoded to `localhost` by default
- Frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- Android WebView cannot reach `localhost:4000` from the device

### 11.4 OpenRouter as OpenAI
- `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
- `OPENAI_MODEL=openai/gpt-4o-mini`
- System uses OpenRouter, not direct OpenAI

### 11.5 MongoDB Data Files Present
- `data/mongo/` contains actual WiredTiger database files
- Database is NOT empty — production data exists locally

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
