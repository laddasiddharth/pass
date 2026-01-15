/**
 * High-level vault API combining key derivation and encryption.
 *
 * This module provides the main entry point for encryption/decryption operations.
 * It enforces zero-knowledge principles by ensuring:
 * - Keys are never persisted
 * - Plaintext is never logged
 * - Server cannot derive keys from ciphertext alone
 */

import { deriveKey } from "./argon2.js"
import { encrypt, decrypt } from "./aes.js"
import type { VaultEntry, EncryptedVault, Argon2idOptions, DecryptResult } from "./types.js"

/**
 * Complete encryption workflow: password → key → encrypted vault entry
 *
 * @param masterPassword - User's master password
 * @param entry - Vault entry to encrypt (site, username, password, metadata)
 * @param options - Optional Argon2id parameters
 * @returns EncryptedVault object that can be safely stored on server
 *
 * Zero-knowledge guarantee:
 * - The masterPassword is never transmitted or stored
 * - The derived key is only in memory during this function call
 * - The returned EncryptedVault contains no information about the password
 */
export async function encryptVault(
  masterPassword: string,
  entry: VaultEntry,
  options?: Argon2idOptions,
): Promise<EncryptedVault> {
  const derivedKey = await deriveKey(masterPassword, undefined, options)
  const encrypted = await encrypt(entry, derivedKey)

  // Key is now out of scope and cannot be accessed
  return encrypted
}

/**
 * Complete decryption workflow: password + encrypted vault → plaintext entry
 *
 * @param masterPassword - User's master password
 * @param encrypted - EncryptedVault object to decrypt
 * @returns DecryptResult with either the decrypted entry or an error
 *
 * Zero-knowledge guarantee:
 * - If password is incorrect, decryption fails and no plaintext is returned
 * - The key is only in memory during this function call
 * - Wrong password results in authentication tag failure
 */
export async function decryptVault(masterPassword: string, encrypted: EncryptedVault): Promise<DecryptResult> {
  try {
    // Derive key using the salt from the encrypted vault
    const derivedKey = await deriveKey(masterPassword, base64ToBuffer(encrypted.salt))

    // Attempt decryption
    const entry = await decrypt(encrypted, derivedKey)

    // Key is now out of scope
    return {
      success: true,
      data: entry,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown decryption error",
    }
  }
}

/**
 * Validates a vault entry structure.
 * Ensures required fields are present and correct type.
 */
export function validateVaultEntry(entry: VaultEntry): boolean {
  return (
    typeof entry.site === "string" &&
    entry.site.length > 0 &&
    typeof entry.username === "string" &&
    entry.username.length > 0 &&
    typeof entry.password === "string" &&
    entry.password.length > 0
  )
}

/**
 * Helper: Convert base64 string to Uint8Array.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}

/**
 * Creates a new vault entry with metadata.
 */
export function createVaultEntry(
  site: string,
  username: string,
  password: string,
  metadata?: Record<string, any>,
): VaultEntry {
  return {
    site,
    username,
    password,
    metadata: {
      createdAt: new Date().toISOString(),
      ...metadata,
    },
  }
}
