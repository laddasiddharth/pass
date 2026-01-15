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
import type { DerivedKey, EncryptedVault, VaultEntry } from "./types.js";
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
export declare function encrypt(entry: VaultEntry, derivedKey: DerivedKey): Promise<EncryptedVault>;
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
export declare function decrypt(encrypted: EncryptedVault, derivedKey: DerivedKey): Promise<VaultEntry>;
//# sourceMappingURL=aes.d.ts.map