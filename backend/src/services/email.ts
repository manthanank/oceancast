import nodemailer from 'nodemailer';

/**
 * Create a Nodemailer transporter from environment variables.
 * Falls back to Ethereal (console preview) if no SMTP config is provided.
 */
const createTransporter = () => {
  const host = process.env['SMTP_HOST'];
  const port = parseInt(process.env['SMTP_PORT'] || '587', 10);
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // No SMTP configured — use null transport (log only)
  return null;
};

const from = process.env['SMTP_FROM'] || '"OceanCast" <noreply@oceancast.app>';

/**
 * Send a password reset email.
 * If no SMTP is configured, logs the reset link to console for dev testing.
 */
export const sendPasswordResetEmail = async (toEmail: string, resetToken: string, name: string): Promise<void> => {
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0891b2,#2563eb);padding:32px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:12px;padding:12px;margin-bottom:16px;">
                  🌊
                </div>
                <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">OceanCast</h1>
                <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Marine Weather Intelligence</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 12px;">Reset Your Password</h2>
                <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">Hi ${name}, we received a request to reset the password for your OceanCast account.</p>
                <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 32px;">Click the button below to choose a new password. This link will expire in <strong style="color:#22d3ee;">1 hour</strong>.</p>
                <div style="text-align:center;margin:0 0 32px;">
                  <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#22d3ee,#3b82f6);color:#0a0f1e;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;">Reset Password</a>
                </div>
                <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 8px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
                <p style="color:#64748b;font-size:12px;margin:0;">Link expires: <strong style="color:#94a3b8;">${new Date(Date.now() + 3600000).toUTCString()}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="background:#0a0f1e;padding:20px 32px;border-top:1px solid #1e293b;text-align:center;">
                <p style="color:#475569;font-size:12px;margin:0;">© ${new Date().getFullYear()} OceanCast. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const transporter = createTransporter();

  if (!transporter) {
    // No SMTP config — log to console for development
    console.log('\n========== PASSWORD RESET LINK (dev mode) ==========');
    console.log(`User: ${toEmail}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('=====================================================\n');
    return;
  }

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Reset Your OceanCast Password',
    html,
    text: `Hi ${name},\n\nReset your OceanCast password using this link (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
};

/**
 * Send a welcome email to a new user.
 */
export const sendWelcomeEmail = async (toEmail: string, name: string): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) return; // Silently skip in dev mode

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0891b2,#2563eb);padding:32px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">🌊 Welcome to OceanCast, ${name}!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px;">
                <p style="color:#94a3b8;font-size:15px;line-height:1.6;">Your account is ready. Track live tides, wave heights, marine weather, solunar fishing calendars, and much more.</p>
                <p style="color:#94a3b8;font-size:15px;">— The OceanCast Team 🌊</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `Welcome to OceanCast, ${name}! 🌊`,
    html,
  });
};
