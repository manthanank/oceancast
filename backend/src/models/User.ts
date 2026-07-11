import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    role: {
      type: String,
      enum: ['standard', 'admin'],
      default: 'standard',
    },
    preferences: {
      swellWarnings: { type: Boolean, default: true },
      windWarnings: { type: Boolean, default: true },
      solunarAlerts: { type: Boolean, default: true },
    },
    unitPrefs: {
      tempUnit: { type: String, enum: ['C', 'F'], default: 'C' },
      windUnit: { type: String, enum: ['kmh', 'ms', 'kt'], default: 'kmh' },
      waveUnit: { type: String, enum: ['m', 'ft'], default: 'm' },
    },
    // Password reset
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiry: { type: Date, default: null },
    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    // Login tracking & security
    lastLoginAt: { type: Date, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Hash the password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

export const User = model('User', userSchema);
