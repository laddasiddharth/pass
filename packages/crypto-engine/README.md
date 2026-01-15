# crypto-engine

A zero-knowledge cryptographic core for password managers. Implements client-side encryption with strict security guarantees and no plaintext exposure.

## 🔐 Zero-Knowledge Guarantees

This package implements the following zero-knowledge security properties:

### 1. **Master Password Isolation**
- The master password is **never transmitted** to the server
- The master password is **never stored** in the browser (except during user input)
- Only the encrypted vault is sent to/stored on the server
- The server cannot derive the master password from the ciphertext

### 2. **Key Derivation Security**
- **Argon2id** (password-based key derivation function) derives encryption keys from the master password
- Each vault entry uses a **unique salt** (16 random bytes)
- Salts are stored with the encrypted data (standard practice for password-based encryption)
- The salt prevents rainbow table attacks and pre-computation

### 3. **Encryption Properties**
- **AES-256-GCM** provides authenticated encryption:
  - 256-bit encryption key (derived from Argon2id)
  - 96-bit random IV (nonce) generated per encryption
  - Authentication tag (16 bytes) verifies ciphertext integrity
- Wrong password results in **authentication failure** (no plaintext leaked)
- Tampering with ciphertext is detected and rejected

### 4. **Key Management**
- Derived keys are **non-extractable** `CryptoKey` objects
- Keys exist **only in RAM during operations**
- Keys are **automatically garbage collected** after use
- Keys cannot be serialized or persisted
- No key material is ever logged or printed

### 5. **Ciphertext Integrity**
- GCM mode provides authenticated encryption (AEAD)
- Any bit-level corruption of ciphertext is detected
- Authentication tag cannot be forged without the key
- Prevents man-in-the-middle attacks and data tampering

## 📦 Installation

```bash
npm install crypto-engine
```

## 🚀 Quick Start

```typescript
import {
  encryptVault,
  decryptVault,
  createVaultEntry,
} from 'crypto-engine';

// Create a vault entry
const entry = createVaultEntry(
  'github.com',
  'user@example.com',
  'my-github-token'
);

// Encrypt with master password
const masterPassword = 'my-secure-master-password';
const encrypted = await encryptVault(masterPassword, entry);

// Safe to store on server - only ciphertext
const vaultJSON = JSON.stringify(encrypted);

// Later: decrypt with master password
const result = await decryptVault(masterPassword, encrypted);

if (result.success) {
  console.log('Decrypted:', result.data);
} else {
  console.log('Wrong password:', result.error);
}
```

## 🏗️ Architecture

### Modules

#### `argon2.ts`
- **Function**: `deriveKey(masterPassword, salt?, options?)`
  - Derives a 256-bit encryption key using Argon2id
  - Returns a non-extractable `CryptoKey` and the salt used
  - Default: 3 iterations, 64MB memory, 4 parallelism
- **Security**: Key cannot be extracted or serialized after import

#### `aes.ts`
- **Function**: `encrypt(entry, derivedKey)`
  - Encrypts a `VaultEntry` using AES-256-GCM
  - Generates random 96-bit IV for each encryption
  - Returns base64-encoded ciphertext and metadata
- **Function**: `decrypt(encrypted, derivedKey)`
  - Decrypts and verifies authentication tag
  - Throws error if authentication fails (wrong password or tampering)

#### `vault.ts`
- **Function**: `encryptVault(masterPassword, entry, options?)`
  - High-level API: password → key → encrypted vault
  - Single function call for complete encryption workflow
- **Function**: `decryptVault(masterPassword, encrypted)`
  - High-level API: password + ciphertext → plaintext entry
  - Returns `DecryptResult` (success | error)
- **Function**: `validateVaultEntry(entry)`
  - Validates vault entry structure
- **Function**: `createVaultEntry(...)`
  - Factory function for creating entries with metadata

### Type System

```typescript
interface VaultEntry {
  site: string;
  username: string;
  password: string;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
  };
}

interface EncryptedVault {
  ciphertext: string;      // base64
  iv: string;              // base64
  salt: string;            // base64
  algorithm: 'AES-256-GCM';
  derivationAlgorithm: 'Argon2id';
}

type DecryptResult =
  | { success: true; data: VaultEntry }
  | { success: false; error: string };
```

## 🔬 Security Analysis

### Threat Model

**What is protected?**
- Master password confidentiality (never exposed)
- Vault entry data (encrypted with AES-256-GCM)
- Ciphertext integrity (authentication tag verifies)

**What is assumed?**
- User device is trusted (no malware capturing passwords during input)
- Browser Web Crypto API is implemented correctly
- Master password has sufficient entropy (use 12+ characters)

**What is not protected?**
- Metadata about when entries were created (timestamps are stored)
- Frequency or size of vault operations (timing attacks on ciphertext size)
- Master password strength (use strong passwords!)

### Cryptographic Primitives

| Component | Algorithm | Key Size | Notes |
|-----------|-----------|----------|-------|
| Key Derivation | Argon2id | 256-bit output | Memory-hard, resistant to GPU attacks |
| Encryption | AES-256-GCM | 256-bit key | NIST-approved, authenticated encryption |
| IV (Nonce) | CSPRNG | 96 bits | One per encryption, prevents replay |
| Salt | CSPRNG | 128 bits | One per vault entry, prevents precomputation |
| Authentication | GCM Tag | 128 bits | Detects tampering, prevents forging |

## 🧪 Testing

Run the included example test:

```bash
npm test
```

Example test demonstrates:
1. Creating a vault entry with credentials
2. Encrypting with a master password
3. Serializing encrypted vault (safe for server storage)
4. Decrypting with correct password (succeeds)
5. Attempting decryption with wrong password (fails with auth error)

## 📝 API Reference

### `encryptVault(masterPassword, entry, options?)`

Encrypts a vault entry with the given master password.

**Parameters:**
- `masterPassword` (string): User's master password
- `entry` (VaultEntry): Vault entry with site, username, password, optional metadata
- `options` (Argon2idOptions, optional): Customize key derivation parameters

**Returns:** Promise<EncryptedVault>

**Example:**
```typescript
const encrypted = await encryptVault('password', {
  site: 'github.com',
  username: 'user@example.com',
  password: 'token-123'
});
```

### `decryptVault(masterPassword, encrypted)`

Decrypts a vault entry with the given master password.

**Parameters:**
- `masterPassword` (string): User's master password
- `encrypted` (EncryptedVault): Encrypted vault object (from `encryptVault`)

**Returns:** Promise<DecryptResult>

**Example:**
```typescript
const result = await decryptVault('password', encrypted);
if (result.success) {
  console.log(result.data.password); // 'token-123'
} else {
  console.log(result.error); // 'Decryption failed...'
}
```

### `createVaultEntry(site, username, password, metadata?)`

Factory function for creating vault entries with automatic metadata.

**Parameters:**
- `site` (string): Website or service name
- `username` (string): Username or email
- `password` (string): Password or token
- `metadata` (object, optional): Additional metadata

**Returns:** VaultEntry

**Example:**
```typescript
const entry = createVaultEntry('github.com', 'user@example.com', 'token');
// { site: 'github.com', username: '...', password: '...', 
//   metadata: { createdAt: '2025-01-14T...' } }
```

### `validateVaultEntry(entry)`

Validates that a vault entry has all required fields.

**Parameters:**
- `entry` (VaultEntry): Entry to validate

**Returns:** boolean

## 🛡️ Security Best Practices

### For Application Developers

1. **Never log passwords or keys:**
   ```typescript
   // ❌ WRONG
   console.log('Password:', plaintext.password);
   
   // ✅ RIGHT
   console.log('Entry decrypted successfully');
   ```

2. **Use unique master password:**
   - Master password should be different from login passwords
   - At least 12 characters for strong entropy

3. **Store only encrypted vault:**
   ```typescript
   const encrypted = await encryptVault(masterPassword, entry);
   await server.save(JSON.stringify(encrypted));
   // Never send plaintext password to server
   ```

4. **Validate on client side:**
   ```typescript
   if (!validateVaultEntry(entry)) {
     throw new Error('Invalid entry');
   }
   ```

5. **Handle decryption errors gracefully:**
   ```typescript
   const result = await decryptVault(password, encrypted);
   if (!result.success) {
     // Wrong password - ask user to try again
     // Don't reveal whether password or ciphertext was wrong
   }
   ```

### For Password Managers

1. **Clear sensitive data from memory:**
   - The derived key is automatically cleared when out of scope
   - Clear user input (master password) after encryption/decryption

2. **Use strong default parameters:**
   - Current defaults: 3 iterations, 64MB memory (good security/performance)
   - For high-security requirements, increase iterations or memory

3. **Implement rate limiting:**
   - Limit decryption attempts to prevent brute-force attacks
   - Lock account after multiple failed attempts

4. **Secure the browser environment:**
   - Use Content Security Policy (CSP) to prevent XSS
   - Disable JavaScript debugging in production
   - Use HTTPS-only for all connections

## 🌐 Browser Compatibility

Requires Web Crypto API support (all modern browsers):
- Chrome/Edge 37+
- Firefox 34+
- Safari 11+
- Opera 24+

## 📄 License

MIT
