# COMPANYCODE — DATABASE MAP
## Forensic Analysis — Phase 1 Only — No Code Modification

---

## 1. DATABASE CONNECTION

**File**: `backend/src/config/database.ts`
```typescript
const mongoURI = process.env.MONGODB_URI;
await mongoose.connect(mongoURI);
```

**Environment Variable**: `MONGODB_URI` (or `MONGO_URI`)
**Default**: `mongodb://localhost:27017/kisan-pragati`
**Database Name**: `kisan-pragati`
**Connection Established At**: Backend startup (`startServer()` → `connectDB()`)

**Physical Location**: `data/mongo/` — Contains actual WiredTiger storage files

---

## 2. MODEL → SERVICE → CONTROLLER → ROUTE → FRONTEND MAP

### 2.1 Authentication Models

#### User
- **Model**: `backend/src/models/User.ts`
- **Collection**: `users`
- **Fields**: name, email, phone, password, profileImage, farmSize, companyName, businessType, location (country, state, district, village, coordinates), soilType, waterSource, role (farmer/vendor/admin), authProvider, googleId, crops, points, verified, isActive, lastLogin
- **Indexes**: `{ email: 1, role: 1 }` (unique)
- **Service**: Direct use in `auth.ts`, `middleware/auth.ts`
- **Controller/Routes**: 
  - `POST /api/auth/login` — `auth.ts:281`
  - `POST /api/auth/register` — `auth.ts:201`
  - `GET /api/auth/me` — `auth.ts:319`
  - `GET /api/auth/google` — `auth.ts:336`
  - `GET /api/auth/google/callback` — `auth.ts:357`
  - `POST /api/auth/card/request-otp` — `cardLogin.ts:56`
  - `POST /api/auth/card/verify-otp` — `cardLogin.ts:111`
- **Frontend Service**: `frontend/src/services/cardLogin.ts`, `frontend/src/context/AuthContext.tsx`
- **Frontend Component**: Login page, Register page

#### FarmerProfileData
- **Model**: `backend/src/models/FarmerProfileData.ts`
- **Collection**: `farmerprofiledata`
- **Fields**: userId (unique), village, pincode, dateOfBirth, gender, age, education, experience, address, tehsil, district, state, languagePreference, farmName, totalArea, farmingType, farmingMethod, irrigationType, waterAvailability, soilType, organicCertified, farmDetails[], landParcels[], cropHistory[], appLanguage, voiceEnabled, notificationLanguage
- **Service**: Direct use in `farmerProfile.ts`
- **Controller/Routes**:
  - `GET /api/farmer-profile` — `farmerProfile.ts:35`
  - `PUT /api/farmer-profile` — `farmerProfile.ts:53`
  - `POST /api/farmer-profile/avatar` — `farmerProfile.ts:111`
  - `POST /api/farmer-profile/farm` — `farmerProfile.ts:155`
  - `PUT /api/farmer-profile/farm/:farmId` — `farmerProfile.ts:169`
  - `DELETE /api/farmer-profile/farm/:farmId` — `farmerProfile.ts:185`
  - `POST /api/farmer-profile/land` — `farmerProfile.ts:201`
  - `PUT /api/farmer-profile/land/:parcelId` — `farmerProfile.ts:215`
  - `DELETE /api/farmer-profile/land/:parcelId` — `farmerProfile.ts:231`
  - `POST /api/farmer-profile/crop` — `farmerProfile.ts:247`
  - `PUT /api/farmer-profile/crop/:cropId` — `farmerProfile.ts:261`
  - `DELETE /api/farmer-profile/crop/:cropId` — `farmerProfile.ts:277`
  - `DELETE /api/farmer-profile/account` — `farmerProfile.ts:293`
- **Frontend Service**: `frontend/src/services/farmerProfile.ts`
- **Frontend Component**: Profile page, Dashboard

#### AgroudAnKisanCard
- **Model**: `backend/src/models/AgroudAnKisanCard.ts`
- **Collection**: `agroudankisancards`
- **Fields**: userId (unique), cardNumber (unique), cardStatus (active/pending/suspended), fullName, fatherName, gender, dateOfBirth, mobileNumber, personalIncome, familyIncome, location (country, state, district, tehsil, village, pincode, coordinates), agriculture (totalLandArea, landUnit, farmingCategory, annualIncomeRange), otherBusiness (hasOtherBusiness, businessType, businessDetails), isComplete
- **Service**: Direct use in `cardLogin.ts`, `kisanCard.ts`
- **Controller/Routes**:
  - `POST /api/auth/card/request-otp` — `cardLogin.ts:56`
  - `POST /api/auth/card/verify-otp` — `cardLogin.ts:111`
  - `GET /api/kisan-card/status` — `kisanCard.ts:169`
  - `GET /api/kisan-card` — `kisanCard.ts:188`
  - `POST /api/kisan-card` — `kisanCard.ts:202`
  - `PUT /api/kisan-card` — `kisanCard.ts:283`
  - `GET /api/kisan-card/admin/user/:userId` — `kisanCard.ts:318`
  - `PUT /api/kisan-card/admin/user/:userId` — `kisanCard.ts:334`
- **Frontend Service**: `frontend/src/services/cardLogin.ts`, `frontend/src/services/kisanCard.ts`
- **Frontend Component**: Card login page, Kisan Card page

#### UserSettings
- **Model**: `backend/src/models/UserSettings.ts`
- **Collection**: `usersettings`
- **Fields**: userId, appLanguage, notificationsEnabled, voiceEnabled, notificationLanguage, theme, etc.
- **Service**: Direct use in `settings.ts`
- **Controller/Routes**:
  - `GET /api/settings` — `settings.ts:10`
  - `PUT /api/settings` — `settings.ts:25`
  - `POST /api/settings/reset` — `settings.ts:43`
  - `POST /api/settings/change-password` — `settings.ts:58`
- **Frontend Service**: `frontend/src/services/settings.ts`, `frontend/src/services/farmerProfile.ts`
- **Frontend Component**: Settings page

### 2.2 Disease Detection Models

#### DiseasePestSolution
- **Model**: `backend/src/models/DiseasePestSolution.ts`
- **Collection**: `diseasepestsolutions`
- **Fields**: cropName, recordType (Disease/Pest/Deficiency/Healthy), diseasePestName, aiLabel, aliases, severity, displayName ({en, hi}), description, symptoms, organicSolution, chemicalSolution, urgentPrevention, recoveryTips, preventiveMeasures, dos, donts, recommendedProducts, farmerAdvice, referenceImages[], tags[], keywords[], status (draft/published)
- **Indexes**: `{ cropName: 1, diseasePestName: 1 }` (unique)
- **Service**: `diseaseService.ts` — `findDiseaseKnowledge()`, `getAdvisoryFromKnowledgeBase()`
- **Controller/Routes**:
  - `GET /api/disease/supported-crops` — `disease.ts:46`
  - `POST /api/disease/scan` — `disease.ts:60`
  - `GET /api/disease/history` — `disease.ts:246`
  - `POST /api/disease/translate` — `disease.ts:263`
  - `POST /api/disease/feedback` — `disease.ts:309`
  - `GET /api/disease/admin/recommendations` — `disease.ts:334`
- **Frontend Service**: `frontend/src/services/speechPipeline.ts` (not directly)
- **Frontend Component**: Disease Detection page

#### DiseaseRecommendation
- **Model**: `backend/src/models/DiseaseRecommendation.ts`
- **Collection**: `diseaserecommendations`
- **Fields**: userId, cropName, diseaseName, diseaseType, severityLevel, symptoms, organicTreatment, chemicalTreatment, treatment, prevention, description, recommendedActions, urgentPrevention, recoveryTips, dos, donts, recommendedProducts, recommendedFertilizer, recommendedBioProduct, recommendedOrganicProduct, extraFarmerAdvice, suitableWeather, diseaseImages[], tags[], confidenceScore, imageUrl, source (cache/knowledge_base/ai/yolo), predictionSource, yoloTop5[], similarityScore, knowledgeBaseId, feedback, comment, correctDisease, translations
- **Indexes**: `{ cropName: 1, diseaseName: 1 }`
- **Service**: `diseaseService.ts` — `searchCache()`, `runHybridDiseaseDetection()`, `autoSaveToKnowledgeBase()`, `handleFeedbackForKB()`
- **Controller/Routes**:
  - Same as DiseasePestSolution routes above
- **Frontend Service**: Disease detection page components
- **Frontend Component**: Disease Detection page, Scan Result page

### 2.3 Crop/Soil Models

#### CropKnowledgeBase
- **Model**: `backend/src/models/CropKnowledgeBase.ts`
- **Collection**: `cropknowledgebases`
- **Fields**: cropName, cropCategory, soilType, soilPH, waterAvailability, district, state, season, suitabilityScore, aiRecommendation, waterRequirement, cultivationCost, averageYield, expectedYield, estimatedProfit, marketPrice, marketDemand, riskLevel, diseaseRisks, cultivationProcess, description, growingDuration, fertilizerRequirement, fertilizerCost, seedRequirement, recommendedSeedVariety, sourceType, source, createdBy, status
- **Service**: `recommendationEngine.ts`, `similaritySearch.ts`
- **Controller/Routes**:
  - `POST /api/crop-recommendation` — `cropRecommendation.ts:71`
  - `GET /api/crop-recommendation/history` — `cropRecommendation.ts:161`
  - `GET /api/crop-recommendation/:id` — `cropRecommendation.ts:209`
  - `POST /api/crop-recommendation/translate` — `cropRecommendation.ts:228`
- **Frontend Service**: `frontend/src/services/cropRecommendation.ts`
- **Frontend Component**: Crop Recommendation page

#### FarmerCropRequest
- **Model**: `backend/src/models/FarmerCropRequest.ts`
- **Collection**: `farmercroprequests`
- **Fields**: farmerId, farmArea, areaUnit, state, district, village, soilType, soilPH, organicCarbon, nitrogen, phosphorus, potassium, ecValue, waterAvailability, irrigationType, rainfall, averageTemperature, season, farmingType, budget, previousCrop, preferredCrop, translations
- **Service**: `recommendationEngine.ts`, `openaiService.ts`
- **Controller/Routes**: Same as CropKnowledgeBase routes
- **Frontend Service**: `cropRecommendation.ts`
- **Frontend Component**: Crop Recommendation page

#### MyCrop
- **Model**: `backend/src/models/MyCrop.ts`
- **Collection**: `mycrops`
- **Fields**: userId, cropName, image, category, description, cultivationGuide, suitabilityScore, estimatedYield, estimatedCultivationCost, expectedRevenue, expectedProfit, waterRequirement, fertilizerRequirement, fertilizerCost, seedRequirement, recommendedSeedVariety, currentMarketPrice, marketDemand, riskLevel, recommendationSource, dateAdded, status
- **Service**: Direct use in `myCrops.ts`, `aiFos.ts`
- **Controller/Routes**:
  - `POST /api/my-crops` — `myCrops.ts:8`
  - `GET /api/my-crops` — `myCrops.ts:19`
  - `GET /api/my-crops/:id` — `myCrops.ts:30`
  - `DELETE /api/my-crops/:id` — `myCrops.ts:42`
- **Frontend Service**: `frontend/src/services/myCrops.ts`
- **Frontend Component**: My Crops page

#### ActiveCrop
- **Model**: `backend/src/models/ActiveCrop.ts`
- **Collection**: `activecrops`
- **Fields**: farmerId, myCropId, cropName, fieldLabel, sowingDate, growingDurationDays, currentStage, progressPercent, isHarvested, harvestDate, aiRecommendation, aiRecommendationTranslations
- **Service**: `aiFosEngine.ts`
- **Controller/Routes**:
  - `POST /api/ai-fos/activate` — `aiFos.ts:37`
  - `GET /api/ai-fos/active-crops` — `aiFos.ts:189`
  - `DELETE /api/ai-fos/active-crops/:id` — `aiFos.ts:239`
- **Frontend Service**: `frontend/src/services/aiFos.ts`
- **Frontend Component**: Farm Manager / AI-FOS dashboard

#### CropTask
- **Model**: `backend/src/models/CropTask.ts`
- **Collection**: `croptasks`
- **Fields**: farmerId, activeCropId, cropName, dayNumber, scheduledDate, title, description, taskType, status (pending/done/skipped), completedAt
- **Service**: `aiFosEngine.ts`
- **Controller/Routes**:
  - `GET /api/ai-fos/tasks/:activeCropId` — `aiFos.ts:224`
  - `PATCH /api/ai-fos/tasks/:taskId` — `aiFos.ts:201`
- **Frontend Service**: `frontend/src/services/aiFos.ts`
- **Frontend Component**: Farm Manager tasks

#### SoilReport
- **Model**: `backend/src/models/SoilReport.ts`
- **Collection**: `soilreports`
- **Fields**: farmerId, reportUrl, uploadDate, soilType, pH, nitrogen, phosphorus, potassium, organicCarbon, ec, micronutrients, soilHealthScore, soilHealthStatus, deficiencies, benchmarkComparison, recommendations, cropRecommendations, aiAnalysis, translations
- **Service**: `soilAIService.ts`
- **Controller/Routes**:
  - `POST /api/soil/upload` — `soil.ts:142`
  - `POST /api/soil/analyze` — `soil.ts:205`
  - `GET /api/soil/history` — `soil.ts:261`
  - `GET /api/soil/crops/:id` — `soil.ts:282`
  - `POST /api/soil/translate` — `soil.ts:295`
  - `DELETE /api/soil/:id` — `soil.ts:338`
  - `GET /api/soil/:id` — `soil.ts:358`
- **Frontend Service**: `frontend/src/services/soilHealth.ts`
- **Frontend Component**: Soil Health page

#### SoilStandard
- **Model**: `backend/src/models/SoilStandard.ts`
- **Collection**: `soilstandards`
- **Fields**: soilType, pH (min, max, ideal), nitrogen (min, max, ideal), phosphorus (min, max, ideal), potassium (min, max, ideal), organicCarbon (min, max, ideal), ec (min, max, ideal), micronutrients
- **Service**: `soilAIService.ts`
- **Controller/Routes**: Used internally by `soil.ts`
- **Frontend Service**: None directly
- **Frontend Component**: None directly

#### SoilMoisture
- **Model**: `backend/src/models/SoilMoisture.ts`
- **Collection**: `soilmoistures`
- **Fields**: farmerId, state, district, moisturePercentage, moistureStatus, rainfallMm, humidity, lastUpdated
- **Service**: Direct use in `soilMoisture.ts`, `aiAssistant.ts`
- **Controller/Routes**:
  - `GET /api/soil-moisture` — `soilMoisture.ts:102`
  - `POST /api/soil-moisture/location` — `soilMoisture.ts:145`
  - `DELETE /api/soil-moisture/cache` — `soilMoisture.ts:181`
- **Frontend Service**: `frontend/src/services/soilMoisture.ts`
- **Frontend Component**: Soil Moisture component

### 2.4 Mandi/Market Models

#### FarmerMarketPreference
- **Model**: `backend/src/models/FarmerMarketPreference.ts`
- **Collection**: `farmermarketpreferences`
- **Fields**: farmerId, selectedCrop, selectedState, selectedDistrict
- **Service**: Direct use in `mandi.ts`, `farmerProfile.ts`
- **Controller/Routes**:
  - `GET /api/mandi/preference` — `mandi.ts:136`
  - `PUT /api/mandi/preference` — `mandi.ts:163`
- **Frontend Service**: `frontend/src/services/mandibav.ts`, `frontend/src/services/marketPrice.ts`
- **Frontend Component**: Mandi Prices page

#### MarketPriceHistory
- **Model**: `backend/src/models/MarketPriceHistory.ts`
- **Collection**: `marketpricehistories`
- **Fields**: farmerId, cropName, district, state, market, modalPrice, minPrice, maxPrice, date
- **Service**: Direct use in `mandi.ts`
- **Controller/Routes**:
  - `GET /api/mandi/history` — `mandi.ts:281`
  - `GET /api/mandi/current` — `mandi.ts:195`
  - `GET /api/mandi/prices` — `mandi.ts:304`
- **Frontend Service**: `mandibav.ts`, `marketPrice.ts`
- **Frontend Component**: Mandi Prices page

### 2.5 AI/Knowledge Models

#### AIConversation
- **Model**: `backend/src/models/AIConversation.ts`
- **Collection**: `aiconversations`
- **Fields**: userId, sessionId, inputType (text/voice/image), inputText, inputAudioUrl, inputImageUrl, status, intent, confidence, moduleId, language, responseText, responseAudioUrl, imageAnalysis, knowledgeData, suggestions, metrics, error, fallbackReason, farmerContext
- **Service**: `pragatiAIService.ts` — `persistConversation()`
- **Controller/Routes**:
  - `GET /api/pragati-ai/history` — `pragatiAI.ts:544`
  - `GET /api/pragati-ai/stats` — `pragatiAI.ts:633`
- **Frontend Service**: `frontend/src/services/pragatiAI.ts`
- **Frontend Component**: AI Assistant page

#### FarmerMemory
- **Model**: `backend/src/models/FarmerMemory.ts`
- **Collection**: `farmermemories`
- **Fields**: userId, conversationHistory[], totalInteractions, lastInteractionAt, preferredTopics, languagePreference
- **Service**: `pragatiAIService.ts` — `updateFarmerMemory()`, `memoryEngine.ts`
- **Controller/Routes**: Indirect via Pragati AI
- **Frontend Service**: `pragatiAI.ts`
- **Frontend Component**: AI Assistant page

#### TranslationCache
- **Model**: `backend/src/models/TranslationCache.ts`
- **Collection**: `translationcaches`
- **Fields**: key, value, lang, expiresAt
- **Service**: `translationCacheService.ts`
- **Controller/Routes**: Indirect via language engine
- **Frontend Service**: `frontend/src/utils/translationCache.ts`

#### LanguageDictionary
- **Model**: `backend/src/models/LanguageDictionary.ts`
- **Collection**: `languagedictionaries`
- **Fields**: term, english, hindi, dialect, context, aliases[], confidence, status
- **Service**: `languageDictionaryService.ts`
- **Controller/Routes**:
  - Admin routes via `languageDictionary.ts`
- **Frontend Service**: `frontend/src/services/languageEngine.ts`

### 2.6 Content Models

#### GovtScheme
- **Model**: `backend/src/models/GovtScheme.ts`
- **Collection**: `govtschemes`
- **Fields**: title, schemeType, state, department, summary, description, benefits[], eligibility, applicationProcess, startDate, endDate, status, coverImage, tags, audience
- **Service**: Direct use in `schemes.ts`, `aiFos.ts`
- **Controller/Routes**:
  - `GET /api/schemes` — `schemes.ts`
  - `GET /api/schemes/:id` — `schemes.ts`
  - `GET /api/ai-fos/schemes` — `aiFos.ts:254`
- **Frontend Service**: `frontend/src/services/schemes.ts`
- **Frontend Component**: Government Schemes page

#### BlogPost
- **Model**: `backend/src/models/BlogPost.ts`
- **Collection**: `blogposts`
- **Fields**: title, slug, excerpt, content, coverImage, author, status, publishedAt, tags
- **Service**: Direct use in `blogs.ts`
- **Controller/Routes**:
  - `GET /api/blogs` — `blogs.ts`
  - `GET /api/blogs/:slug` — `blogs.ts`
- **Frontend Service**: `frontend/src/services/blog.ts`
- **Frontend Component**: Blog page

#### GalleryItem
- **Model**: `backend/src/models/GalleryItem.ts`
- **Collection**: `galleryitems`
- **Fields**: title, description, imageUrl, category, tags, status
- **Service**: Direct use in `gallery.ts`
- **Controller/Routes**:
  - `GET /api/gallery` — `gallery.ts`
- **Frontend Service**: `frontend/src/services/gallery.ts`
- **Frontend Component**: Gallery page

#### KVK
- **Model**: `backend/src/models/KVK.ts`
- **Collection**: `kvks`
- **Fields**: name, district, state, address, phone, email, services[], distance, coordinates
- **Service**: `kvkService.ts`
- **Controller/Routes**:
  - `GET /api/kvk` — `kvk.ts`
  - `GET /api/kvk/search` — `kvk.ts`
- **Frontend Service**: `frontend/src/services/kvk.ts`
- **Frontend Component**: KVK page

### 2.7 Shop/Marketplace Models

#### Shop
- **Model**: `backend/src/models/Shop.ts`
- **Collection**: `shops`
- **Fields**: name, type, ownerId, description, address, location, phone, email, images[], status
- **Service**: Direct use in `shops.ts`
- **Controller/Routes**:
  - `GET /api/shops` — `shops.ts`
  - `GET /api/shops/:id` — `shops.ts`
- **Frontend Service**: `frontend/src/services/shopkeeperApi.ts`
- **Frontend Component**: Shops page, Marketplace

#### ShopProduct
- **Model**: `backend/src/models/ShopProduct.ts`
- **Collection**: `shopproducts`
- **Fields**: shopId, name, description, price, unit, category, image, stock, status
- **Service**: Direct use in `shopkeeper.ts`
- **Controller/Routes**:
  - Shopkeeper routes
- **Frontend Service**: `shopkeeperApi.ts`
- **Frontend Component**: Shop products

### 2.8 Other Models

#### IrrigationSchedule
- **Model**: `backend/src/models/IrrigationSchedule.ts`
- **Collection**: `irrigationschedules`
- **Service**: Direct use in `irrigation.ts`
- **Routes**: `/api/irrigation/*`

#### SupportRequest
- **Model**: `backend/src/models/SupportRequest.ts`
- **Collection**: `supportrequests`
- **Service**: Direct use in `support.ts`
- **Routes**: `/api/support/*`

#### SchemeApplication
- **Model**: `backend/src/models/SchemeApplication.ts`
- **Collection**: `schemeapplications`
- **Service**: Direct use in `schemes.ts`
- **Routes**: `/api/schemes/*`

---

## 3. DATABASE RELATIONSHIPS (CONFIRMED FROM CODE)

```
User (1) ──── (N) FarmerProfileData          [userId]
User (1) ──── (N) AgroudAnKisanCard          [userId]
User (1) ──── (N) UserSettings               [userId]
User (1) ──── (N) DiseaseRecommendation      [userId]
User (1) ──── (N) MyCrop                     [userId]
User (1) ──── (N) ActiveCrop                 [farmerId]
User (1) ──── (N) CropTask                   [farmerId]
User (1) ──── (N) SoilReport                 [farmerId]
User (1) ──── (N) SoilMoisture               [farmerId]
User (1) ──── (N) FarmerMarketPreference     [farmerId]
User (1) ──── (N) MarketPriceHistory         [farmerId]
User (1) ──── (N) AIConversation             [userId]
User (1) ──── (N) FarmerMemory               [userId]
User (1) ──── (N) SchemeApplication          [farmerId]
User (1) ──── (N) SupportRequest             [userId]
User (1) ──── (N) Shop                       [ownerId]

FarmerProfileData (1) ──── (N) SoilReport    [farmerId]
FarmerProfileData (1) ──── (N) SoilMoisture [farmerId]

MyCrop (1) ──── (N) ActiveCrop               [myCropId]

ActiveCrop (1) ──── (N) CropTask             [activeCropId]

CropKnowledgeBase ──── FarmerCropRequest      [createdBy, cropName, soilType, district, season]

DiseasePestSolution (1) ──── (N) DiseaseRecommendation [knowledgeBaseId]
```

---

## 4. MONGODB DATA FILES

**Location**: `C:\Users\mohit\OneDrive\Desktop\AgroudanAi\companycode\data\mongo\`

**Contents**: WiredTiger storage engine files (actual database files)
- `WiredTiger` — Main storage engine
- `WiredTiger.lock` — Lock file
- `WiredTiger.wt` — WiredTiger metadata
- `collection-*.wt` — Individual collection files
- `index-*.wt` — Index files
- `journal/` — Journal files
- `diagnostic.data/` — Diagnostic data

**Status**: Database is NOT empty. Production/development data exists locally.

---

## 5. DATABASE CONNECTION ISSUES

### 5.1 Connection String
- **File**: `backend/.env.example`
- **URI**: `mongodb://localhost:27017/kisan-pragati`
- **Actual .env.local**: NOT PRESENT (backend does not have `.env.local`, only `.env.example`)

### 5.2 Connection Logic
```typescript
// backend/src/config/database.ts
export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(mongoURI);
};
```

### 5.3 Potential Issues
1. **No `.env.local` in backend**: If `MONGODB_URI` is not set in environment, backend will crash on startup with `MONGODB_URI is not configured`
2. **MongoDB service must be running**: If MongoDB is not running, connection will fail with ECONNREFUSED
3. **Data directory**: `data/mongo/` exists with actual files, suggesting MongoDB has run before

---

*Report generated: 2026-08-26*
*Scope: Read-only forensic analysis — no code modified*
