import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import cropRoutes from './routes/crops';
import weatherRoutes from './routes/weather';
import userRoutes from './routes/users';
import mandiRoutes from './routes/mandi';
import adminRoutes from './routes/admin';
import blogRoutes from './routes/blogs';
import galleryRoutes from './routes/gallery';
import schemeRoutes from './routes/schemes';
import shopRoutes from './routes/shops';
import rewardsRoutes from './routes/rewards';
import cropRecommendationRoutes from './routes/cropRecommendation';
import myCropsRoutes from './routes/myCrops';
import soilRoutes from './routes/soil';
import soilMoistureRoutes from './routes/soilMoisture';
import irrigationRoutes from './routes/irrigation';
import aiFosRoutes from './routes/aiFos';
import aiAssistantRoutes from './routes/aiAssistant';
import settingsRoutes from './routes/settings';
import farmerProfileRoutes from './routes/farmerProfile';
import diseaseRoutes from './routes/disease';
import farmerStoriesRoutes from './routes/farmerStories';
import shopkeeperRoutes from './routes/shopkeeper';
import adminShopkeeperRoutes from './routes/adminShopkeeper';
import pestKnowledgeRoutes from './routes/pestKnowledge';
import diseasePestSolutionsRoutes from './routes/diseasePestSolutions';
import kvkRoutes from './routes/kvk';
import languageDictionaryRoutes from './routes/languageDictionary';
import languageEngineRoutes from './routes/languageEngine';
import memoryEngineRoutes from './routes/memoryEngine';
import voiceEngineRoutes from './routes/voiceEngine';
import pragatiAIRoutes from './routes/pragatiAI';
import supportRoutes from './routes/support';
import { ensureBootstrapAdmin } from './utils/bootstrapAdmin';
import { ensureSeededSchemes } from './utils/seedSchemes';
import { bilingualErrorHandler, requestTimeout } from './middleware/errorHandler';
import { languageContextMiddleware } from './middleware/languageContext';
import healthRoutes from './routes/health';
import { logger } from './utils/logger';

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 5000;
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const buildAllowedOrigins = () => {
  const configuredOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL]
    .filter(Boolean)
    .flatMap((value) => (value as string).split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001'];

  return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
};

const allowedOrigins = buildAllowedOrigins();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server and non-browser requests that do not send an Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestTimeout(30000));
app.use('/uploads', express.static(uploadsDir));

// Request logger
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip, ua: req.headers['user-agent']?.slice(0, 60) });
  next();
});

// Language context — auto-attaches langCode + pageContext to every request
app.use(languageContextMiddleware);

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'development',
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests, please try again in 10 minutes.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register/request-otp', otpLimiter);
app.use('/api/auth/register/verify-otp', otpLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/crops', cropRoutes);
// marketplace routes removed per request (UI replaced with mandi-bhav integration)
app.use('/api/weather', weatherRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mandi', mandiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/crop-recommendation', cropRecommendationRoutes);
app.use('/api/my-crops', myCropsRoutes);
app.use('/api/soil', soilRoutes);
app.use('/api/soil-moisture', soilMoistureRoutes);
app.use('/api/irrigation', irrigationRoutes);
app.use('/api/ai-fos', aiFosRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/farmer-profile', farmerProfileRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/api/farmer-stories', farmerStoriesRoutes);
app.use('/api/shopkeeper', shopkeeperRoutes);
app.use('/api/admin/shopkeeper', adminShopkeeperRoutes);
app.use('/api/admin/pest-knowledge', pestKnowledgeRoutes);
app.use('/api/disease-pest-solutions', diseasePestSolutionsRoutes);
app.use('/api/kvk', kvkRoutes);
app.use('/api/language-dictionary', languageDictionaryRoutes);
app.use('/api/language-engine', languageEngineRoutes);
app.use('/api/memory-engine', memoryEngineRoutes);
app.use('/api/voice-engine', voiceEngineRoutes);
app.use('/api/pragati-ai', pragatiAIRoutes);
app.use('/api/support', supportRoutes);

// Health Check
app.use('/api/health', healthRoutes);

// Error Handler
app.use(bilingualErrorHandler);

const startServer = async () => {
  await connectDB();
  await ensureBootstrapAdmin();
  await ensureSeededSchemes();

  const server = app.listen(PORT, () => {
    logger.info('Kisan Unnati Backend started', { port: PORT, env: process.env.NODE_ENV || 'development' });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`, { port: PORT });
      process.exit(1);
    } else {
      throw err;
    }
  });
};

startServer();
