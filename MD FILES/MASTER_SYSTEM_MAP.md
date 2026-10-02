# AGROUDAN — MASTER SYSTEM MAP

## 1. Project Overview

Agroudan (AgroUdan Kisan Pragati) is a comprehensive smart farming platform that provides:
- Farmer and Shopkeeper/Vendor dashboards
- Kisan Card management
- AI-powered crop recommendations and disease detection
- Weather, Mandi prices, Soil health monitoring
- Voice guide and language translation
- Fertilizer Calculator
- Shopkeeper marketplace
- Admin panel

**Production URL**: https://agroudankisanpragati.com
**API URL**: https://api.agroudankisanpragati.com/api

---

## 2. Repository Structure

```
companycode/
├── backend/          # Node.js + Express + MongoDB API
├── frontend/         # Next.js 14 + React 18 + Tailwind CSS — includes Capacitor Android project
├── admin/            # Next.js admin panel (kisan-unnati-admin, port 3001)
├── Ai/               # Python AI services (FastAPI, YOLO, voice guide)
├── data/             # MongoDB WiredTiger data files
├── .github/          # GitHub workflows / issue templates
└── *.md              # 17 forensic documentation files
```

---

## 3. Complete Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14.2.35, React 18.3.1, Tailwind CSS 3.3 |
| Backend | Node.js, Express, Mongoose ODM |
| Database | MongoDB (Mongoose) |
| Authentication | JWT (jsonwebtoken), bcrypt |
| Mobile | Capacitor 8.5.0 |
| AI | Custom AI services, YOLO disease detection |
| Voice | Custom voice guide and language engine |
| Build | Webpack, SWC minification |

---

## 4. Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js)                         │
│              https://agroudankisanpragati.com                │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Farmer     │  │  Shopkeeper │  │    Admin    │         │
│  │  Dashboard   │  │  Dashboard  │  │   Panel     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express)                          │
│              https://api.agroudankisanpragati.com/api        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Routes                            │    │
│  │  auth.ts │ farmerProfile.ts │ shopkeeper.ts │ ...   │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Middleware                           │    │
│  │  authenticate │ authorize │ upload │ validate        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE (MongoDB)                       │
│                                                              │
│  users │ farmerprofiledata │ agroudankisancards │ ...       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Frontend Architecture

### 5.1 Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages |
| `src/components/` | Reusable UI components |
| `src/services/` | API service functions |
| `src/context/` | React context (AuthContext) |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Utility functions, API_BASE |
| `src/styles/` | Global styles |
| `src/i18n/` | Internationalization |

### 5.2 API Configuration

**File**: `frontend/src/lib/backend.ts`
```typescript
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
```

**Environment Variable**: `NEXT_PUBLIC_API_URL`

---

## 6. Backend Architecture

### 6.1 Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/index.ts` | Server entry point |
| `src/routes/` | API route definitions |
| `src/models/` | Mongoose models |
| `src/middleware/` | Auth, upload, validation |
| `src/services/` | Business logic |
| `src/config/` | Database, environment config |

### 6.2 Server Entry

**File**: `backend/src/index.ts`
- Express server initialization
- MongoDB connection via `connectDB()`
- Route mounting
- CORS configuration
- Error handling

---

## 7. Android / Capacitor Architecture

### 7.1 Configuration

**File**: `frontend/capacitor.config.ts`
```typescript
const config: CapacitorConfig = {
  appId: 'com.agroudankisanpragati.app',
  appName: 'AgroudAn Kisan Pragati',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'https://agroudankisanpragati.com',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#10b981',
      showSpinner: false,
    },
  },
};
```

### 7.2 Build Flow

```
frontend/out/ → Capacitor Sync → android/app/src/main/assets/public → APK
```

---

## 8. Database Master Map

### 8.1 Database Connection

| Property | Value |
|----------|-------|
| Technology | MongoDB |
| ODM | Mongoose |
| Connection File | `backend/src/config/database.ts` |
| Environment Variable | `MONGODB_URI` |
| Default Database | `kisan-pragati` |

### 8.2 Complete Database Models (50 Total)

| # | Model | File | Collection | Main Purpose |
|---|-------|------|------------|--------------|
| 1 | User | `User.ts` | `users` | Authentication, user profiles |
| 2 | FarmerProfileData | `FarmerProfileData.ts` | `farmerprofiledata` | Extended farmer profile |
| 3 | AgroudAnKisanCard | `AgroudAnKisanCard.ts` | `agroudankisancards` | Kisan Card data |
| 4 | UserSettings | `UserSettings.ts` | `usersettings` | User preferences |
| 5 | DiseasePestSolution | `DiseasePestSolution.ts` | `diseasepestsolutions` | Disease solutions KB |
| 6 | DiseaseRecommendation | `DiseaseRecommendation.ts` | `diseaserecommendations` | Disease scan results |
| 7 | AIConversation | `AIConversation.ts` | `aiconversations` | AI chat history |
| 8 | AIRecommendation | `AIRecommendation.ts` | `airecommendations` | AI recommendations |
| 9 | FarmerMemory | `FarmerMemory.ts` | `farmermemories` | AI context memory |
| 10 | CropRecommendation | `CropRecommendation.ts` | `croprecommendations` | Crop suggestions |
| 11 | CropKnowledgeBase | `CropKnowledgeBase.ts` | `cropknowledgebases` | Crop KB |
| 12 | CropTask | `CropTask.ts` | `croptasks` | Crop tasks |
| 13 | CropMismatchLog | `CropMismatchLog.ts` | `cropmismatchlogs` | Crop mismatch logs |
| 14 | ActiveCrop | `ActiveCrop.ts` | `activecrops` | Active crops |
| 15 | MyCrop | `MyCrop.ts` | `mycrops` | User crops |
| 16 | FarmerCropRequest | `FarmerCropRequest.ts` | `farmercroprequests` | Crop requests |
| 17 | FarmerMarketPreference | `FarmerMarketPreference.ts` | `farmermarketpreferences` | Market preferences |
| 18 | FarmerStory | `FarmerStory.ts` | `farmerstories` | Farmer stories |
| 19 | SoilMoisture | `SoilMoisture.ts` | `soilmoistures` | Soil moisture data |
| 20 | SoilReport | `SoilReport.ts` | `soilreports` | Soil reports |
| 21 | SoilStandard | `SoilStandard.ts` | `soilstandards` | Soil standards |
| 22 | IrrigationSchedule | `IrrigationSchedule.ts` | `irrigationschedules` | Irrigation schedules |
| 23 | FertilizerProduct | `FertilizerProduct.ts` | `fertilizerproducts` | Fertilizer products |
| 24 | Shop | `Shop.ts` | `shops` | Shop data |
| 25 | ShopkeeperProfile | `ShopkeeperProfile.ts` | `shopkeeperprofiles` | Shopkeeper profiles |
| 26 | ShopProduct | `ShopProduct.ts` | `shopproducts` | Shop products |
| 27 | ShopAnalytics | `ShopAnalytics.ts` | `shopanalytics` | Shop analytics |
| 28 | ShopGallery | `ShopGallery.ts` | `shopgalleries` | Shop gallery |
| 29 | ShopReview | `ShopReview.ts` | `shopreviews` | Shop reviews |
| 30 | Marketplace | `Marketplace.ts` | `marketplaces` | Marketplace |
| 31 | MarketPriceHistory | `MarketPriceHistory.ts` | `marketpricehistories` | Price history |
| 32 | NurseryProduct | `NurseryProduct.ts` | `nurseryproducts` | Nursery products |
| 33 | OrganicProduct | `OrganicProduct.ts` | `organicproducts` | Organic products |
| 34 | BlogPost | `BlogPost.ts` | `blogposts` | Blog posts |
| 35 | GalleryItem | `GalleryItem.ts` | `galleryitems` | Gallery items |
| 36 | GovtScheme | `GovtScheme.ts` | `govtschemes` | Government schemes |
| 37 | SchemeApplication | `SchemeApplication.ts` | `schemeapplications` | Scheme applications |
| 38 | KVK | `KVK.ts` | `kvks` | KVK data |
| 39 | InternCertificate | `InternCertificate.ts` | `interncertificates` | Intern certificates |
| 40 | CertificateAsset | `CertificateAsset.ts` | `certificateassets` | Certificate assets |
| 41 | SevaMitraProfile | `SevaMitraProfile.ts` | `sevatramitra` | Seva Mitra profiles |
| 42 | SupportRequest | `SupportRequest.ts` | `supportrequests` | Support requests |
| 43 | LanguageDictionary | `LanguageDictionary.ts` | `languagedictionaries` | Language translations |
| 44 | TranslationCache | `TranslationCache.ts` | `translationcaches` | Translation cache |
| 45 | SpeechCacheEntry | `SpeechCacheEntry.ts` | `speechentries` | Speech cache |
| 46 | DictionaryReviewQueue | `DictionaryReviewQueue.ts` | `dictionaryreviewqueues` | Dictionary review |
| 47 | TrainingDataset | `TrainingDataset.ts` | `trainingdatasets` | AI training data |

---

## 9. Database → Feature Mapping

| Feature | Database Models |
|---------|-----------------|
| Authentication | User, UserSettings |
| Farmer Profile | User, FarmerProfileData |
| Kisan Card | AgroudAnKisanCard, User |
| Disease Detection | DiseasePestSolution, DiseaseRecommendation |
| AI Assistant | AIConversation, AIRecommendation, FarmerMemory |
| Crop Recommendation | CropRecommendation, CropKnowledgeBase, CropTask |
| My Crops | MyCrop, ActiveCrop, FarmerCropRequest |
| Soil Health | SoilMoisture, SoilReport, SoilStandard |
| Irrigation | IrrigationSchedule |
| Fertilizer Calculator | FertilizerProduct |
| Shopkeeper | Shop, ShopkeeperProfile, ShopProduct, ShopAnalytics |
| Marketplace | Marketplace, MarketPriceHistory |
| Blog | BlogPost |
| Gallery | GalleryItem |
| Schemes | GovtScheme, SchemeApplication |
| Voice | LanguageDictionary, TranslationCache, SpeechCacheEntry |

---

## 10. Complete API Master Map

### 10.1 API Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.agroudankisanpragati.com/api` |
| Development | `http://localhost:4000/api` |
| Android Capacitor | `https://agroudankisanpragati.com` |

### 10.2 API Routes (38 Route Files)

| Route File | Base Path | Main Endpoints |
|------------|-----------|----------------|
| `auth.ts` | `/api/auth` | login, register, me, google |
| `cardLogin.ts` | `/api/auth/card` | request-otp, verify-otp |
| `farmerProfile.ts` | `/api/farmer-profile` | GET, PUT, avatar, farm, land, crop |
| `kisanCard.ts` | `/api/kisan-card` | status, GET, POST, PUT, admin |
| `shopkeeper.ts` | `/api/shopkeeper` | profile, products, marketplace |
| `shops.ts` | `/api/shops` | public shop listing |
| `disease.ts` | `/api/disease` | scan, history, translate, feedback |
| `pragatiAI.ts` | `/api/pragati-ai` | text, voice, image, history, stats |
| `aiAssistant.ts` | `/api/ai-assistant` | chat, dashboard-context |
| `aiFos.ts` | `/api/ai-fos` | FOS AI endpoints |
| `cropRecommendation.ts` | `/api/crop-recommendation` | recommend, history |
| `myCrops.ts` | `/api/my-crops` | CRUD operations |
| `fertilizerCalculator.ts` | `/api/fertilizer-calculator` | calculate |
| `soil.ts` | `/api/soil` | reports, standards |
| `soilMoisture.ts` | `/api/soil-moisture` | data, history |
| `irrigation.ts` | `/api/irrigation` | schedule, recommendations |
| `weather.ts` | `/api/weather` | current, forecast |
| `mandi.ts` | `/api/mandi` | prices, history |
| `schemes.ts` | `/api/schemes` | list, apply |
| `rewards.ts` | `/api/rewards` | points, history |
| `blogs.ts` | `/api/blogs` | CRUD |
| `gallery.ts` | `/api/gallery` | items |
| `kvk.ts` | `/api/kvk` | KVK data |
| `voiceGuide.ts` | `/api/voice-guide` | initialize, play, status |
| `voiceEngine.ts` | `/api/voice-engine` | TTS, STT |
| `languageEngine.ts` | `/api/language-engine` | translate, detect, pipeline |
| `languageDictionary.ts` | `/api/language-dictionary` | dictionary |
| `memoryEngine.ts` | `/api/memory-engine` | memory |
| `settings.ts` | `/api/settings` | GET, PUT, reset, change-password |
| `users.ts` | `/api/users` | admin user management |
| `admin.ts` | `/api/admin` | admin operations |
| `adminShopkeeper.ts` | `/api/admin/shopkeeper` | admin shopkeeper mgmt |
| `career.ts` | `/api/career` | internships, certificates |
| `support.ts` | `/api/support` | support tickets |
| `health.ts` | `/api/health` | health check |

---

## 11. Authentication Master Trace

### 11.1 Login Flow

```
Frontend Login Page
    ↓
AuthContext.login(email, password, role)
    ↓
POST /api/auth/login
    ↓
Backend: auth.ts (line 281)
    ↓
User.findOne({ email, role })
    ↓
bcrypt.compare(password, user.password)
    ↓
JWT.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
    ↓
Response: { token, user }
    ↓
Frontend: localStorage.setItem('authToken', token)
    ↓
Redirect to Dashboard
```

### 11.2 Session Restoration

```
App Load
    ↓
AuthContext.restoreSession()
    ↓
localStorage.getItem('authToken')
    ↓
GET /api/auth/me (with Authorization header)
    ↓
Backend: authenticate middleware
    ↓
JWT.verify(token, JWT_SECRET)
    ↓
User.findById(userId)
    ↓
Response: { success, data: user }
    ↓
Update React state
```

### 11.3 Authentication Models

| Model | Collection | Purpose |
|-------|------------|---------|
| User | `users` | Primary authentication |
| AgroudAnKisanCard | `agroudankisancards` | Card-based login |

### 11.4 JWT Configuration

| Property | Value |
|----------|-------|
| Secret Variable | `JWT_SECRET` |
| Expires In | `30d` |
| Storage Key | `authToken` |
| Header Format | `Authorization: Bearer <token>` |

---

## 12. Farmer Flow

```
Landing Page
    ↓
Login/Register
    ↓
Role Selection (farmer/vendor)
    ↓
Farmer Dashboard
    ├── Profile
    │   ├── View/Edit Profile
    │   ├── Farm Management
    │   ├── Land Parcels
    │   └── Crop History
    ├── Kisan Card
    │   ├── Card Status
    │   ├── Card Application
    │   └── Card Login (OTP)
    ├── Crop Recommendations
    ├── Disease Detection
    ├── My Crops
    ├── Fertilizer Calculator
    ├── Weather
    ├── Mandi Prices
    ├── Soil Health
    ├── Irrigation
    ├── AI Assistant
    ├── Voice Guide
    ├── Schemes
    ├── Rewards
    └── Settings
```

---

## 13. Shopkeeper/Vendor Flow

```
Login/Register (role: vendor)
    ↓
Shopkeeper Dashboard
    ├── Profile
    ├── Products
    │   ├── Fertilizer Products
    │   └── Nursery Products
    ├── Orders
    ├── Analytics
    ├── Gallery
    └── Settings
```

---

## 14. Kisan Card Complete Trace

### 14.1 Frontend Components

| File | Purpose |
|------|---------|
| `src/services/kisanCard.ts` | API service |
| `src/components/farmer/profile/KisanCardSection.tsx` | Profile section |
| `src/components/dashboard/DashboardKisanCard.tsx` | Dashboard widget |
| `src/components/KisanSaathiInit.tsx` | Initialization |

### 14.2 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/kisan-card/status` | Check card status |
| GET | `/api/kisan-card` | Get card details |
| POST | `/api/kisan-card` | Create card |
| PUT | `/api/kisan-card` | Update card |
| POST | `/api/auth/card/request-otp` | Request OTP |
| POST | `/api/auth/card/verify-otp` | Verify OTP |

### 14.3 Database Model

| Property | Value |
|----------|-------|
| Model | `AgroudAnKisanCard` |
| File | `backend/src/models/AgroudAnKisanCard.ts` |
| Collection | `agroudankisancards` |
| Key Fields | userId, cardNumber, cardStatus, fullName, location, agriculture |

---

## 15. Fertilizer Calculator Trace

### 15.1 Frontend

| File | Purpose |
|------|---------|
| `src/app/dashboard/farmer/fertilizer-calculator/page.tsx` | Calculator page |
| `src/services/fertilizerCalculator.ts` | API service |

### 15.2 Backend

| File | Purpose |
|------|---------|
| `backend/src/routes/fertilizerCalculator.ts` | Route handler |
| `backend/src/models/FertilizerProduct.ts` | Product database |

### 15.3 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/fertilizer-calculator/calculate` | Calculate fertilizer |
| GET | `/api/fertilizer-calculator/products` | Get products |

---

## 16. Frontend Route Map

### 16.1 Public Routes

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/` | page.tsx | No | Landing page |
| `/about` | about/page.tsx | No | About page |
| `/contact` | contact/page.tsx | No | Contact page |
| `/careers` | careers/page.tsx | No | Careers page |
| `/gallery` | gallery/page.tsx | No | Gallery |
| `/blog` | blog/page.tsx | No | Blog listing |
| `/blog/slug` | blog/slug/page.tsx | No | Blog post |
| `/schemes` | schemes/page.tsx | No | Government schemes |
| `/kvk` | kvk/page.tsx | No | KVK information |
| `/weather` | weather/page.tsx | No | Weather |
| `/mandi-prices` | mandi-prices/page.tsx | No | Mandi prices |
| `/soil-health` | soil-health/page.tsx | No | Soil health |
| `/crop-recommendation` | crop-recommendation/page.tsx | No | Crop recommendation |
| `/disease-detection` | disease-detection/page.tsx | No | Disease detection |
| `/marketplace` | marketplace/page.tsx | No | Marketplace |
| `/marketplace/shops` | marketplace/shops/page.tsx | No | Shop listing |
| `/shops/id` | shops/id/page.tsx | No | Shop details |
| `/shop/id` | shop/id/page.tsx | No | Shop page |

### 16.2 Authentication Routes

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/auth` | auth/page.tsx | No | Auth landing |
| `/auth/login` | auth/login/page.tsx | No | Login |
| `/auth/register` | auth/register/page.tsx | No | Register |
| `/auth/role-select` | auth/role-select/page.tsx | No | Role selection |
| `/auth/oauth-redirect` | auth/oauth-redirect/page.tsx | No | OAuth redirect |

### 16.3 Protected Routes (Farmer)

| Route | Component | Auth | Role | Purpose |
|-------|-----------|------|------|---------|
| `/dashboard/farmer` | dashboard/farmer/page.tsx | Yes | farmer | Farmer dashboard |
| `/dashboard/farmer/profile` | dashboard/farmer/profile/page.tsx | Yes | farmer | Profile |
| `/dashboard/farmer/edit-profile` | dashboard/farmer/edit-profile/page.tsx | Yes | farmer | Edit profile |
| `/dashboard/farmer/my-crops` | dashboard/farmer/my-crops/page.tsx | Yes | farmer | My crops |
| `/dashboard/farmer/fertilizer-calculator` | dashboard/farmer/fertilizer-calculator/page.tsx | Yes | farmer | Fertilizer calc |
| `/dashboard/farmer/crop-health` | dashboard/farmer/crop-health/page.tsx | Yes | farmer | Crop health |
| `/dashboard/farmer/soil-health` | dashboard/farmer/soil-health/page.tsx | Yes | farmer | Soil health |
| `/dashboard/farmer/market` | dashboard/farmer/market/page.tsx | Yes | farmer | Market |
| `/dashboard/farmer/tasks` | dashboard/farmer/tasks/page.tsx | Yes | farmer | Tasks |
| `/dashboard/farmer/rewards` | dashboard/farmer/rewards/page.tsx | Yes | farmer | Rewards |
| `/dashboard/farmer/recommendations` | dashboard/farmer/recommendations/page.tsx | Yes | farmer | Recommendations |
| `/dashboard/farmer/activities` | dashboard/farmer/activities/page.tsx | Yes | farmer | Activities |
| `/dashboard/farmer/ai-suggestions` | dashboard/farmer/ai-suggestions/page.tsx | Yes | farmer | AI suggestions |

### 16.4 Protected Routes (Shopkeeper)

| Route | Component | Auth | Role | Purpose |
|-------|-----------|------|------|---------|
| `/dashboard/shopkeeper` | dashboard/shopkeeper/page.tsx | Yes | vendor | Shopkeeper dashboard |
| `/dashboard/shopkeeper/profile` | dashboard/shopkeeper/profile/page.tsx | Yes | vendor | Profile |
| `/dashboard/shopkeeper/edit-profile` | dashboard/shopkeeper/edit-profile/page.tsx | Yes | vendor | Edit profile |
| `/dashboard/shopkeeper/complete-profile` | dashboard/shopkeeper/complete-profile/page.tsx | Yes | vendor | Complete profile |
| `/dashboard/shopkeeper/products` | dashboard/shopkeeper/products/page.tsx | Yes | vendor | Products |
| `/dashboard/shopkeeper/products/fertilizer` | dashboard/shopkeeper/products/fertilizer/page.tsx | Yes | vendor | Fertilizer products |
| `/dashboard/shopkeeper/products/fertilizer/create` | dashboard/shopkeeper/products/fertilizer/create/page.tsx | Yes | vendor | Create fertilizer |
| `/dashboard/shopkeeper/products/nursery` | dashboard/shopkeeper/products/nursery/page.tsx | Yes | vendor | Nursery products |
| `/dashboard/shopkeeper/products/nursery/create` | dashboard/shopkeeper/products/nursery/create/page.tsx | Yes | vendor | Create nursery |

### 16.5 Admin Routes

| Route | Component | Auth | Role | Purpose |
|-------|-----------|------|------|---------|
| `/admin` | admin/page.tsx | Yes | admin | Admin dashboard |
| `/admin/schemes` | admin/schemes/page.tsx | Yes | admin | Manage schemes |

---

## 17. Environment Variable Map

### 17.1 Frontend Environment Variables

| Variable | Purpose | File |
|----------|---------|------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `.env.local` |

### 17.2 Backend Environment Variables

| Variable | Purpose | File |
|----------|---------|------|
| `MONGODB_URI` | MongoDB connection string | `.env` |
| `JWT_SECRET` | JWT signing secret | `.env` |
| `PORT` | Server port | `.env` |
| `NODE_ENV` | Environment mode | `.env` |
| `OPENWEATHER_API_KEY` | Weather API key | `.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `.env` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `.env` |

---

## 18. CORS / Network Configuration

### 18.1 Backend CORS

**File**: `backend/src/index.ts`

Allowed Origins:
- `https://agroudankisanpragati.com`
- `https://admin.agroudankisanpragati.com`
- `http://localhost:3000` (development)
- `http://localhost:4000` (development)

### 18.2 Frontend API Flow

| Environment | API URL | Flow |
|-------------|---------|------|
| Web Production | `https://api.agroudankisanpragati.com/api` | Direct |
| Web Development | `/api` (relative) | Next.js rewrite |
| Android Capacitor | `https://agroudankisanpragati.com` | WebView |

---

## 19. External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| OpenWeatherMap | Weather data | `OPENWEATHER_API_KEY` |
| Google OAuth | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| YOLO | Disease detection | Backend service |
| Cloudinary | Image storage | Upload config |

---

## 20. Android / Capacitor Configuration

### 20.1 Capacitor Config

| Property | Value |
|----------|-------|
| appId | `com.agroudankisanpragati.app` |
| appName | `AgroudAn Kisan Pragati` |
| webDir | `out` |
| androidScheme | `https` |
| server.url | `https://agroudankisanpragati.com` |

### 20.2 Build Output

| File | Path |
|------|------|
| Debug APK | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Web Assets | `frontend/out/` |

---

## 21. Documentation vs Source-Code Conflicts

| MD Claim | Actual Source | Status |
|----------|---------------|--------|
| Database: `kisan-pragati` | Confirmed in `backend/src/config/database.ts` | ✓ Correct |
| API_BASE: `http://localhost:4000/api` | Confirmed in `frontend/src/lib/backend.ts` | ✓ Correct |
| JWT expires: `30d` | Confirmed in `backend/src/routes/auth.ts` | ✓ Correct |
| User model fields | Confirmed in `backend/src/models/User.ts` | ✓ Correct |

---

## 22. Known Issues / Risks

1. **Dynamic Route Export**: Dynamic routes with `[param]` syntax require `generateStaticParams()` for static export
2. **Search Params**: Pages using `searchParams` cannot be statically exported without modification
3. **Force Dynamic**: Pages with `export const dynamic = 'force-dynamic'` cannot be statically exported
4. **Localhost References**: Some services may still reference `localhost:4000`

---

## 23. Current Working Components

- ✅ Authentication (login, register, JWT)
- ✅ Farmer Dashboard
- ✅ Shopkeeper Dashboard
- ✅ Kisan Card
- ✅ Disease Detection
- ✅ AI Assistant
- ✅ Crop Recommendation
- ✅ Fertilizer Calculator
- ✅ Weather
- ✅ Mandi Prices
- ✅ Soil Health
- ✅ Voice Guide
- ✅ Frontend Build (static export)
- ✅ Android APK Build

---

## 24. Source-of-Truth Rules

1. **Actual production backend source code** is authoritative over documentation
2. **Actual database models/schemas** are authoritative over documentation
3. **Actual frontend source code** is authoritative over documentation
4. **Actual environment/configuration** is authoritative over documentation
5. **Actual Android/Capacitor configuration** is authoritative over documentation
6. **Existing MD forensic documents** are reference only and may be outdated

If an MD file conflicts with source code, **SOURCE CODE WINS**.

---

## 25. Final System Dependency Graph

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                   │
│  Next.js 14 + React 18 + Tailwind CSS                            │
│  API: /api/* → Next.js Rewrite → Backend                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND                                    │
│  Node.js + Express + Mongoose                                     │
│  Routes: 38 files                                                │
│  Models: 50 files                                                │
│  Middleware: auth, upload, validate                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        DATABASE                                    │
│  MongoDB                                                          │
│  Database: kisan-pragati                                         │
│  Collections: 50+                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

*Generated: 2026-08-28*
*Source: Actual codebase analysis*
*Status: Master System Map Complete*
