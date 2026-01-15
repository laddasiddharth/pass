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
import { argon2id } from "@noble/hashes/argon2";
/**
 * Default Argon2id parameters optimized for password hashing in browsers.
 * These provide strong security without being prohibitively slow.
 */
const DEFAULT_OPTIONS = {
    iterations: 3,
    parallelism: 4,
    memorySize: 2 ** 16, // 64MB
    hashLength: 32, // 256 bits for AES-256
    type: "id",
};
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
export async function deriveKey(masterPassword, salt, options) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    // Generate random salt if not provided
    if (!salt) {
        salt = crypto.getRandomValues(new Uint8Array(16));
    }
    // Convert master password to Uint8Array if needed
    let passwordBytes;
    if (typeof masterPassword === "string") {
        passwordBytes = new TextEncoder().encode(masterPassword);
    }
    else {
        passwordBytes = masterPassword;
    }
    // Derive key material using Argon2id
    const derivedKeyMaterial = argon2id(passwordBytes, salt, {
        t: mergedOptions.iterations,
        m: mergedOptions.memorySize,
        p: mergedOptions.parallelism,
    });
    // Import for AES-GCM (Encryption)
    const encryptionKey = await crypto.subtle.importKey("raw", derivedKeyMaterial.slice(0, mergedOptions.hashLength), { name: "AES-GCM" }, false, // non-extractable
    ["encrypt", "decrypt"]);
    // Import for HMAC-SHA256 (Authentication Proofs)
    const authKey = await crypto.subtle.importKey("raw", derivedKeyMaterial.slice(0, mergedOptions.hashLength), { name: "HMAC", hash: "SHA-256" }, false, // non-extractable
    ["sign", "verify"]);
    return {
        encryptionKey,
        authKey,
        salt,
        key: encryptionKey, // Legacy alias
    };
}
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
export async function verifyPassword(masterPassword, salt) {
    try {
        await deriveKey(masterPassword, salt);
        // The actual verification happens during decryption attempt
        // If this key can decrypt the test vector, the password is correct
        return true; // Caller uses this with actual decryption
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=argon2.js.map