import nodemailer from 'nodemailer';

// Mock transporter for development - in production use real SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: `"Aicon X" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw in development if SMTP is not configured
    if (process.env.NODE_ENV === 'production') throw error;
  }
};

export const sendVerificationCode = async (to: string, code: string) => {
  const subject = 'Your Aicon X Verification Code';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #f97316; margin-bottom: 24px;">Aicon X Verification</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Use the following code to verify your action:</p>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">${code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
};

export const sendPasswordResetEmail = async (to: string, resetToken: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Aicon X Password';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #f97316; margin-bottom: 24px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">We received a request to reset your Aicon X password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="background: #f97316; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 32px; border-radius: 8px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #94a3b8; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="color: #64748b; font-size: 13px; word-break: break-all;">${resetLink}</p>
      <p style="color: #94a3b8; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
};

export const sendWhatsAppVerification = async (phone: string, code: string) => {
  // In production, integrate with Twilio WhatsApp API or similar
  console.log(`[WhatsApp/SMS] Sending verification code ${code} to ${phone}`);
  // Return true to simulate success
  return true;
};
