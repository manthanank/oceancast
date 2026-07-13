import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { Location } from '../models/Location';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logEvent } from '../services/audit';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/email';

const router = Router();

const JWT_SECRET = process.env['JWT_SECRET'] || 'oceancast_jwt_secret_token_key';

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
      lastLoginAt: new Date(),
    });
    await newUser.save();

    // Generate JWT
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(() => {});

    await logEvent('User Registered', newUser.email, `Account created with name: "${newUser.name}"`);

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: (newUser as any).role,
        preferences: (newUser as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
        unitPrefs: (newUser as any).unitPrefs || { tempUnit: 'C', windUnit: 'kmh', waveUnit: 'm' },
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
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter email and password' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Check if account is locked
    if ((user as any).lockUntil && (user as any).lockUntil > new Date()) {
      const minutesLeft = Math.ceil(((user as any).lockUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed attempts
      const attempts = ((user as any).loginAttempts || 0) + 1;
      const updates: any = { loginAttempts: attempts };
      if (attempts >= 5) {
        updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15 min
        updates.loginAttempts = 0;
      }
      await User.updateOne({ _id: user._id }, updates);
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Reset failed attempts on success
    await User.updateOne({ _id: user._id }, { loginAttempts: 0, lockUntil: null, lastLoginAt: new Date() });

    // Generate JWT — 30 days if rememberMe, else 7 days
    const expiresIn = rememberMe ? '30d' : '7d';
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn });

    await logEvent('User Login', user.email, `User logged in (rememberMe: ${!!rememberMe})`);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: (user as any).role,
        preferences: (user as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
        unitPrefs: (user as any).unitPrefs || { tempUnit: 'C', windUnit: 'kmh', waveUnit: 'm' },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me - Get user profile (Protected)
router.get('/me', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.userId).select('-password -resetPasswordToken -emailVerifyToken');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const savedLocationsCount = await Location.countDocuments({ userId: user._id });

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: (user as any).role,
      preferences: (user as any).preferences || { swellWarnings: true, windWarnings: true, solunarAlerts: true },
      unitPrefs: (user as any).unitPrefs || { tempUnit: 'C', windUnit: 'kmh', waveUnit: 'm' },
      lastLoginAt: (user as any).lastLoginAt || null,
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

// PUT /api/auth/profile - Update user profile (Protected)
router.put('/profile', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, email, preferences, unitPrefs } = req.body;

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

    if (unitPrefs) {
      const currentUnit = (user as any).unitPrefs || {};
      (user as any).unitPrefs = {
        tempUnit: unitPrefs.tempUnit || currentUnit.tempUnit || 'C',
        windUnit: unitPrefs.windUnit || currentUnit.windUnit || 'kmh',
        waveUnit: unitPrefs.waveUnit || currentUnit.waveUnit || 'm',
      };
      user.markModified('unitPrefs');
    }

    await user.save();
    await logEvent('Profile Updated', user.email, 'Updated profile settings');

    const savedLocationsCount = await Location.countDocuments({ userId: user._id });

    return res.json({
      message: 'Profile details updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: (user as any).role,
        preferences: (user as any).preferences,
        unitPrefs: (user as any).unitPrefs,
      },
      metrics: { savedLocationsCount, memberSince: user.createdAt },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Server error updating user profile' });
  }
});

// POST /api/auth/change-password - Change password (Protected)
router.post('/change-password', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logEvent('Password Changed', user.email, 'User changed their account password');
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Server error changing password' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Always return success to prevent email enumeration attacks
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate a cryptographically secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await User.updateOne({ _id: user._id }, {
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Send reset email (non-blocking)
    await sendPasswordResetEmail(user.email, resetToken, user.name);

    await logEvent('Password Reset Requested', user.email, 'User requested a password reset email');
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Server error processing password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Hash the incoming token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: new Date() }, // Token must not be expired
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired' });
    }

    // Update password and clear token
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    (user as any).resetPasswordToken = null;
    (user as any).resetPasswordExpiry = null;
    await user.save();

    await logEvent('Password Reset', user.email, 'User successfully reset their password via email link');
    return res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Server error resetting password' });
  }
});

// DELETE /api/auth/account - Delete user account (Protected)
router.delete('/account', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { confirmText } = req.body;
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ error: 'Please type DELETE to confirm account deletion' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cascade delete: remove all user locations and catches
    await Location.deleteMany({ userId: req.userId });

    // Log before deletion
    await logEvent('Account Deleted', user.email, `User permanently deleted their account (${user.name})`);

    await User.deleteOne({ _id: req.userId });

    return res.json({ message: 'Account permanently deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Server error deleting account' });
  }
});

export default router;
