/**
 * Authentication service using SRP-style verifier mechanism.
 *
 * The server NEVER receives or stores the master password.
 * Instead, it uses a password verifier (computed client-side from the password).
 * This ensures the server cannot derive the encryption key even with database compromise.
 */

import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "../database/schema.js"
import type { User } from "../types/index.js"

/**
 * Generate a server proof for authentication handshake.
 * The server computes this from the stored verifier and client challenge.
 * This demonstrates to the client that the server knows the verifier.
 */
function generateServerProof(verifier: string, clientChallenge: string): string {
  const combined = crypto
    .createHash("sha256")
    .update(verifier + clientChallenge)
    .digest("hex")
  return combined
}

/**
 * Verify client proof during login.
 * Client sends a proof that it derived correctly from the password.
 */
function verifyClientProof(verifier: string, clientChallenge: string, clientProof: string): boolean {
  const expectedProof = crypto
    .createHash("sha256")
    .update(verifier + clientChallenge)
    .digest("hex")

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(clientProof), Buffer.from(expectedProof))
}

/**
 * Register a new user with password verifier.
 * The client computes the verifier from the master password locally.
 * The server stores only salt and verifier, never the password.
 */
export async function registerUser(db: Database, email: string, salt: string, verifier: string): Promise<User> {
  const userId = uuidv4()
  const now = Date.now()

  await db.run(
    `INSERT INTO users (id, email, salt, verifier, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, email, salt, verifier, now, now],
  )

  return {
    id: userId,
    email,
    salt,
    verifier,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }
}

/**
 * Authenticate user during login.
 * Server verifies that the client knows the verifier without ever receiving the password.
 */
export async function authenticateUser(
  db: Database,
  email: string,
  clientChallenge: string,
  clientProof: string,
): Promise<{ success: boolean; user?: User; error?: string }> {
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email])

  if (!user) {
    return { success: false, error: "User not found" }
  }

  // Verify that client proof matches what we'd expect from the stored verifier
  try {
    const isValid = verifyClientProof(user.verifier, clientChallenge, clientProof)
    if (!isValid) {
      return { success: false, error: "Authentication failed" }
    }
  } catch (error) {
    return { success: false, error: "Authentication verification failed" }
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      salt: user.salt,
      verifier: user.verifier,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    },
  }
}

/**
 * Generate session token for authenticated requests.
 * Token is stateless (could be JWT) or stored in database.
 */
export async function generateSessionToken(
  db: Database,
  userId: string,
  expirationMinutes: number = 24 * 60, // 24 hours
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = Date.now() + expirationMinutes * 60 * 1000

  await db.run(
    `INSERT INTO sessionTokens (id, userId, token, expiresAt, createdAt) 
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), userId, token, expiresAt, Date.now()],
  )

  return token
}

/**
 * Validate session token and return user if valid.
 */
export async function validateSessionToken(
  db: Database,
  token: string,
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const session = await db.get("SELECT * FROM sessionTokens WHERE token = ? AND expiresAt > ?", [token, Date.now()])

  if (!session) {
    return { valid: false, error: "Invalid or expired token" }
  }

  return { valid: true, userId: session.userId }
}

/**
 * Invalidate session token on logout.
 */
export async function invalidateSessionToken(db: Database, token: string): Promise<void> {
  await db.run("DELETE FROM sessionTokens WHERE token = ?", [token])
}
