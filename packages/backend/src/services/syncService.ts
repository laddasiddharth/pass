import { VaultBlob, SyncMetadata } from "../database/models.js"
import type { VaultBlob as VaultBlobType } from "../types/index.js"

export async function pushVault(
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
    const blob = new VaultBlob({
      userId,
      deviceId,
      ciphertext: vault.ciphertext,
      salt: vault.salt,
      iv: vault.iv,
      authTag: vault.authTag,
      version: vault.version,
      timestamp: vault.timestamp,
      nonce: vault.nonce,
    })

    await blob.save()

    // Update sync metadata
    await updateSyncMetadata(userId, deviceId, vault.version, vault.nonce)

    return { success: true, vaultId: blob._id.toString() }
  } catch (error: any) {
    if (error.code === 11000) {
      return { success: false, error: "Duplicate nonce - replay attack detected" }
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

export async function pullVaults(
  userId: string,
  deviceId: string,
  lastVersion?: number,
): Promise<{ success: boolean; vaults?: VaultBlobType[]; error?: string }> {
  try {
    const filter: any = { userId }
    if (lastVersion !== undefined) {
      filter.version = { $gt: lastVersion }
    }

    const rows = await VaultBlob.find(filter).sort({ version: -1 })

    const vaults: VaultBlobType[] = rows.map((row) => ({
      id: row._id.toString(),
      userId: row.userId.toString(),
      deviceId: row.deviceId,
      ciphertext: row.ciphertext,
      salt: row.salt,
      iv: row.iv,
      authTag: row.authTag,
      version: row.version,
      timestamp: row.timestamp,
      nonce: row.nonce,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    return { success: true, vaults }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

async function updateSyncMetadata(
  userId: string,
  deviceId: string,
  vaultVersion: number,
  nonce: string,
): Promise<void> {
  const now = Date.now()

  await SyncMetadata.findOneAndUpdate(
    { userId, deviceId },
    {
      lastUpdated: now,
      vaultVersion,
      nonce,
      updatedAt: new Date(now),
    },
    { upsert: true },
  )
}

export async function getSyncMetadata(
  userId: string,
  deviceId: string,
): Promise<{ success: boolean; metadata?: any; error?: string }> {
  try {
    const metadata = await SyncMetadata.findOne({ userId, deviceId })

    if (!metadata) {
      return { success: true, metadata: null }
    }

    return {
      success: true,
      metadata: {
        userId: metadata.userId.toString(),
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
