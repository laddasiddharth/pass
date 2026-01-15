/**
 * Synchronization routes: push and pull vault data.
 * These endpoints store and retrieve encrypted vault blobs.
 */

import { Router, type Request, type Response } from "express"
import type { Database } from "../database/schema.js"
import { validateSessionToken } from "../services/authService.js"
import { pushVault, pullVaults, getSyncMetadata } from "../services/syncService.js"
import type { SyncPushRequest, SyncPullRequest, SyncPullResponse, ErrorResponse } from "../types/index.js"

/**
 * Middleware to validate session token in Authorization header.
 */
function createAuthMiddleware(db: Database) {
  return async (req: Request, res: Response, next: Function) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Missing authorization",
          code: "NO_AUTH",
          message: "Authorization header with Bearer token required",
        } as ErrorResponse)
      }

      const token = authHeader.substring(7)
      const validation = await validateSessionToken(db, token)

      if (!validation.valid) {
        return res.status(401).json({
          error: "Invalid or expired token",
          code: "INVALID_TOKEN",
          message: validation.error,
        } as ErrorResponse)
      }
      ;(req as any).userId = validation.userId
      next()
    } catch (error) {
      console.error("[v0] Auth middleware error:", error)
      return res.status(500).json({
        error: "Auth validation failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during authentication",
      } as ErrorResponse)
    }
  }
}

export function createSyncRouter(db: Database): Router {
  const router = Router()
  const authMiddleware = createAuthMiddleware(db)

  /**
   * POST /sync/push
   * Push encrypted vault to server.
   *
   * Headers: Authorization: Bearer <sessionToken>
   *
   * Request body:
   * {
   *   "userId": "user_id",
   *   "deviceId": "device_id",
   *   "vault": {
   *     "ciphertext": "base64_encrypted_data",
   *     "salt": "base64_salt",
   *     "iv": "base64_iv",
   *     "authTag": "base64_auth_tag",
   *     "version": 1,
   *     "timestamp": 1234567890,
   *     "nonce": "unique_nonce"
   *   }
   * }
   *
   * Response: { vaultId }
   */
  router.post("/push", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, vault } = req.body as SyncPushRequest
      const requestingUserId = (req as any).userId

      // Verify user owns the vault
      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only push vaults for your own account",
        } as ErrorResponse)
      }

      // Validate vault structure
      if (
        !vault ||
        !vault.ciphertext ||
        !vault.salt ||
        !vault.iv ||
        !vault.authTag ||
        typeof vault.version !== "number" ||
        typeof vault.timestamp !== "number" ||
        !vault.nonce
      ) {
        return res.status(400).json({
          error: "Invalid vault structure",
          code: "INVALID_VAULT",
          message: "Vault must include ciphertext, salt, iv, authTag, version, timestamp, and nonce",
        } as ErrorResponse)
      }

      // Push vault to server
      const result = await pushVault(db, userId, deviceId, vault)

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "PUSH_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      return res.status(201).json({
        vaultId: result.vaultId,
      })
    } catch (error) {
      console.error("[v0] Push error:", error)
      return res.status(500).json({
        error: "Push failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during vault push",
      } as ErrorResponse)
    }
  })

  /**
   * POST /sync/pull
   * Pull encrypted vaults from server.
   *
   * Headers: Authorization: Bearer <sessionToken>
   *
   * Request body:
   * {
   *   "userId": "user_id",
   *   "deviceId": "device_id",
   *   "lastVersion": 0 (optional, only pull vaults after this version)
   * }
   *
   * Response: { vaults, lastSyncTimestamp, currentVersion }
   */
  router.post("/pull", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, lastVersion } = req.body as SyncPullRequest
      const requestingUserId = (req as any).userId

      // Verify user owns the vault
      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only pull vaults for your own account",
        } as ErrorResponse)
      }

      // Pull vaults from server
      const result = await pullVaults(db, userId, deviceId, lastVersion)

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "PULL_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      // Get current metadata
      const metadataResult = await getSyncMetadata(db, userId, deviceId)
      const currentVersion = metadataResult.metadata?.vaultVersion || 0
      const lastSyncTimestamp = metadataResult.metadata?.lastUpdated || Date.now()

      const response: SyncPullResponse = {
        vaults: result.vaults || [],
        lastSyncTimestamp,
        currentVersion,
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error("[v0] Pull error:", error)
      return res.status(500).json({
        error: "Pull failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during vault pull",
      } as ErrorResponse)
    }
  })

  return router
}
