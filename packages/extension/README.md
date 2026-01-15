# Zero-Knowledge Password Manager - Browser Extension (Phase 3)

## 🔐 Security Architecture

This browser extension implements a **zero-knowledge password manager** using Chrome's Manifest V3 architecture. The design ensures that:

- **Master password never leaves the device**
- **Encryption keys exist only in memory**
- **Browser close destroys all sensitive data**
- **Extension reload requires re-authentication**
- **No plaintext credentials are ever logged or persisted**

---

## 📁 Project Structure

```
packages/extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts      # Security core - key management & crypto ops
│   ├── popup/
│   │   └── popup.ts                # User interface logic
│   ├── content/
│   │   └── content-script.ts       # Form detection & autofill (no crypto access)
│   └── types/
├── public/
│   ├── manifest.json               # Manifest V3 configuration
│   ├── popup.html                  # Popup UI structure
│   ├── popup.css                   # Popup styling
│   └── icons/                      # Extension icons
├── dist/                           # Built extension (load this in Chrome)
├── build.js                        # esbuild bundler
├── package.json
└── README.md
```

---

## 🏗️ Architecture Overview

### 1. **Background Service Worker** (Security Core)

**File:** `src/background/service-worker.ts`

**Responsibilities:**

- Holds the derived encryption key **in memory only**
- Manages vault state (locked/unlocked)
- Handles all cryptographic operations
- Implements auto-lock timer (15 minutes default)
- Communicates with popup via message passing

**Security Guarantees:**

```typescript
// In-memory state (destroyed on extension reload/browser close)
let sessionState = {
  derivedKey: DerivedKey | null,      // NEVER persisted
  decryptedVault: VaultEntry[] | null, // NEVER persisted
  isLocked: boolean,
  lastActivity: number
}
```

**Key Features:**

- ✅ Auto-lock after 15 minutes of inactivity
- ✅ Explicit memory clearing on lock
- ✅ No disk persistence of sensitive data
- ✅ Service worker termination destroys all state

---

### 2. **Popup UI**

**Files:** `public/popup.html`, `src/popup/popup.ts`, `public/popup.css`

**Responsibilities:**

- User authentication (master password input)
- Vault display and search
- Add/edit password entries
- Copy passwords to clipboard

**Security Constraints:**

- Master password sent to background worker and **immediately cleared**
- No cryptographic operations performed here
- All sensitive operations delegated to background worker
- No access to encryption keys

**Screens:**

1. **Unlock Screen** - Master password entry
2. **Vault Screen** - Password list with search
3. **Add Password Screen** - New entry form

---

### 3. **Content Script**

**File:** `src/content/content-script.ts`

**Responsibilities:**

- Detects login forms on web pages
- Adds autofill buttons to detected forms
- Requests autofill data from background worker

**Security Constraints:**

- ❌ NO access to master password
- ❌ NO access to encryption keys
- ❌ NO access to decrypted vault data
- ❌ NO cryptographic operations
- ✅ Can only request autofill via message passing

---

## 🔒 Security Features

### Zero-Knowledge Architecture

1. **Client-Side Encryption**

   - All encryption/decryption happens in the extension
   - Backend only stores encrypted blobs
   - Backend cannot decrypt user data

2. **Key Derivation**

   ```typescript
   // Master password → Argon2id → Encryption key
   const derivedKey = await deriveKey(masterPassword, salt);
   ```

   - Uses Argon2id (memory-hard, GPU-resistant)
   - Unique salt per user
   - Key never leaves extension context

3. **Memory-Only Key Storage**

   - Encryption key stored in service worker memory
   - Never written to `chrome.storage` or any persistent storage
   - Destroyed on browser close or extension reload

4. **Auto-Lock**

   - Configurable timeout (default: 15 minutes)
   - Resets on user activity
   - Explicitly clears all sensitive data on lock

5. **Secure Communication**
   - Popup ↔ Background: `chrome.runtime.sendMessage`
   - Content ↔ Background: `chrome.runtime.sendMessage`
   - All messages validated and typed

---

## 🚀 Installation & Usage

### Prerequisites

```bash
# Install dependencies
cd packages/extension
npm install
```

### Build the Extension

```bash
# Production build
npm run build

# Development build with watch mode
npm run watch
```

### Generate Icons

```bash
# Create placeholder icons
node generate-icons.js
```

**For production:** Replace placeholder icons with proper PNG files:

1. Open `public/icons/icon.svg` in a browser
2. Export as PNG at sizes: 16x16, 32x32, 48x48, 128x128
3. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

### Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` directory
5. The extension should now appear in your toolbar

---

## 📖 User Guide

### First-Time Setup

1. Click the extension icon
2. Enter a **User ID** (e.g., your email)
3. Enter a **Master Password** (choose a strong, unique password)
4. Click **Unlock Vault**

**Note:** If this is your first time, an empty vault will be created automatically.

### Adding Passwords

1. Click the extension icon
2. Unlock your vault
3. Click **+ Add Password**
4. Fill in the form:
   - Website/Service name
   - URL
   - Username/Email
   - Password (or click 🎲 to generate)
   - Notes (optional)
5. Click **Save Password**

### Using Passwords

1. Click the extension icon
2. Unlock your vault
3. Search for the password you need
4. Click **Copy** to copy the password to clipboard
5. Paste into the login form

### Auto-Fill (Content Script)

When you visit a website with a login form:

1. A **🔐 Autofill** button will appear near the form
2. Click it to automatically fill username and password
3. The extension matches based on URL

### Locking the Vault

**Manual Lock:**

- Click the **Lock** button in the vault screen

**Auto-Lock:**

- Vault automatically locks after 15 minutes of inactivity
- Closing the browser also locks the vault

---

## 🔧 Configuration

### Backend URL

Edit `src/background/service-worker.ts`:

```typescript
const BACKEND_URL = "http://localhost:3001"; // Change to your backend URL
```

### Auto-Lock Timeout

Edit `src/background/service-worker.ts`:

```typescript
const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes (in milliseconds)
```

### Permissions

Edit `public/manifest.json`:

```json
{
  "permissions": [
    "storage", // For saving user ID
    "activeTab" // For autofill on current tab
  ],
  "host_permissions": [
    "http://localhost:3001/*" // Backend API access
  ]
}
```

---

## 🛡️ Security Best Practices

### For Users

1. **Choose a strong master password**

   - At least 16 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Never reuse from other services

2. **Never share your master password**

   - Not even with support staff
   - No one can recover it if lost

3. **Lock your vault when stepping away**

   - Manual lock or wait for auto-lock

4. **Keep your browser updated**
   - Security patches are important

### For Developers

1. **Never log sensitive data**

   ```typescript
   // ❌ DON'T
   console.log("Master password:", masterPassword);

   // ✅ DO
   console.log("Vault unlocked successfully");
   ```

2. **Clear sensitive data explicitly**

   ```typescript
   // ✅ DO
   sessionState.derivedKey = null;
   sessionState.decryptedVault = null;
   ```

3. **Validate all messages**

   ```typescript
   // ✅ DO
   if (message.type === "UNLOCK_VAULT") {
     // Handle unlock
   }
   ```

4. **Use TypeScript for type safety**
   - Prevents many runtime errors
   - Better IDE support

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Can create a new vault with master password
- [ ] Can unlock existing vault
- [ ] Can add new password entries
- [ ] Can search passwords
- [ ] Can copy passwords to clipboard
- [ ] Auto-lock works after timeout
- [ ] Manual lock works
- [ ] Browser close destroys session
- [ ] Extension reload requires re-authentication
- [ ] Content script detects login forms
- [ ] Autofill works on detected forms

### Security Testing

- [ ] Master password not visible in DevTools
- [ ] Encryption key not visible in DevTools
- [ ] No plaintext passwords in `chrome.storage`
- [ ] No sensitive data in console logs
- [ ] Backend receives only encrypted data

---

## 🐛 Troubleshooting

### Extension won't load

**Solution:** Check the console in `chrome://extensions/` for errors.

### "Failed to unlock vault"

**Possible causes:**

- Incorrect master password
- Backend not running
- Network error

**Solution:**

1. Verify master password
2. Check backend is running at `http://localhost:3001`
3. Check browser console for errors

### Autofill button not appearing

**Possible causes:**

- Form not detected
- Content script not loaded

**Solution:**

1. Reload the page
2. Check if form has password input
3. Check browser console for errors

### Vault locked unexpectedly

**Possible causes:**

- Auto-lock timeout reached
- Service worker terminated

**Solution:** This is expected behavior for security. Simply unlock again.

---

## 📚 API Reference

### Message Types

#### `UNLOCK_VAULT`

```typescript
{
  type: 'UNLOCK_VAULT',
  masterPassword: string,
  userId: string
}
// Response: { success: boolean, error?: string }
```

#### `GET_VAULT`

```typescript
{
  type: "GET_VAULT";
}
// Response: { success: boolean, vault?: VaultEntry[], error?: string }
```

#### `ADD_PASSWORD`

```typescript
{
  type: 'ADD_PASSWORD',
  entry: VaultEntry
}
// Response: { success: boolean, error?: string }
```

#### `LOCK_VAULT`

```typescript
{
  type: "LOCK_VAULT";
}
// Response: { success: boolean }
```

#### `GET_STATUS`

```typescript
{
  type: "GET_STATUS";
}
// Response: { isLocked: boolean }
```

---

## 🔄 Integration with Phase 1 & 2

### Phase 1: Crypto Engine

The extension imports the crypto engine as a workspace dependency:

```typescript
import {
  deriveKey,
  encryptVault,
  decryptVault,
} from "@password-manager/crypto-engine";
```

**Used for:**

- Key derivation (Argon2id)
- Vault encryption (AES-256-GCM)
- Vault decryption

### Phase 2: Backend API

The extension communicates with the backend via REST API:

```typescript
// Fetch encrypted vault
GET /api/vault/:userId

// Save encrypted vault
PUT /api/vault/:userId
```

**Backend responsibilities:**

- Store encrypted vault blobs
- Blind synchronization (no decryption)
- No access to plaintext data

---

## 🚧 Future Enhancements

### Planned Features

- [ ] **Password strength indicator**
- [ ] **Breach detection** (Have I Been Pwned integration)
- [ ] **Secure notes** (encrypted text storage)
- [ ] **2FA support** (TOTP generation)
- [ ] **Import/Export** (encrypted backup)
- [ ] **Biometric unlock** (WebAuthn)
- [ ] **Shared vaults** (family/team sharing)
- [ ] **Password history** (track changes)
- [ ] **Auto-fill improvements** (better form detection)
- [ ] **Dark mode**

### Security Enhancements

- [ ] **Key rotation** (re-encrypt with new key)
- [ ] **Session timeout** (require re-auth after X hours)
- [ ] **Failed attempt lockout** (prevent brute force)
- [ ] **Secure clipboard** (auto-clear after paste)
- [ ] **Screenshot protection** (blur sensitive data)

---

## 📄 License

This project is part of the Zero-Knowledge Password Manager suite.

---

## 🤝 Contributing

When contributing, please:

1. Follow the existing code style
2. Add TypeScript types for all functions
3. Never log sensitive data
4. Test security features thoroughly
5. Update documentation

---

## ⚠️ Security Disclosure

If you discover a security vulnerability, please email security@example.com instead of opening a public issue.

---

## 📞 Support

For questions or issues:

- Open an issue on GitHub
- Check the troubleshooting section
- Review the API reference

---

**Remember:** Your master password is the key to your vault. Keep it safe, and never share it with anyone!
