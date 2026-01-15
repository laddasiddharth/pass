/**
 * AES-256-GCM encryption module.
 *
 * Provides authenticated encryption for vault data using AES-256 in GCM mode.
 * GCM provides both confidentiality and authenticity, protecting against tampering.
 *
 * Security properties:
 * - 256-bit key (from Argon2id derivation)
 * - 96-bit random IV (nonce) generated per encryption
 * - Authentication tag included in ciphertext (prevents tampering)
 * - No plaintext is ever logged or stored
 */

import type { DerivedKey, EncryptedVault, VaultEntry } from "./types.js"

const ALGORITHM = "AES-GCM"
const IV_LENGTH = 12 // 96 bits - recommended for GCM
// TAG_LENGTH is 128 bits (16 bytes) - automatically handled by GCM mode

/**
 * Encrypts a vault entry using the derived key.
 *
 * @param entry - The vault entry to encrypt
 * @param derivedKey - The DerivedKey from deriveKey()
 * @returns EncryptedVault object with base64-encoded ciphertext, IV, and salt
 *
 * Security notes:
 * - A new random IV is generated for each encryption
 * - The IV is included in the output (standard practice for GCM)
 * - The salt is included so it can be stored with the encrypted data
 * - Authentication tag is automatically included by GCM mode
 */
export async function encrypt(entry: VaultEntry, derivedKey: DerivedKey): Promise<EncryptedVault> {
  // Generate a random 96-bit IV for this encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Serialize the vault entry to JSON
  const plaintext = JSON.stringify(entry)
  const plaintextBytes = new TextEncoder().encode(plaintext)

  // Encrypt using AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    derivedKey.encryptionKey,
    plaintextBytes,
  )

  // Return serializable encrypted vault object
  return {
    ciphertext: bufferToBase64(new Uint8Array(ciphertext)),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(derivedKey.salt),
    algorithm: "AES-256-GCM",
    derivationAlgorithm: "Argon2id",
  }
}

/**
 * Decrypts a vault entry using the derived key.
 *
 * @param encrypted - The EncryptedVault object to decrypt
 * @param derivedKey - The DerivedKey from deriveKey()
 * @returns The decrypted VaultEntry, or an error if decryption fails
 *
 * Security notes:
 * - Failed decryption throws an error (wrong password or tampered ciphertext)
 * - The ciphertext includes an authentication tag that must be valid
 * - If authentication fails, the plaintext is never returned
 */
export async function decrypt(encrypted: EncryptedVault, derivedKey: DerivedKey): Promise<VaultEntry> {
  const ciphertext = base64ToBuffer(encrypted.ciphertext)
  const iv = base64ToBuffer(encrypted.iv)

  try {
    // Decrypt using AES-256-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
      },
      derivedKey.encryptionKey,
      ciphertext as BufferSource,
    )

    // Parse the decrypted JSON
    const plaintextString = new TextDecoder().decode(plaintext)
    const entry: VaultEntry = JSON.parse(plaintextString)

    return entry
  } catch (error) {
    // GCM authentication failed (wrong password or tampered ciphertext)
    throw new Error("Decryption failed. This could be due to incorrect password or corrupted data.")
  }
}

/**
 * Helper: Convert Uint8Array to base64 string.
 * Used for serializing binary data to JSON.
 */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

/**
 * Helper: Convert base64 string to Uint8Array.
 * Used for deserializing binary data from JSON.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}
