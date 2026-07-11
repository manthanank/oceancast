import { AuditLog } from '../models/AuditLog';

/**
 * Log a system or security event in the AuditLog database collection.
 */
export async function logEvent(
  action: string,
  userEmail: string = 'system',
  details?: string
): Promise<void> {
  try {
    const log = new AuditLog({ action, userEmail, details });
    await log.save();
  } catch (error) {
    console.error('[AuditService] Failed to write event to audit log collection:', error);
  }
}
