/**
 * Type definitions for the crypto-engine package.
 * Ensures strict separation between keys, ciphertexts, and plaintext data.
 */
/**
 * Represents a derived encryption key in memory.
 * This type is never serialized or persisted.
 */
export interface DerivedKey {
    readonly encryptionKey: CryptoKey;
    readonly authKey: CryptoKey;
    readonly salt: Uint8Array;
    /** @deprecated Use encryptionKey instead */
    readonly key: CryptoKey;
}
/**
 * Vault entry structure that can be serialized to JSON.
 */
export interface VaultEntry {
    site: string;
    username: string;
    password: string;
    metadata?: {
        createdAt?: string;
        updatedAt?: string;
        [key: string]: any;
    };
}
/**
 * Encrypted vault data (serializable).
 * Contains ciphertext, IV, and salt for decryption.
 */
export interface EncryptedVault {
    ciphertext: string;
    iv: string;
    salt: string;
    algorithm: "AES-256-GCM";
    derivationAlgorithm: "Argon2id";
}
/**
 * Options for Argon2id key derivation.
 */
export interface Argon2idOptions {
    iterations?: number;
    parallelism?: number;
    memorySize?: number;
    hashLength?: number;
    type?: "id" | "i" | "d";
}
/**
 * Result of decryption attempt.
 * Success contains the plaintext data, failure contains the error.
 */
export type DecryptResult = {
    success: true;
    data: VaultEntry;
} | {
    success: false;
    error: string;
};
//# sourceMappingURL=types.d.ts.map