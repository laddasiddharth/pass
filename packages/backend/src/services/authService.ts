import crypto from "crypto"
import { User, Session } from "../database/models.js"
import type { User as UserType } from "../types/index.js"

function verifyClientProof(verifier: string, clientChallenge: string, clientProof: string): boolean {
  const expectedProof = crypto
    .createHash("sha256")
    .update(verifier + clientChallenge)
    .digest("hex")

  return crypto.timingSafeEqual(Buffer.from(clientProof), Buffer.from(expectedProof))
}

export async function registerUser(email: string, salt: string, verifier: string): Promise<UserType> {
  const user = new User({
    email,
    salt,
    verifier,
  })

  await user.save()

  return {
    id: user._id.toString(),
    email: user.email,
    salt: user.salt,
    verifier: user.verifier,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export async function authenticateUser(
  email: string,
  clientChallenge: string,
  clientProof: string,
): Promise<{ success: boolean; user?: UserType; error?: string }> {
  const user = await User.findOne({ email })

  if (!user) {
    return { success: false, error: "User not found" }
  }

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
      id: user._id.toString(),
      email: user.email,
      salt: user.salt,
      verifier: user.verifier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  }
}

export async function generateSessionToken(
  userId: string,
  expirationMinutes: number = 24 * 60,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000)

  const session = new Session({
    userId,
    token,
    expiresAt,
  })

  await session.save()
  return token
}

export async function validateSessionToken(
  token: string,
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } })

  if (!session) {
    return { valid: false, error: "Invalid or expired token" }
  }

  return { valid: true, userId: session.userId.toString() }
}

export async function invalidateSessionToken(token: string): Promise<void> {
  await Session.deleteOne({ token })
}

export async function getUserSalt(email: string): Promise<string | null> {
  const user = await User.findOne({ email })
  return user ? user.salt : null
}
