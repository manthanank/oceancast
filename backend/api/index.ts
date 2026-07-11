import app from '../src/app';
import mongoose from 'mongoose';

const mongoURI = process.env.MONGODB_URI;

// Lazy database connection for serverless environment
const connectDB = async () => {
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  if (!mongoURI) {
    console.warn('[Serverless] Warning: MONGODB_URI environment variable is missing.');
    return;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('[Serverless] MongoDB Connected successfully.');
  } catch (error) {
    console.error('[Serverless] MongoDB connection failed:', error);
  }
};

// Inject database connection validation middleware for Vercel functions
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

export default app;
