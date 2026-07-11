import { Schema, model, Types } from 'mongoose';

const catchSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    species: {
      type: String,
      required: [true, 'Fish species is required'],
      trim: true,
    },
    weight: {
      type: Number, // in kg
      required: [true, 'Weight is required'],
      min: 0.01,
    },
    length: {
      type: Number, // in cm
      required: [true, 'Length is required'],
      min: 0.1,
    },
    locationName: {
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
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    catchTime: {
      type: Date,
      default: Date.now,
    },
    // Smart Environmental Tagging fields
    temp: { type: Number }, // Celsius
    windSpeed: { type: Number }, // km/h
    waveHeight: { type: Number }, // meters
    tideHeight: { type: Number }, // meters
  },
  {
    timestamps: true,
  }
);

export const Catch = model('Catch', catchSchema);
