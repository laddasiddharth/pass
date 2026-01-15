import { v4 as uuidv4 } from "uuid"
import type { Database } from "../database/schema.js"
import type { VaultBlob } from "../types/index.js"

/**
 * Push encrypted vault to server for storage.
 * Server validates nonce uniqueness to prevent replay attacks.
 */
export async function pushVault(
  db: Database,
  userId: string,
  deviceId: string,
  vault: {
    ciphertext: string
    salt: string
    iv: string
    authTag: string
    version: number
    timestamp: number
    nonce: string
  },
): Promise<{ success: boolean; vaultId?: string; error?: string }> {
  try {
    // Verify nonce is unique (prevents replay attacks)
    const existingNonce = await db.get("SELECT id FROM vaultBlobs WHERE nonce = ?", [vault.nonce])

    if (existingNonce) {
      return { success: false, error: "Duplicate nonce - replay attack detected" }
    }

    const vaultId = uuidv4()
    const now = Date.now()

    // Store the encrypted vault blob
    await db.run(
      `INSERT INTO vaultBlobs 
       (id, userId, deviceId, ciphertext, salt, iv, authTag, version, timestamp, nonce, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vaultId,
        userId,
        deviceId,
        vault.ciphertext,
        vault.salt,
        vault.iv,
        vault.authTag,
        vault.version,
        vault.timestamp,
        vault.nonce,
        now,
        now,
      ],
    )

    // Update sync metadata
    await updateSyncMetadata(db, userId, deviceId, vault.version, vault.nonce)

    return { success: true, vaultId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Pull encrypted vaults from server.
 * Returns all vaults for the user (optionally filtered by version).
 * Client is responsible for conflict resolution and decryption.
 */
export async function pullVaults(
  db: Database,
  userId: string,
  deviceId: string,
  lastVersion?: number,
): Promise<{ success: boolean; vaults?: VaultBlob[]; error?: string }> {
  try {
    let query = "SELECT * FROM vaultBlobs WHERE userId = ?"
    const params: any[] = [userId]

    if (lastVersion !== undefined) {
      query += " AND version > ?"
      params.push(lastVersion)
    }

    query += " ORDER BY version DESC"

    const rows = await db.all(query, params)

    const vaults: VaultBlob[] = rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      deviceId: row.deviceId,
      ciphertext: row.ciphertext,
      salt: row.salt,
      iv: row.iv,
      authTag: row.authTag,
      version: row.version,
      timestamp: row.timestamp,
      nonce: row.nonce,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }))

    return { success: true, vaults }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Update sync metadata to track device state.
 */
async function updateSyncMetadata(
  db: Database,
  userId: string,
  deviceId: string,
  vaultVersion: number,
  nonce: string,
): Promise<void> {
  const now = Date.now()
  const id = uuidv4()

  // Try to update existing metadata
  const existing = await db.get("SELECT id FROM syncMetadata WHERE userId = ? AND deviceId = ?", [userId, deviceId])

  if (existing) {
    await db.run(
      `UPDATE syncMetadata 
       SET lastUpdated = ?, vaultVersion = ?, nonce = ?, updatedAt = ? 
       WHERE userId = ? AND deviceId = ?`,
      [now, vaultVersion, nonce, now, userId, deviceId],
    )
  } else {
    await db.run(
      `INSERT INTO syncMetadata 
       (id, userId, deviceId, lastUpdated, vaultVersion, nonce, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, deviceId, now, vaultVersion, nonce, now, now],
    )
  }
}

/**
 * Get current sync metadata for a device.
 */
export async function getSyncMetadata(
  db: Database,
  userId: string,
  deviceId: string,
): Promise<{ success: boolean; metadata?: any; error?: string }> {
  try {
    const metadata = await db.get("SELECT * FROM syncMetadata WHERE userId = ? AND deviceId = ?", [userId, deviceId])

    if (!metadata) {
      return { success: true, metadata: null }
    }

    return {
      success: true,
      metadata: {
        userId: metadata.userId,
        deviceId: metadata.deviceId,
        lastUpdated: metadata.lastUpdated,
        vaultVersion: metadata.vaultVersion,
        nonce: metadata.nonce,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}
