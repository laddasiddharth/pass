/**
 * Synchronization routes: push and pull vault data.
 */

import { Router, type Request, type Response } from "express"
import { validateSessionToken } from "../services/authService.js"
import { pushVault, pullVaults, getSyncMetadata } from "../services/syncService.js"
import type { SyncPushRequest, SyncPullRequest, SyncPullResponse, ErrorResponse } from "../types/index.js"

async function authMiddleware(req: Request, res: Response, next: Function) {
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
    const validation = await validateSessionToken(token)

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

export function createSyncRouter(): Router {
  const router = Router()

  /**
   * POST /sync/push
   * Push encrypted vault to server.
   */
  router.post("/push", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, vault } = req.body as SyncPushRequest
      const requestingUserId = (req as any).userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only push vaults for your own account",
        } as ErrorResponse)
      }

      const result = await pushVault(userId, deviceId, vault)

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
   */
  router.post("/pull", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, lastVersion } = req.body as SyncPullRequest
      const requestingUserId = (req as any).userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only pull vaults for your own account",
        } as ErrorResponse)
      }

      const result = await pullVaults(userId, deviceId, lastVersion)

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "PULL_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      const metadataResult = await getSyncMetadata(userId, deviceId)
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
