# Blind Synchronization Backend

A cryptographically blind password manager backend that implements **zero-knowledge** synchronization. The server stores encrypted vault data and authenticates users without ever handling plaintext passwords or decryption keys.

## Architecture Overview

### Security Properties

This backend provides the following guarantees:

1. **Master Password Never Transmitted**: Authentication uses a verifier-based system (SRP-style) where the server only stores a derived verifier, never the password itself.

2. **Keys Never Derived by Server**: The server cannot derive the encryption key even if the database is compromised, because the key derivation (Argon2id) happens entirely on the client.

3. **Encrypted Vaults Are Opaque**: The server stores encrypted vault blobs as-is without inspecting, decrypting, or modifying them.

4. **No Conflict Resolution Server-Side**: The server does not merge vaults or resolve conflicts. Each device maintains its own version, and clients handle synchronization logic.

5. **Replay Attack Prevention**: Each vault push includes a unique nonce that the server validates, preventing replay of old encrypted vaults.

6. **Timing Attack Resistance**: Session token and password verification use constant-time comparisons.

## API Endpoints

### Authentication

#### `POST /auth/register`

Register a new user with password verifier.

**Request:**

```json
{
  "email": "user@example.com",
  "salt": "base64_random_salt",
  "verifier": "hex_computed_verifier"
}
```

The `salt` and `verifier` are computed client-side from the master password:

- `salt`: Random bytes used in Argon2id
- `verifier`: HMAC-SHA256(Argon2id_key, "verifier") - proves the client knows the password

**Response (201):**

```json
{
  "userId": "uuid",
  "salt": "base64_salt"
}
```

**Error Cases:**

- `400`: Missing or invalid fields
- `409`: Email already registered

---

#### `POST /auth/login`

Authenticate user using SRP-style verifier exchange.

**Request:**

```json
{
  "email": "user@example.com",
  "challenge": "hex_random_challenge",
  "clientProof": "hex_computed_proof"
}
```

The client computes:

- `challenge`: Random bytes
- `clientProof`: HMAC-SHA256(Argon2id_key + challenge, "proof")

**Response (200):**

```json
{
  "userId": "uuid",
  "sessionToken": "hex_token",
  "salt": "base64_salt",
  "serverProof": "hex_server_proof"
}
```

The client verifies `serverProof` to confirm the server knows the verifier.

**Error Cases:**

- `400`: Missing or invalid fields
- `401`: Authentication failed (invalid email or password)

---

### Synchronization

#### `POST /sync/push`

Push encrypted vault to server.

**Headers:**

```
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

**Request:**

```json
{
  "userId": "uuid",
  "deviceId": "uuid",
  "vault": {
    "ciphertext": "base64_aes256gcm_ciphertext",
    "salt": "base64_argon2id_salt",
    "iv": "base64_gcm_iv",
    "authTag": "base64_gcm_auth_tag",
    "version": 1,
    "timestamp": 1704067200000,
    "nonce": "unique_random_nonce_hex"
  }
}
```

**Response (201):**

```json
{
  "vaultId": "uuid"
}
```

**Error Cases:**

- `400`: Invalid vault structure or duplicate nonce
- `401`: Missing or invalid session token
- `403`: Trying to push vault for another user

---

#### `POST /sync/pull`

Pull encrypted vaults from server.

**Headers:**

```
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

**Request:**

```json
{
  "userId": "uuid",
  "deviceId": "uuid",
  "lastVersion": 0
}
```

If `lastVersion` is provided, only vaults after that version are returned.

**Response (200):**

```json
{
  "vaults": [
    {
      "id": "uuid",
      "userId": "uuid",
      "deviceId": "uuid",
      "ciphertext": "base64_ciphertext",
      "salt": "base64_salt",
      "iv": "base64_iv",
      "authTag": "base64_auth_tag",
      "version": 1,
      "timestamp": 1704067200000,
      "nonce": "nonce_hex",
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "lastSyncTimestamp": 1704067200000,
  "currentVersion": 1
}
```

**Error Cases:**

- `400`: Invalid request
- `401`: Missing or invalid session token
- `403`: Trying to pull vault for another user

---

## Database Schema (MongoDB)

The backend uses MongoDB with Mongoose for storage. The primary collections are:

### Users (`User`)

- `email`: (String, Unique)
- `salt`: (String) Random salt for Argon2id
- `verifier`: (String) HMAC-SHA256 result for password proof
- `createdAt`: (Date)
- `updatedAt`: (Date)

### VaultBlobs (`VaultBlob`)

- `userId`: (ObjectId) Reference to User
- `deviceId`: (String)
- `ciphertext`: (String) Base64 AES-256-GCM ciphertext
- `salt`: (String) Base64 Argon2id salt
- `iv`: (String) Base64 GCM IV
- `authTag`: (String) Base64 GCM authentication tag
- `version`: (Number)
- `nonce`: (String, Unique) For replay protection

### SimpleVaults (`SimpleVault`)

Used by the browser extension for direct sync:

- `userId`: (String, Unique)
- `data`: (Mixed) Encrypted vault object
- `labels`: ([String]) Plaintext site labels for UI convenience

---

## Why the Backend is Cryptographically Blind

1. **No Plaintext Access**: The server never receives or derives the master password. It only stores a verifier.

2. **Cannot Derive Keys**: The encryption key is derived from the master password using Argon2id on the client. The server has no access to this derivation.

3. **Cannot Decrypt Vaults**: Even with database access, an attacker cannot decrypt vaults because the encryption key is never stored server-side.

4. **Cannot Forge Authentication**: A compromised database cannot be used to forge login proofs because they are HMAC-derived on the client.

---

## Running the Backend

### Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)

### Installation

```bash
cd packages/backend
npm install
```

### Development

```bash
npm run dev
```

Starts the server on `http://localhost:3001` using connection string from `.env`.

### Production

```bash
npm run build
npm run start
```

---

## Environment Variables

Create a `.env` file in the backend root:

- `PORT`: Server port (default: 3001)
- `MONGODB_URI`: MongoDB connection string (e.g., `mongodb+srv://...` or `mongodb://localhost:27017/vault`)
- `NODE_ENV`: Set to `production` for production deployments

---

## Testing

Start the server and test endpoints:

```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "salt": "dGVzdHNhbHQ=",
    "verifier": "abc123def456"
  }'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "challenge": "randomchallenge123",
    "clientProof": "computedproof456"
  }'

# Health check
curl http://localhost:3001/health
```

---

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS/TLS in production.

2. **Rate Limiting**: Implement rate limiting on auth endpoints to prevent brute force.

3. **CORS Configuration**: Configure CORS appropriately for your frontend domain.

4. **Database Backups**: Encrypt database backups at rest.

5. **Session Expiration**: Tokens expire after 24 hours (configurable).

6. **Nonce Uniqueness**: Always generate cryptographically random nonces.

---

## Deployment

This backend is stateless and can be deployed on:

- Node.js hosting (Heroku, Railway, Render, Vercel)
- Docker containers
- Traditional VPS/bare metal
- Serverless (with external database)

Make sure to:

1. Use a persistent database (not ephemeral storage)
2. Enable HTTPS/TLS
3. Set strong `NODE_ENV=production`
4. Configure rate limiting
5. Monitor error logs

---

## License

MIT
