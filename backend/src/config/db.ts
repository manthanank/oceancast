import mongoose from 'mongoose';

// Disable internal buffering — fail fast if DB is not connected (better than 10s silent timeout)
mongoose.set('bufferCommands', false);

// Global cached connection promise
let connectionPromise: Promise<typeof mongoose> | null = null;

const connectDB = (): Promise<typeof mongoose> => {
  const mongoURI = process.env.MONGODB_URI;

  // 1. Already connected — return resolved promise
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose);
  }

  // 2. Connection in progress — reuse the same promise to prevent connection storms
  if (connectionPromise) {
    return connectionPromise;
  }

  if (!mongoURI) {
    console.error('Error: MONGODB_URI is not defined in environment variables.');
    return Promise.reject(new Error('MONGODB_URI not set'));
  }

  const isServerless = !!process.env.VERCEL;

  connectionPromise = mongoose
    .connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: isServerless ? 10 : 100, // lower pool size for serverless
      minPoolSize: 1,
      connectTimeoutMS: 10000,
    })
    .then((m) => {
      console.log(`MongoDB Connected: ${m.connection.host}`);
      return m;
    })
    .catch((err) => {
      console.error(`MongoDB connection error: ${err.message}`);
      connectionPromise = null; // reset cache on failure so next request retries
      throw err;
    });

  return connectionPromise;
};

export default connectDB;
