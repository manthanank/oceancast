import { Schema, model, Types } from 'mongoose';

const locationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90,
    },
    lon: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate locations with the exact coordinates for the same user
locationSchema.index({ userId: 1, lat: 1, lon: 1 }, { unique: true });

export const Location = model('Location', locationSchema);
