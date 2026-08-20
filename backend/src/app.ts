import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import locationRoutes from './routes/locations';
import weatherRoutes from './routes/weather';
import marineRoutes from './routes/marine';
import tidesRoutes from './routes/tides';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import healthRoutes from './routes/health';
import adminRoutes from './routes/admin';
import mapRoutes from './routes/map';
import solunarRoutes from './routes/solunar';
import catchRoutes from './routes/catches';
import visibilityRoutes from './routes/visibility';
import marineHubRoutes from './routes/marine-hub';

const app = express();

// Enable trust proxy for accurate client IP detection behind Vercel reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const envOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'https://oceancast.vercel.app',
  'https://oceancast-app.vercel.app',
  'https://oceancast-api.vercel.app',
  ...envOrigins,
];

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  if (/^https:\/\/oceancast(-app)?(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
      } else if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin not allowed — ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors());

// Rate limiting (for API protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Stricter rate limiter specifically for auth endpoints (login, forgot-password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 login/forgot-password attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes before trying again.' },
});

import connectDB from './config/db';

// Apply rate limiter to all API requests
app.use('/api', limiter);
// Apply stricter limiter to auth routes that are brute-force targets
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection verification middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection middleware error:', err);
    res.status(503).json({ error: 'Database is currently unavailable. Please try again shortly.' });
  }
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/marine', marineRoutes);
app.use('/api/tides', tidesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/solunar', solunarRoutes);
app.use('/api/catches', catchRoutes);
app.use('/api/visibility', visibilityRoutes);
app.use('/api/marine-hub', marineHubRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to OceanCast API',
    documentation: 'Refer to API specifications for route details.',
  });
});

// 404 handler for unknown endpoints
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

export default app;
