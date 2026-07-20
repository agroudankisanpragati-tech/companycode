import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');

    process.on('SIGINT', async () => {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected on app termination');
      process.exit(0);
    });
  } catch (error) {
    logger.error('MongoDB connection failed', { error: String(error) });
    process.exit(1);
  }
};
