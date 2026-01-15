/**
 * Argon2id key derivation module.
 *
 * This module provides browser-compatible Argon2id key derivation using
 * the @noble/hashes library, which is pure JavaScript and works in all
 * modern browsers without WASM dependencies.
 *
 * Security note: The derived key is kept in memory as a CryptoKey object
 * and never serialized or persisted to disk.
 */
import type { Argon2idOptions, DerivedKey } from "./types.js";
/**
 * Derives a cryptographic key from a master password using Argon2id.
 *
 * @param masterPassword - The user's master password (will be cleared after use)
 * @param salt - Optional salt; if not provided, a random salt is generated
 * @param options - Optional Argon2id parameters
 * @returns DerivedKey object containing the derived CryptoKey and salt
 *
 * Security constraints:
 * - The returned key is a CryptoKey and cannot be inspected or serialized
 * - The salt is always returned so it can be stored alongside encrypted data
 * - The masterPassword buffer is NOT automatically cleared (caller's responsibility)
 */
export declare function deriveKey(masterPassword: string | Uint8Array, salt?: Uint8Array, options?: Argon2idOptions): Promise<DerivedKey>;
/**
 * Verifies that two master passwords would produce the same derived key.
 * Used during authentication to verify the master password without storing it.
 *
 * @param masterPassword - The password to verify
 * @param salt - The salt from the original derivation
 * @param referenceKey - A CryptoKey derived from the original password
 * @returns boolean indicating if the password matches
 *
 * Note: This function derives a new key and attempts a test decryption.
 * A failed decryption indicates an incorrect password.
 */
export declare function verifyPassword(masterPassword: string, salt: Uint8Array): Promise<boolean>;
//# sourceMappingURL=argon2.d.ts.map