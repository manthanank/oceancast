import app from '../src/app';
import mongoose from 'mongoose';

const mongoURI = process.env.MONGODB_URI;

// Global cached connection — persists across warm Vercel invocations
let connectionPromise: Promise<typeof mongoose> | null = null;

const connectDB = (): Promise<typeof mongoose> => {
  // Already connected — reuse
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose);
  }

  // Connection in progress — wait for same promise (prevents parallel connect storms)
  if (connectionPromise) {
    return connectionPromise;
  }

  if (!mongoURI) {
    console.error('[Serverless] MONGODB_URI is missing from environment variables.');
    return Promise.reject(new Error('MONGODB_URI not set'));
  }

  connectionPromise = mongoose
    .connect(mongoURI, {
      // Serverless-optimised settings
      serverSelectionTimeoutMS: 10000, // Give Atlas 10s to respond
      socketTimeoutMS: 45000,
      maxPoolSize: 10,               // Limit connections per function instance
      minPoolSize: 1,
      connectTimeoutMS: 10000,
    })
    .then((m) => {
      console.log(`[Serverless] MongoDB Connected: ${m.connection.host}`);
      return m;
    })
    .catch((err) => {
      console.error('[Serverless] MongoDB connection failed:', err.message);
      connectionPromise = null; // Reset so next request retries
      throw err;
    });

  return connectionPromise;
};

// Middleware: AWAIT connection before proceeding — fixes the buffering timeout
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[Serverless] DB connection error on request:', err);
    res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }
});

export default app;
