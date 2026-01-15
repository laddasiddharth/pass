/**
 * Authentication routes: register and login.
 * These endpoints implement the SRP-style verifier authentication.
 */

import { Router, type Request, type Response } from "express"
import * as crypto from "crypto"
import type { Database } from "../database/schema.js"
import { registerUser, authenticateUser, generateSessionToken } from "../services/authService.js"
import type { RegisterRequest, LoginRequest, LoginResponse, ErrorResponse } from "../types/index.js"

export function createAuthRouter(db: Database): Router {
  const router = Router()

  /**
   * POST /auth/register
   * Register a new user with password verifier.
   *
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "salt": "random_salt_base64",
   *   "verifier": "computed_verifier_hex"
   * }
   *
   * Response: { userId, salt }
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { email, salt, verifier } = req.body as RegisterRequest

      // Validate inputs
      if (!email || !salt || !verifier) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email, salt, and verifier are required",
        } as ErrorResponse)
      }

      if (!email.includes("@")) {
        return res.status(400).json({
          error: "Invalid email",
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        } as ErrorResponse)
      }

      // Register user (will fail if email exists)
      try {
        const user = await registerUser(db, email, salt, verifier)
        return res.status(201).json({
          userId: user.id,
          salt: user.salt,
        })
      } catch (dbError: any) {
        if (dbError.message?.includes("UNIQUE")) {
          return res.status(409).json({
            error: "User already exists",
            code: "USER_EXISTS",
            message: "An account with this email already exists",
          } as ErrorResponse)
        }
        throw dbError
      }
    } catch (error) {
      console.error("[v0] Register error:", error)
      return res.status(500).json({
        error: "Registration failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during registration",
      } as ErrorResponse)
    }
  })

  /**
   * POST /auth/login
   * Authenticate user with SRP-style verifier.
   *
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "challenge": "client_computed_challenge",
   *   "clientProof": "proof_client_knows_verifier"
   * }
   *
   * Response: { userId, sessionToken, salt, serverProof }
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { email, challenge, clientProof } = req.body as LoginRequest

      // Validate inputs
      if (!email || !challenge || !clientProof) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email, challenge, and clientProof are required",
        } as ErrorResponse)
      }

      // Authenticate user
      const authResult = await authenticateUser(db, email, challenge, clientProof)

      if (!authResult.success) {
        // Don't reveal whether user exists or password is wrong (security best practice)
        return res.status(401).json({
          error: "Authentication failed",
          code: "AUTH_FAILED",
          message: "Invalid email or password",
        } as ErrorResponse)
      }

      const user = authResult.user!

      // Generate session token
      const sessionToken = await generateSessionToken(db, user.id)

      // Server proof to demonstrate server knows the verifier
      const serverProof = crypto
        .createHash("sha256")
        .update(user.verifier + challenge)
        .digest("hex")

      const response: LoginResponse = {
        userId: user.id,
        sessionToken,
        salt: user.salt,
        serverProof,
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error("[v0] Login error:", error)
      return res.status(500).json({
        error: "Login failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during login",
      } as ErrorResponse)
    }
  })

  /**
   * GET /auth/salt/:email
   * Fetch the salt for a given user email.
   * This is part of the challenge-response authentication.
   */
  router.get("/salt/:email", async (req: Request, res: Response) => {
    try {
      const { email } = req.params
      const user = await db.get("SELECT salt FROM users WHERE email = ?", [email])

      if (!user) {
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
          message: "No account found with this email",
        } as ErrorResponse)
      }

      return res.status(200).json({ salt: user.salt })
    } catch (error) {
      console.error("[v0] Salt fetch error:", error)
      return res.status(500).json({
        error: "Failed to fetch salt",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse)
    }
  })

  return router
}
