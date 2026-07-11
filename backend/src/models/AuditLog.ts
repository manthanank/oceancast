import { Schema, model } from 'mongoose';

const auditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    userEmail: {
      type: String,
      trim: true,
      default: 'system',
    },
    details: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AuditLog = model('AuditLog', auditLogSchema);
