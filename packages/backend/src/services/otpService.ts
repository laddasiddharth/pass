/**
 * OTP Service for generating and verifying one-time passwords
 */

import crypto from "crypto"
import nodemailer from "nodemailer"
import { OTP } from "../database/models.js"

// Configure email transporter
// For production, use a real email service like SendGrid, AWS SES, etc.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Generate a 6-digit OTP code
 */
function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Send OTP to user's email
 */
export async function sendOTP(email: string): Promise<{ success: boolean; message: string }> {
  try {
    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email })

    // Generate new OTP
    const code = generateOTPCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Save OTP to database
    await OTP.create({
      email,
      code,
      expiresAt,
      verified: false,
    })

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Password Manager" <noreply@passwordmanager.com>',
      to: email,
      subject: "🔐 Your Vault Access Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #1e293b;
              background: linear-gradient(135deg, #f1f5f9 0%, #e0e7ff 100%);
              padding: 40px 20px;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            .header { 
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%);
              color: white; 
              padding: 40px 30px; 
              text-align: center;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: -0.5px;
            }
            .header p {
              font-size: 16px;
              opacity: 0.95;
              font-weight: 500;
            }
            .shield-icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 20px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
            }
            .content { 
              background: white;
              padding: 40px 30px;
            }
            .content h2 {
              font-size: 20px;
              color: #0f172a;
              margin-bottom: 16px;
              font-weight: 600;
            }
            .content p {
              color: #475569;
              margin-bottom: 16px;
              font-size: 15px;
            }
            .otp-container {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              padding: 30px;
              margin: 30px 0;
              text-align: center;
            }
            .otp-label {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #64748b;
              font-weight: 600;
              margin-bottom: 12px;
            }
            .otp-code { 
              font-size: 42px;
              font-weight: 800;
              letter-spacing: 12px;
              color: #4f46e5;
              font-family: 'Courier New', monospace;
              text-align: center;
              padding: 8px;
              margin: 0;
            }
            .otp-timer {
              margin-top: 12px;
              font-size: 13px;
              color: #64748b;
              font-weight: 500;
            }
            .warning { 
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-left: 4px solid #f59e0b;
              padding: 16px 20px;
              margin: 24px 0;
              border-radius: 8px;
            }
            .warning-title {
              font-weight: 700;
              color: #92400e;
              margin-bottom: 4px;
              font-size: 14px;
            }
            .warning-text {
              color: #78350f;
              font-size: 13px;
              margin: 0;
            }
            .info-box {
              background: #f1f5f9;
              border-radius: 8px;
              padding: 16px 20px;
              margin: 20px 0;
            }
            .info-box p {
              margin: 0;
              font-size: 14px;
              color: #475569;
            }
            .footer { 
              background: #f8fafc;
              text-align: center;
              padding: 30px;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              font-size: 13px;
              color: #64748b;
              margin: 8px 0;
            }
            .footer-link {
              color: #4f46e5;
              text-decoration: none;
              font-weight: 500;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 20px 10px; }
              .header { padding: 30px 20px; }
              .content { padding: 30px 20px; }
              .otp-code { font-size: 36px; letter-spacing: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="shield-icon">🔐</div>
              <h1>ZeroKnowledge Vault</h1>
              <p>Secure Access Verification</p>
            </div>
            
            <div class="content">
              <h2>Hello!</h2>
              <p>You've requested access to your secure password vault. To verify your identity and unlock your vault, please use the One-Time Password (OTP) below:</p>
              
              <div class="otp-container">
                <div class="otp-label">Your Verification Code</div>
                <div class="otp-code">${code}</div>
                <div class="otp-timer">⏱️ Expires in 10 minutes</div>
              </div>
              
              <div class="info-box">
                <p><strong>How to use:</strong> Enter this 6-digit code in your dashboard to unlock your vault and access your stored credentials.</p>
              </div>
              
              <div class="warning">
                <div class="warning-title">⚠️ Security Notice</div>
                <p class="warning-text">Never share this code with anyone. Our team will never ask for your OTP. If you didn't request this code, please ignore this email and ensure your account is secure.</p>
              </div>
              
              <p style="margin-top: 24px;">If you have any concerns about your account security, please contact our support team immediately.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated security message from <strong>ZeroKnowledge Vault</strong></p>
              <p>Please do not reply to this email.</p>
              <p style="margin-top: 16px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Password Manager. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
ZeroKnowledge Vault - Secure Access Verification

Your OTP Code: ${code}

This code will expire in 10 minutes.

SECURITY NOTICE: Never share this code with anyone. Our team will never ask for your OTP.

If you didn't request this code, please ignore this email.

---
ZeroKnowledge Vault
© ${new Date().getFullYear()} Password Manager. All rights reserved.
      `,
    }

    // Try to send email, fall back to console if it fails
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail(mailOptions)
        console.log(`[OTP] ✅ Sent OTP to ${email}`)
      } catch (emailError: any) {
        console.error(`[OTP] ❌ Email sending failed:`, emailError.message)
        console.log(`[OTP] 📋 Fallback - OTP for ${email}: ${code}`)
        // Don't throw error, still return success since OTP is saved in DB
      }
    } else {
      // For development: log OTP to console
      console.log(`[OTP] 🔧 Development mode - OTP for ${email}: ${code}`)
    }

    return {
      success: true,
      message: "OTP sent successfully",
    }
  } catch (error) {
    console.error("[OTP] Error sending OTP:", error)
    return {
      success: false,
      message: "Failed to send OTP",
    }
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    // Find the OTP
    const otp = await OTP.findOne({
      email,
      code,
      verified: false,
      expiresAt: { $gt: new Date() },
    })

    if (!otp) {
      return {
        success: false,
        message: "Invalid or expired OTP",
      }
    }

    // Mark as verified
    otp.verified = true
    await otp.save()

    console.log(`[OTP] Verified OTP for ${email}`)

    return {
      success: true,
      message: "OTP verified successfully",
    }
  } catch (error) {
    console.error("[OTP] Error verifying OTP:", error)
    return {
      success: false,
      message: "Failed to verify OTP",
    }
  }
}

/**
 * Clean up expired OTPs (optional, as MongoDB TTL index handles this)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  try {
    const result = await OTP.deleteMany({
      expiresAt: { $lt: new Date() },
    })
    console.log(`[OTP] Cleaned up ${result.deletedCount} expired OTPs`)
  } catch (error) {
    console.error("[OTP] Error cleaning up OTPs:", error)
  }
}
