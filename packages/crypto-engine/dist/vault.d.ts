/**
 * High-level vault API combining key derivation and encryption.
 *
 * This module provides the main entry point for encryption/decryption operations.
 * It enforces zero-knowledge principles by ensuring:
 * - Keys are never persisted
 * - Plaintext is never logged
 * - Server cannot derive keys from ciphertext alone
 */
import type { VaultEntry, EncryptedVault, Argon2idOptions, DecryptResult } from "./types.js";
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
export declare function encryptVault(masterPassword: string, entry: VaultEntry, options?: Argon2idOptions): Promise<EncryptedVault>;
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
export declare function decryptVault(masterPassword: string, encrypted: EncryptedVault): Promise<DecryptResult>;
/**
 * Validates a vault entry structure.
 * Ensures required fields are present and correct type.
 */
export declare function validateVaultEntry(entry: VaultEntry): boolean;
/**
 * Creates a new vault entry with metadata.
 */
export declare function createVaultEntry(site: string, username: string, password: string, metadata?: Record<string, any>): VaultEntry;
//# sourceMappingURL=vault.d.ts.map