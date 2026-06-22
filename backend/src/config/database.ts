import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected Successfully');

    process.on('SIGINT', async () => {
      await mongoose.disconnect();
      console.log('MongoDB disconnected on app termination');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};
