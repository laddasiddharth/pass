# Security Architecture - Browser Extension

## 🎯 Security Objectives

1. **Zero-Knowledge**: Backend cannot decrypt user data
2. **Memory-Only Keys**: Encryption keys never touch disk
3. **Auto-Lock**: Minimize exposure window
4. **Isolation**: Strict boundaries between components
5. **Defense in Depth**: Multiple layers of protection

---

## 🏛️ Architecture Layers

### Layer 1: Manifest V3 Isolation

Chrome's Manifest V3 provides built-in security:

```
┌─────────────────────────────────────────────────┐
│  Web Page Context                               │
│  ┌───────────────────────────────────────────┐  │
│  │  Content Script                           │  │
│  │  - NO crypto access                       │  │
│  │  - NO vault access                        │  │
│  │  - Can only request autofill              │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↕ (Message Passing)
┌─────────────────────────────────────────────────┐
│  Extension Context                              │
│  ┌───────────────────────────────────────────┐  │
│  │  Popup UI                                 │  │
│  │  - Collects master password               │  │
│  │  - Displays vault (after unlock)          │  │
│  │  - NO crypto operations                   │  │
│  └───────────────────────────────────────────┘  │
│                    ↕ (Message Passing)          │
│  ┌───────────────────────────────────────────┐  │
│  │  Background Service Worker                │  │
│  │  - Holds encryption key (memory only)     │  │
│  │  - Performs all crypto operations         │  │
│  │  - Manages vault state                    │  │
│  │  - Implements auto-lock                   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↕ (HTTPS)
┌─────────────────────────────────────────────────┐
│  Backend Server                                 │
│  - Stores encrypted blobs only                  │
│  - Cannot decrypt (no key)                      │
│  - Blind synchronization                        │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Key Management

### Key Lifecycle

```typescript
// 1. DERIVATION (on unlock)
Master Password (user input)
    ↓ (Argon2id)
Derived Key (32 bytes)
    ↓ (importKey)
CryptoKey Object (non-extractable)
    ↓ (stored in memory)
sessionState.derivedKey

// 2. USAGE (during session)
CryptoKey → encrypt/decrypt operations

// 3. DESTRUCTION (on lock/close)
sessionState.derivedKey = null
// Garbage collected, key destroyed
```

### Key Properties

```typescript
const key = await crypto.subtle.importKey(
  "raw",
  derivedKeyMaterial,
  { name: "AES-GCM" },
  false, // ← NON-EXTRACTABLE: Cannot be exported
  ["encrypt", "decrypt"]
);
```

**Security guarantees:**

- ✅ Key cannot be serialized
- ✅ Key cannot be sent over network
- ✅ Key cannot be written to storage
- ✅ Key destroyed on service worker termination

---

## 🛡️ Security Boundaries

### Boundary 1: Content Script ↔ Background

**Content Script CAN:**

- Detect login forms
- Request autofill for current URL
- Receive matched credentials

**Content Script CANNOT:**

- Access master password
- Access encryption key
- Decrypt vault data
- Perform crypto operations

**Enforcement:**

- Separate execution contexts
- Message passing only
- Background validates all requests

### Boundary 2: Popup ↔ Background

**Popup CAN:**

- Send master password (once, on unlock)
- Request vault data (after unlock)
- Add/edit entries (after unlock)

**Popup CANNOT:**

- Access encryption key directly
- Perform crypto operations
- Bypass lock state

**Enforcement:**

- Message passing only
- Background checks lock state
- No direct memory access

### Boundary 3: Extension ↔ Backend

**Extension sends:**

- Encrypted vault blob
- User ID (public)
- Salt (public)

**Extension NEVER sends:**

- Master password
- Encryption key
- Plaintext vault data

**Backend receives:**

- Encrypted blob (opaque)
- Cannot decrypt (no key)

---

## 🔒 Threat Model

### Threats We Protect Against

#### 1. **Malicious Website**

**Attack:** Content script compromised by XSS

**Protection:**

- Content script has NO crypto access
- Cannot read encryption key
- Cannot decrypt vault
- Can only request autofill (validated by background)

#### 2. **Network Eavesdropping**

**Attack:** MITM intercepts backend communication

**Protection:**

- All data encrypted client-side
- Backend only sees encrypted blobs
- HTTPS for transport security

#### 3. **Backend Compromise**

**Attack:** Attacker gains access to backend database

**Protection:**

- All vault data encrypted
- Backend has no decryption key
- Attacker gets useless encrypted blobs

#### 4. **Memory Dump**

**Attack:** Attacker dumps browser memory

**Protection:**

- Key only exists while vault unlocked
- Auto-lock minimizes exposure window
- Manual lock on demand

#### 5. **Extension Inspection**

**Attack:** User opens DevTools on extension

**Protection:**

- CryptoKey is non-extractable
- Cannot be logged or inspected
- Appears as opaque object

#### 6. **Persistent Storage Attack**

**Attack:** Attacker reads chrome.storage

**Protection:**

- Encryption key NEVER written to storage
- Only encrypted vault stored
- User ID stored (non-sensitive)

---

## 🕐 Auto-Lock Security

### Why Auto-Lock?

Minimizes the window where:

- Encryption key exists in memory
- Vault data is decrypted
- Attacker could extract data

### Implementation

```typescript
let autoLockTimer: number | null = null;

function resetAutoLockTimer(): void {
  sessionState.lastActivity = Date.now();

  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer);
  }

  autoLockTimer = setTimeout(() => {
    lockVault(); // Destroy key and vault data
  }, AUTO_LOCK_TIMEOUT);
}
```

### Lock Triggers

1. **Inactivity timeout** (15 minutes default)
2. **Manual lock** (user clicks "Lock")
3. **Browser close** (service worker terminated)
4. **Extension reload** (service worker restarted)

### Lock Actions

```typescript
function lockVault(): void {
  // 1. Clear encryption key
  sessionState.derivedKey = null;

  // 2. Clear decrypted vault
  sessionState.decryptedVault = null;

  // 3. Set locked flag
  sessionState.isLocked = true;

  // 4. Clear timer
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }

  // 5. Notify UI
  chrome.runtime.sendMessage({ type: "VAULT_LOCKED" });
}
```

---

## 🔍 Data Flow Analysis

### Unlock Flow

```
User enters master password in Popup
    ↓
Popup sends { type: 'UNLOCK_VAULT', masterPassword, userId }
    ↓
Background receives message
    ↓
Background fetches encrypted vault from backend
    ↓
Background derives key: deriveKey(masterPassword, salt)
    ↓
Background decrypts vault: decryptVault(encrypted, key)
    ↓
Background stores key & vault in memory
    ↓
Background sends { success: true } to Popup
    ↓
Popup clears master password input
    ↓
Popup requests vault: { type: 'GET_VAULT' }
    ↓
Background sends decrypted vault to Popup
    ↓
Popup displays vault entries
```

**Security checkpoints:**

- ✅ Master password cleared from Popup immediately
- ✅ Key stored only in Background memory
- ✅ Vault decrypted only in Background
- ✅ Auto-lock timer started

### Add Password Flow

```
User fills form in Popup
    ↓
Popup sends { type: 'ADD_PASSWORD', entry }
    ↓
Background checks if unlocked
    ↓
Background adds entry to decrypted vault
    ↓
Background re-encrypts: encryptVault(vault, key)
    ↓
Background sends encrypted vault to backend
    ↓
Backend stores encrypted blob
    ↓
Background sends { success: true } to Popup
    ↓
Popup refreshes vault display
```

**Security checkpoints:**

- ✅ Lock state checked before operation
- ✅ Encryption happens in Background
- ✅ Backend receives only encrypted data
- ✅ Auto-lock timer reset

### Autofill Flow

```
Content Script detects login form
    ↓
User clicks "Autofill" button
    ↓
Content Script sends { type: 'REQUEST_AUTOFILL', url }
    ↓
Background checks if unlocked
    ↓
Background searches vault for matching URL
    ↓
Background sends matched entry to Content Script
    ↓
Content Script fills username & password fields
```

**Security checkpoints:**

- ✅ Lock state checked before autofill
- ✅ URL matching prevents wrong-site autofill
- ✅ Only matched entry sent (not entire vault)
- ✅ Auto-lock timer reset

---

## 🧪 Security Testing

### Manual Tests

1. **Key Persistence Test**

   ```
   1. Unlock vault
   2. Open DevTools → Application → Storage
   3. Verify: No encryption key in chrome.storage
   4. Verify: Only encrypted vault stored
   ```

2. **Browser Close Test**

   ```
   1. Unlock vault
   2. Close browser
   3. Reopen browser
   4. Open extension
   5. Verify: Vault is locked
   6. Verify: Must re-enter master password
   ```

3. **Extension Reload Test**

   ```
   1. Unlock vault
   2. Go to chrome://extensions/
   3. Click "Reload" on extension
   4. Open extension
   5. Verify: Vault is locked
   ```

4. **Auto-Lock Test**

   ```
   1. Unlock vault
   2. Wait 15 minutes without interaction
   3. Verify: Vault automatically locks
   4. Verify: UI shows unlock screen
   ```

5. **DevTools Inspection Test**
   ```
   1. Unlock vault
   2. Open DevTools on background page
   3. Type: sessionState.derivedKey
   4. Verify: Shows CryptoKey object (opaque)
   5. Verify: Cannot extract key material
   ```

### Automated Tests (Future)

```typescript
// Example test cases
describe("Security Tests", () => {
  test("Key is non-extractable", async () => {
    const key = await deriveKey("password");
    await expect(crypto.subtle.exportKey("raw", key.key)).rejects.toThrow();
  });

  test("Lock clears sensitive data", () => {
    sessionState.derivedKey = mockKey;
    sessionState.decryptedVault = mockVault;

    lockVault();

    expect(sessionState.derivedKey).toBeNull();
    expect(sessionState.decryptedVault).toBeNull();
    expect(sessionState.isLocked).toBe(true);
  });
});
```

---

## 📋 Security Checklist

### Before Release

- [ ] All crypto operations in Background only
- [ ] No master password logging
- [ ] No key material logging
- [ ] CryptoKey is non-extractable
- [ ] Auto-lock implemented
- [ ] Manual lock works
- [ ] Browser close destroys session
- [ ] Extension reload requires re-auth
- [ ] Content script has no crypto access
- [ ] Backend receives only encrypted data
- [ ] HTTPS for backend communication
- [ ] Input validation on all messages
- [ ] Error messages don't leak info
- [ ] No sensitive data in chrome.storage

### Code Review Checklist

- [ ] No `console.log(masterPassword)`
- [ ] No `console.log(derivedKey)`
- [ ] No `chrome.storage.set({ key: ... })`
- [ ] All message handlers validate sender
- [ ] All crypto ops check lock state
- [ ] Proper error handling (no info leaks)
- [ ] TypeScript types for all functions
- [ ] Comments explain security decisions

---

## 🚨 Security Incident Response

### If Key Exposure Suspected

1. **Immediate Actions:**

   - Lock all vaults
   - Clear browser cache
   - Reload extension
   - Change master password

2. **Investigation:**

   - Check browser console for logs
   - Review extension code changes
   - Check for malicious extensions
   - Scan for malware

3. **Recovery:**
   - Generate new master password
   - Re-encrypt vault with new key
   - Update backend with new encrypted vault
   - Monitor for suspicious activity

---

## 📚 References

### Standards & Best Practices

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/)
- [Argon2 RFC 9106](https://datatracker.ietf.org/doc/html/rfc9106)

### Cryptographic Primitives

- **Key Derivation:** Argon2id (memory-hard, GPU-resistant)
- **Encryption:** AES-256-GCM (authenticated encryption)
- **Random:** crypto.getRandomValues (CSPRNG)

---

## ✅ Security Guarantees

### What We Guarantee

1. **Zero-Knowledge:**

   - Backend cannot decrypt user data
   - Backend never sees master password
   - Backend never sees encryption key

2. **Memory-Only Keys:**

   - Encryption key never written to disk
   - Key destroyed on browser close
   - Key destroyed on extension reload

3. **Auto-Lock:**

   - Vault locks after inactivity
   - Minimizes exposure window
   - Explicit memory clearing

4. **Isolation:**
   - Content script cannot access crypto
   - Popup cannot access key directly
   - Strict message passing boundaries

### What We Don't Guarantee

1. **Physical Access:**

   - Cannot protect against keyloggers
   - Cannot protect against screen recording
   - Cannot protect against memory dumps while unlocked

2. **Malicious Extensions:**

   - Other extensions may have broad permissions
   - User should only install trusted extensions

3. **Browser Vulnerabilities:**
   - We rely on browser security
   - Keep browser updated

---

**Remember:** Security is a process, not a product. Stay vigilant, keep software updated, and report vulnerabilities responsibly.
