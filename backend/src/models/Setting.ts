import { Schema, model } from 'mongoose';

const settingSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Setting key is required'],
      unique: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, 'Setting value is required'],
    },
  },
  {
    timestamps: true,
  }
);

export const Setting = model('Setting', settingSchema);
