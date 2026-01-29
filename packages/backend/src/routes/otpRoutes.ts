/**
 * OTP routes for sending and verifying one-time passwords
 */

import { Router, type Request, type Response } from "express"
import { sendOTP, verifyOTP } from "../services/otpService.js"
import type { ErrorResponse } from "../types/index.js"

export function createOTPRouter(): Router {
  const router = Router()

  /**
   * POST /otp/send
   * Send OTP to user's email
   */
  router.post("/send", async (req: Request, res: Response) => {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({
          error: "Missing required field",
          code: "INVALID_REQUEST",
          message: "email is required",
        } as ErrorResponse)
      }

      if (!email.includes("@")) {
        return res.status(400).json({
          error: "Invalid email",
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        } as ErrorResponse)
      }

      const result = await sendOTP(email)

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send OTP",
          code: "OTP_SEND_FAILED",
          message: result.message,
        } as ErrorResponse)
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      })
    } catch (error) {
      console.error("[OTP] Send OTP error:", error)
      return res.status(500).json({
        error: "Failed to send OTP",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse)
    }
  })

  /**
   * POST /otp/verify
   * Verify OTP code
   */
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body

      if (!email || !code) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email and code are required",
        } as ErrorResponse)
      }

      const result = await verifyOTP(email, code)

      if (!result.success) {
        return res.status(401).json({
          error: "Invalid OTP",
          code: "OTP_VERIFICATION_FAILED",
          message: result.message,
        } as ErrorResponse)
      }

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
      })
    } catch (error) {
      console.error("[OTP] Verify OTP error:", error)
      return res.status(500).json({
        error: "Failed to verify OTP",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse)
    }
  })

  return router
}
