import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

// Health check endpoint
router.get('/', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = 'disconnected';

  switch (dbState) {
    case 1:
      dbStatus = 'connected';
      break;
    case 2:
      dbStatus = 'connecting';
      break;
    case 3:
      dbStatus = 'disconnecting';
      break;
    default:
      dbStatus = 'disconnected';
  }

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
    },
  });
});

export default router;
