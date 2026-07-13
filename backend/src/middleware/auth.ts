import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { User } from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'oceancast_jwt_secret_token_key';
    const decoded = jwt.verify(token, secret) as { userId: string };
    
    if (!decoded.userId) {
      return res.status(403).json({ error: 'Invalid token structure' });
    }
    
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user || (user as any).role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    return res.status(500).json({ error: 'Internal server error validating privileges' });
  }
};
