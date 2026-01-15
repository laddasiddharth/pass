# Blind Synchronization Backend - Architecture Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                      │
│  (Next.js/React with crypto-engine package)                 │
│                                                              │
│  ┌────────────────┐       ┌───────────────────┐            │
│  │ Master Password│       │ Encryption/Decryp-│            │
│  │ (RAM only)     │────→  │ tion (Argon2id +  │            │
│  └────────────────┘       │ AES-256-GCM)      │            │
│                           └───────────────────┘            │
│                                   ↓                         │
│                           ┌──────────────────┐             │
│                           │ Encrypted Vault  │             │
│                           │ + Metadata       │             │
│                           └──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
                              ↓↑
                         HTTPS/TLS
                              ↓↑
┌─────────────────────────────────────────────────────────────┐
│           Blind Synchronization Backend                      │
│           (Node.js Express)                                  │
│                                                              │
│  ┌──────────────────┐  ┌───────────────────────┐           │
│  │ Auth Routes      │  │ Sync Routes           │           │
│  │                  │  │                       │           │
│  │ • POST /register │  │ • POST /sync/push     │           │
│  │ • POST /login    │  │ • POST /sync/pull     │           │
│  │                  │  │                       │           │
│  │ (Verifier-based) │  │ (Metadata-only)       │           │
│  └──────────────────┘  └───────────────────────┘           │
│                                 ↓                           │
│                        ┌─────────────────┐                 │
│                        │  SQLite Database │                │
│                        │                  │                │
│                        │ • Users table    │                │
│                        │ • VaultBlobs     │                │
│                        │ • Sessions       │                │
│                        │ • SyncMetadata   │                │
│                        └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow (SRP-style Verifier)

### Registration
1. **Client side:**
   - Generate random salt (128 bits)
   - Derive Argon2id key from master password
   - Compute verifier = HMAC-SHA256(key, "verifier")
   - Send: `POST /auth/register { email, salt, verifier }`
   - **Server never receives password**

2. **Server side:**
   - Validate email format
   - Check email doesn't exist
   - Store: `users { email, salt, verifier }`
   - Return: `{ userId, salt }`

### Login
1. **Client side:**
   - Receive salt from server
   - Derive Argon2id key from master password
   - Generate random challenge
   - Compute proof = HMAC-SHA256(key + challenge, "proof")
   - Send: `POST /auth/login { email, challenge, clientProof }`

2. **Server side:**
   - Find user by email
   - Retrieve stored verifier
   - Compute expected proof = HMAC-SHA256(verifier + challenge, "proof")
   - Compare proofs (constant-time)
   - Generate session token
   - Compute serverProof to send back
   - Return: `{ userId, sessionToken, salt, serverProof }`

3. **Client side:**
   - Verify serverProof matches expected
   - Derive key again with stored salt
   - Store sessionToken for authenticated requests
   - **Session now ready for sync operations**

## Synchronization Flow

### Vault Push (Upload)
```
Client                          Server
  │
  ├─ Encrypt vault with AES-256-GCM
  │  (using derived key)
  │
  ├─ Generate unique nonce
  │
  ├─ POST /sync/push ──────────→
  │    { vault, nonce,
  │      timestamp, version }
  │
  │                        ← Validate nonce unique
  │                        ← Store vault blob
  │                        ← Update sync metadata
  │
  │  ← { vaultId }
  │
  └─ Confirm push complete

Database now contains:
  vaultBlobs {
    ciphertext: "...", (encrypted, opaque)
    salt: "...",       (unique for this vault)
    iv: "...",         (unique for this vault)
    authTag: "...",    (GCM auth tag)
    version: 1,
    nonce: "...",      (prevents replay)
    timestamp: ...
  }
```

### Vault Pull (Download)
```
Client                          Server
  │
  ├─ POST /sync/pull ──────────→
  │    { userId, deviceId,
  │      lastVersion?: 0 }
  │
  │                        ← Query vaultBlobs
  │                        ← Filter by version
  │                        ← Get sync metadata
  │
  │  ← { vaults: [...],
  │      currentVersion,
  │      lastSyncTimestamp }
  │
  └─ For each vault:
     ├─ Extract: ciphertext, salt, iv, authTag
     ├─ Decrypt with derived key + iv
     ├─ Verify authTag (GCM authentication)
     └─ Parse vault JSON
```

## Key Security Properties

### 1. Password Verification Without Transmission
- **Why?** Prevent man-in-the-middle from capturing password
- **How?** Use HMAC-derived verifier instead of password hash
- **Result?** Server can verify client knows password without storing it

### 2. Encryption Key Derivation on Client Only
- **Why?** Server cannot decrypt vaults even with database access
- **How?** Argon2id runs in browser, key never sent to server
- **Result?** Even stolen database cannot reveal plaintext

### 3. Nonce Uniqueness Prevents Replay Attacks
- **Why?** Attacker might capture encrypted vault and re-upload it
- **How?** Server rejects duplicate nonces
- **Result?** Old vault versions cannot be used to overwrite current state

### 4. GCM Authentication Tag Prevents Tampering
- **Why?** Attacker might modify ciphertext during transit
- **How?** AES-256-GCM includes authentication tag
- **Result?** Client detects any modification to ciphertext

### 5. Stateless Session Tokens
- **Why?** Server doesn't need to store session state
- **How?** Token is cryptographically generated and validated on each request
- **Result?** Can scale horizontally without shared session store

## Database Integrity

### Foreign Key Constraints
```
users (id PRIMARY KEY)
  ↓
  ├→ devices (userId FK)
  ├→ vaultBlobs (userId FK)
  ├→ syncMetadata (userId FK)
  └→ sessionTokens (userId FK)

devices (id PRIMARY KEY)
  ↓
  ├→ vaultBlobs (deviceId FK)
  └→ syncMetadata (deviceId FK)
```

All tables cascade on delete to maintain consistency.

### Indexes for Performance
```
users(email)              - Fast email lookup during login
devices(userId)           - Fast device lookup
vaultBlobs(userId)        - Fast vault query by user
vaultBlobs(version)       - Fast version-based filtering
syncMetadata(userId)      - Fast metadata lookup
sessionTokens(expiresAt)  - Fast token cleanup
```

## Threat Models & Mitigations

### Threat: Database Compromise
**Attack:** Attacker steals database with all vaults
**Mitigation:** Vaults are encrypted with client-side keys
**Result:** Attacker sees only `{ ciphertext, salt, iv, authTag }` - cannot decrypt

### Threat: Network Interception (MITM)
**Attack:** Attacker intercepts vault during push
**Mitigation:** HTTPS/TLS + ciphertext already encrypted
**Result:** Attacker sees only encrypted blob

### Threat: Brute Force Password Attack
**Attack:** Attacker tries many passwords
**Mitigation:** Argon2id with 64MB memory, 3 iterations, 4 parallelism
**Result:** ~1 second per attempt, making brute force impractical

### Threat: Replay Attack
**Attack:** Attacker replays old encrypted vault
**Mitigation:** Nonce uniqueness + version tracking
**Result:** Resubmitted vault with old nonce is rejected

### Threat: Session Hijacking
**Attack:** Attacker steals session token and impersonates user
**Mitigation:** HTTPS-only tokens, short expiration (24h), can invalidate
**Result:** Token only works over HTTPS, expires quickly

### Threat: Offline Key Derivation (Offline Brute Force)
**Attack:** Attacker has salt and wants to brute force password
**Mitigation:** Argon2id with 64MB memory and multiple iterations
**Result:** Brute force requires significant computation per guess

## API Error Handling

All endpoints return consistent error format:
```json
{
  "error": "Human-readable error",
  "code": "MACHINE_READABLE_CODE",
  "message": "Detailed description"
}
```

Common error codes:
- `INVALID_REQUEST` - Missing or malformed fields
- `USER_EXISTS` - Email already registered
- `AUTH_FAILED` - Wrong password or invalid proof
- `INVALID_TOKEN` - Session token expired or invalid
- `FORBIDDEN` - User trying to access another user's data
- `NOT_FOUND` - Resource doesn't exist
- `INTERNAL_ERROR` - Server error

## Scaling Considerations

### Horizontal Scaling
- Remove SQLite, use PostgreSQL or MySQL
- Sessions can be stored in Redis
- Load balance with stateless design

### Performance Optimization
- Add database connection pooling
- Cache salt lookups during login
- Implement nonce garbage collection (old nonces)
- Add request rate limiting

### Multi-Device Sync
- Each device has its own `deviceId`
- Devices can have different vault versions
- Client is responsible for merging conflicts
- Server provides full history via `lastVersion` parameter

## Future Enhancements

1. **End-to-End Encryption for API Communication**
   - Add public key encryption layer on top of TLS

2. **Time-Based Nonce Expiration**
   - Old nonces automatically expire after 30 days

3. **Device Trust Levels**
   - Trusted devices skip additional verification
   - New devices require confirmation

4. **Audit Logging**
   - Log all authentication events (encrypted)
   - Never log sensitive data

5. **Backup Recovery**
   - Allow recovery codes for account access if password forgotten
   - Codes encrypted with master password

6. **Biometric Authentication**
   - Optional second factor using device biometrics
   - Still maintains zero-knowledge property
