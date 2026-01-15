# 🧪 Complete Testing Guide - Password Manager Extension

## ✅ Prerequisites Checklist

Before testing, make sure:

- [x] Backend server is running on `http://localhost:3001`
- [x] Extension is loaded in Chrome at `chrome://extensions/`
- [x] Extension shows unlock screen (as in your screenshot)

---

## 📋 Step-by-Step Testing Instructions

### **Test 1: Create Your First Vault**

#### Step 1.1: Open the Extension

- Click the extension icon in your Chrome toolbar
- You should see the unlock screen (as shown in your screenshot)

#### Step 1.2: Create a New Vault

1. **User ID**: Enter `test@example.com` (or any ID you want)
2. **Master Password**: Enter `MySecurePassword123!` (or create your own strong password)
3. Click **"Unlock Vault"**

**Expected Result:**

- ✅ Loading spinner appears briefly
- ✅ Screen changes to show empty vault
- ✅ Message: "No passwords saved yet"
- ✅ Button: "+ Add Password" is visible

**What Just Happened:**

- Your master password was used to derive an encryption key (Argon2id)
- An empty vault was created and encrypted (AES-256-GCM)
- The encrypted vault was sent to the backend
- The key is now stored in memory (not on disk!)

---

### **Test 2: Add Your First Password**

#### Step 2.1: Click "+ Add Password"

#### Step 2.2: Fill in the Form

Use this sample data:

**Password Entry #1 - GitHub:**

- **Website/Service**: `GitHub`
- **URL**: `https://github.com`
- **Username**: `your_github_username`
- **Password**: Click the 🎲 button to generate a secure password
  - OR enter your own: `GitHubSecure2024!`
- **Notes**: `My main GitHub account`

#### Step 2.3: Save

- Click **"Save Password"**

**Expected Result:**

- ✅ Returns to vault screen
- ✅ Shows 1 password entry
- ✅ Entry displays: GitHub, https://github.com, your username

---

### **Test 3: Add More Passwords**

Add these additional test passwords:

**Password Entry #2 - Gmail:**

- **Website/Service**: `Gmail`
- **URL**: `https://mail.google.com`
- **Username**: `your.email@gmail.com`
- **Password**: Generate or use `GmailSecure2024!`
- **Notes**: `Personal email account`

**Password Entry #3 - Netflix:**

- **Website/Service**: `Netflix`
- **URL**: `https://netflix.com`
- **Username**: `your.email@gmail.com`
- **Password**: Generate or use `NetflixPass2024!`
- **Notes**: `Streaming service`

**Password Entry #4 - Amazon:**

- **Website/Service**: `Amazon`
- **URL**: `https://amazon.com`
- **Username**: `your.email@gmail.com`
- **Password**: Generate or use `AmazonSecure2024!`
- **Notes**: `Shopping account`

**Password Entry #5 - Twitter/X:**

- **Website/Service**: `Twitter`
- **URL**: `https://twitter.com`
- **Username**: `@yourusername`
- **Password**: Generate or use `TwitterPass2024!`
- **Notes**: `Social media`

**Expected Result:**

- ✅ Vault now shows 5 password entries
- ✅ Each entry shows website name, URL, and username
- ✅ Each entry has a "Copy" button

---

### **Test 4: Search Functionality**

#### Step 4.1: Test Search

1. In the search box, type: `git`

**Expected Result:**

- ✅ Only GitHub entry is shown
- ✅ Other entries are filtered out

#### Step 4.2: Clear Search

1. Clear the search box

**Expected Result:**

- ✅ All 5 entries are shown again

#### Step 4.3: Search by URL

1. Type: `gmail`

**Expected Result:**

- ✅ Gmail entry is shown

---

### **Test 5: Copy Password**

#### Step 5.1: Copy a Password

1. Find the GitHub entry
2. Click the **"Copy"** button

**Expected Result:**

- ✅ Button text changes to "✓ Copied"
- ✅ Password is copied to clipboard
- ✅ After 2 seconds, button returns to "Copy"

#### Step 5.2: Verify Clipboard

1. Open Notepad or any text editor
2. Paste (Ctrl+V)

**Expected Result:**

- ✅ The GitHub password is pasted

---

### **Test 6: Manual Lock**

#### Step 6.1: Lock the Vault

1. Click the **"Lock"** button in the top-right

**Expected Result:**

- ✅ Screen returns to unlock screen
- ✅ User ID is still filled in
- ✅ Master password field is empty
- ✅ Vault is locked

#### Step 6.2: Unlock Again

1. Enter your master password: `MySecurePassword123!`
2. Click **"Unlock Vault"**

**Expected Result:**

- ✅ Vault unlocks successfully
- ✅ All 5 passwords are still there
- ✅ Data was retrieved from backend and decrypted

---

### **Test 7: Auto-Lock (15 Minutes)**

#### Step 7.1: Wait for Auto-Lock

1. Unlock the vault
2. Wait 15 minutes without interacting with the extension

**Expected Result:**

- ✅ After 15 minutes, vault automatically locks
- ✅ Next time you open the extension, unlock screen is shown

**Note:** For testing, you can change the timeout in `service-worker.ts`:

```typescript
const AUTO_LOCK_TIMEOUT = 1 * 60 * 1000; // 1 minute for testing
```

---

### **Test 8: Browser Close (Key Destruction)**

#### Step 8.1: Close Browser

1. Unlock the vault
2. Close Chrome completely (all windows)

#### Step 8.2: Reopen Browser

1. Open Chrome again
2. Click the extension icon

**Expected Result:**

- ✅ Unlock screen is shown
- ✅ Must re-enter master password
- ✅ Encryption key was destroyed (security feature!)

#### Step 8.3: Unlock and Verify

1. Enter master password
2. Unlock vault

**Expected Result:**

- ✅ All passwords are still there
- ✅ Data was retrieved from backend

---

### **Test 9: Extension Reload (Session Reset)**

#### Step 9.1: Reload Extension

1. Unlock the vault
2. Go to `chrome://extensions/`
3. Find the Password Manager extension
4. Click the **reload icon** (circular arrow)

#### Step 9.2: Open Extension Again

1. Click the extension icon

**Expected Result:**

- ✅ Unlock screen is shown
- ✅ Session was reset (security feature!)
- ✅ Must re-enter master password

---

### **Test 10: Wrong Password**

#### Step 10.1: Try Wrong Password

1. At unlock screen, enter wrong password: `WrongPassword123`
2. Click "Unlock Vault"

**Expected Result:**

- ✅ Error message appears
- ✅ "Failed to unlock vault. Check your master password."
- ✅ Vault remains locked

#### Step 10.2: Correct Password

1. Enter correct password
2. Unlock successfully

---

### **Test 11: Backend Verification**

#### Step 11.1: Check Backend Storage

1. Open a new terminal
2. Run:

```bash
curl http://localhost:3001/api/vaults
```

**Expected Result:**

```json
{
  "vaults": [
    {
      "userId": "test@example.com",
      "size": 1234
    }
  ]
}
```

#### Step 11.2: View Encrypted Vault

```bash
curl http://localhost:3001/api/vault/test@example.com
```

**Expected Result:**

```json
{
  "ciphertext": "base64encodeddata...",
  "iv": "base64encodeddata...",
  "salt": "base64encodeddata...",
  "algorithm": "AES-256-GCM",
  "derivationAlgorithm": "Argon2id"
}
```

**Important:** The backend only sees encrypted data! It cannot decrypt your passwords.

---

### **Test 12: DevTools Security Check**

#### Step 12.1: Inspect Background Worker

1. Go to `chrome://extensions/`
2. Find Password Manager extension
3. Click **"service worker"** link (opens DevTools)

#### Step 12.2: Try to Access Key

In the console, type:

```javascript
sessionState.derivedKey;
```

**Expected Result:**

```
CryptoKey {type: "secret", extractable: false, algorithm: {...}, usages: Array(2)}
```

**Security Check:**

- ✅ Key is visible as an object
- ✅ But it's **non-extractable**
- ✅ Cannot export or read the actual key material
- ✅ This is a security feature!

#### Step 12.3: Try to Export Key

```javascript
crypto.subtle.exportKey("raw", sessionState.derivedKey);
```

**Expected Result:**

```
Error: key is not extractable
```

✅ **Perfect!** The key cannot be extracted, even with DevTools access.

---

## 🎯 Test Results Summary

After completing all tests, you should have verified:

| Test | Feature                         | Status |
| ---- | ------------------------------- | ------ |
| 1    | Create vault                    | ✅     |
| 2    | Add password                    | ✅     |
| 3    | Add multiple passwords          | ✅     |
| 4    | Search passwords                | ✅     |
| 5    | Copy to clipboard               | ✅     |
| 6    | Manual lock                     | ✅     |
| 7    | Auto-lock (15 min)              | ✅     |
| 8    | Browser close destroys key      | ✅     |
| 9    | Extension reload resets session | ✅     |
| 10   | Wrong password rejected         | ✅     |
| 11   | Backend stores encrypted data   | ✅     |
| 12   | Key is non-extractable          | ✅     |

---

## 📊 Sample Test Data

Here's a complete set of test passwords you can use:

```javascript
// Copy this data for quick testing
const testPasswords = [
  {
    siteName: "GitHub",
    siteUrl: "https://github.com",
    username: "developer@example.com",
    password: "GitHubSecure2024!@#",
    notes: "Main development account",
  },
  {
    siteName: "Gmail",
    siteUrl: "https://mail.google.com",
    username: "your.email@gmail.com",
    password: "GmailSecure2024!@#",
    notes: "Personal email",
  },
  {
    siteName: "Netflix",
    siteUrl: "https://netflix.com",
    username: "your.email@gmail.com",
    password: "NetflixPass2024!@#",
    notes: "Streaming service",
  },
  {
    siteName: "Amazon",
    siteUrl: "https://amazon.com",
    username: "your.email@gmail.com",
    password: "AmazonSecure2024!@#",
    notes: "Shopping account",
  },
  {
    siteName: "Twitter",
    siteUrl: "https://twitter.com",
    username: "@yourusername",
    password: "TwitterPass2024!@#",
    notes: "Social media",
  },
  {
    siteName: "LinkedIn",
    siteUrl: "https://linkedin.com",
    username: "your.email@gmail.com",
    password: "LinkedInSecure2024!@#",
    notes: "Professional network",
  },
  {
    siteName: "Facebook",
    siteUrl: "https://facebook.com",
    username: "your.email@gmail.com",
    password: "FacebookPass2024!@#",
    notes: "Social network",
  },
  {
    siteName: "Spotify",
    siteUrl: "https://spotify.com",
    username: "your.email@gmail.com",
    password: "SpotifyMusic2024!@#",
    notes: "Music streaming",
  },
  {
    siteName: "Dropbox",
    siteUrl: "https://dropbox.com",
    username: "your.email@gmail.com",
    password: "DropboxSecure2024!@#",
    notes: "Cloud storage",
  },
  {
    siteName: "Reddit",
    siteUrl: "https://reddit.com",
    username: "your_reddit_username",
    password: "RedditPass2024!@#",
    notes: "Social news",
  },
];
```

---

## 🐛 Troubleshooting

### Issue: "Failed to unlock vault"

**Possible Causes:**

- Backend not running
- Wrong master password
- Network error

**Solutions:**

1. Check backend is running: `http://localhost:3001/health`
2. Verify master password
3. Check browser console (F12) for errors

### Issue: Extension won't load

**Solutions:**

1. Rebuild extension:
   ```bash
   cd packages/extension
   npm run build
   ```
2. Reload extension in `chrome://extensions/`
3. Check for errors in extension details

### Issue: Passwords not saving

**Solutions:**

1. Check backend console for errors
2. Verify vault is unlocked
3. Check network tab in DevTools

---

## 🎉 Success Criteria

You've successfully tested the extension if:

- ✅ Can create a vault with master password
- ✅ Can add multiple passwords
- ✅ Can search and filter passwords
- ✅ Can copy passwords to clipboard
- ✅ Vault locks manually and automatically
- ✅ Browser close destroys the encryption key
- ✅ Extension reload requires re-authentication
- ✅ Backend stores only encrypted data
- ✅ Encryption key is non-extractable

---

## 📝 Next Steps

After testing:

1. **Customize the extension:**

   - Change auto-lock timeout
   - Update UI styling
   - Add more features

2. **Use it for real:**

   - Add your actual passwords
   - Use the password generator
   - Enjoy zero-knowledge security!

3. **Deploy to production:**
   - Set up a production backend
   - Update backend URL in extension
   - Publish to Chrome Web Store

---

**Happy Testing! 🔐✨**
