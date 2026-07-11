import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Location } from '../models/Location';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logEvent } from '../services/audit';

const router = Router();

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in name, email and password' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email address already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    // Generate JWT
    const token = jwt.sign({ userId: newUser._id }, process.env['JWT_SECRET'] || 'oceancast_jwt_secret_token_key', {
      expiresIn: '7d',
    });

    // Log event in database audit logs
    await logEvent('User Registered', newUser.email, `Account created with name: "${newUser.name}"`);

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: (newUser as any).role,
        preferences: (newUser as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login - User authentication
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter email and password' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env['JWT_SECRET'] || 'oceancast_jwt_secret_token_key', {
      expiresIn: '7d',
    });

    // Log event in database audit logs
    await logEvent('User Login', user.email, 'User logged into application session');

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: (user as any).role,
        preferences: (user as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me - Get user profile session checks (Protected)
router.get('/me', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    let user = await User.findById(req.userId).select('-password');
    
    // Automatically provision guest profile if guest token is authenticated
    if (!user && req.userId === '660000000000000000000000') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('guest_fisherman_secret_pwd_998', salt);
      
      user = new User({
        _id: '660000000000000000000000',
        name: 'Guest Fisherman',
        email: 'guest@oceancast.local',
        password: hashedPassword,
        role: 'standard',
        preferences: {
          swellWarnings: true,
          windWarnings: true,
          solunarAlerts: true,
        },
      });
      await user.save();
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compute user saved locations metrics
    const savedLocationsCount = await Location.countDocuments({ userId: user._id });

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: (user as any).role,
      preferences: (user as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
      metrics: {
        savedLocationsCount,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Server error retrieving user data' });
  }
});

// PUT /api/auth/profile - Update user profile credentials and alert configurations (Protected)
router.put('/profile', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, email, preferences } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User record not found' });
    }

    if (name) user.name = name;
    
    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email });
      if (emailTaken) {
        return res.status(400).json({ error: 'Email address is already in use by another user' });
      }
      user.email = email;
    }

    if (preferences) {
      const currentPref = (user as any).preferences || {};
      (user as any).preferences = {
        swellWarnings: preferences.swellWarnings !== undefined ? !!preferences.swellWarnings : currentPref.swellWarnings,
        windWarnings: preferences.windWarnings !== undefined ? !!preferences.windWarnings : currentPref.windWarnings,
        solunarAlerts: preferences.solunarAlerts !== undefined ? !!preferences.solunarAlerts : currentPref.solunarAlerts,
      };
      user.markModified('preferences');
    }

    await user.save();
    await logEvent('Profile Updated', user.email, 'Updated display name or alert notification settings');

    const savedLocationsCount = await Location.countDocuments({ userId: user._id });

    return res.json({
      message: 'Profile details updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: (user as any).role,
        preferences: (user as any).preferences,
      },
      metrics: {
        savedLocationsCount,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile details error:', error);
    return res.status(500).json({ error: 'Server error updating user profile details' });
  }
});

export default router;
