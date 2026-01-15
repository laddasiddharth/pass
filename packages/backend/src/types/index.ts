/**
 * Core type definitions for the blind synchronization backend.
 * All types enforce the constraint that the server never handles plaintext passwords or keys.
 */

export interface User {
  id: string
  email: string
  salt: string // Random salt for Argon2id derivation
  verifier: string // SRP-style password verifier (never derives master password)
  createdAt: Date
  updatedAt: Date
}

export interface Device {
  id: string
  userId: string
  deviceName: string
  deviceFingerprint: string
  createdAt: Date
  lastSyncedAt: Date
}

export interface VaultBlob {
  id: string
  userId: string
  deviceId: string
  ciphertext: string // Base64-encoded encrypted vault data
  salt: string // Unique salt used during encryption
  iv: string // Base64-encoded IV from AES-256-GCM
  authTag: string // Base64-encoded authentication tag
  version: number // Vault version/revision number
  timestamp: number // Unix timestamp of creation
  nonce: string // Random nonce to prevent replay attacks
  createdAt: Date
  updatedAt: Date
}

export interface SyncMetadata {
  userId: string
  deviceId: string
  lastUpdated: number // Unix timestamp
  vaultVersion: number // Current vault version
  nonce: string // Latest nonce to prevent replay
}

/**
 * Request/Response types for authentication flow
 */
export interface RegisterRequest {
  email: string
  salt: string // Random salt from client
  verifier: string // Computed verifier (client-side, password never leaves client)
}

export interface LoginRequest {
  email: string
  challenge: string // Client-side computed challenge
  clientProof: string // Proof that client knows the verifier
}

export interface LoginResponse {
  userId: string
  sessionToken: string // Stateless JWT-like token
  salt: string // Echo back for client verification
  serverProof: string // Server proof (demonstrates server knows verifier)
}

/**
 * Sync API types
 */
export interface SyncPushRequest {
  userId: string
  deviceId: string
  sessionToken: string
  vault: {
    ciphertext: string
    salt: string
    iv: string
    authTag: string
    version: number
    timestamp: number
    nonce: string
  }
}

export interface SyncPullRequest {
  userId: string
  deviceId: string
  sessionToken: string
  lastVersion?: number // Only pull changes after this version
}

export interface SyncPullResponse {
  vaults: VaultBlob[]
  lastSyncTimestamp: number
  currentVersion: number
}

/**
 * Error response type
 */
export interface ErrorResponse {
  error: string
  code: string
  message: string
}
