/**
 * crypto-engine: Zero-Knowledge Cryptographic Core for Password Managers
 *
 * Main entry point exporting all public APIs.
 */
export { deriveKey, verifyPassword, } from "./argon2.js";
export { encrypt, decrypt, } from "./aes.js";
export { encryptVault, decryptVault, validateVaultEntry, createVaultEntry, } from "./vault.js";
export type { DerivedKey, VaultEntry, EncryptedVault, Argon2idOptions, DecryptResult, } from "./types.js";
//# sourceMappingURL=index.d.ts.map