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
import { ensureBootstrapAdmin } from './utils/bootstrapAdmin';
import { bilingualErrorHandler, requestTimeout } from './middleware/errorHandler';

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Kisan Unnati Backend is running' });
});

// Error Handler
app.use(bilingualErrorHandler);

const startServer = async () => {
  await connectDB();
  await ensureBootstrapAdmin();

  const server = app.listen(PORT, () => {
    console.log(`🌾 Kisan Unnati Backend running on port ${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the existing process and restart.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
};

startServer();
