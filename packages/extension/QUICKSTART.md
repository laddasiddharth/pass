# Quick Start Guide - Browser Extension

## 🚀 Get Started in 5 Minutes

### Step 1: Build the Extension

```bash
cd packages/extension
npm install
npm run build
```

✅ **Done!** The extension is now built in the `dist/` folder.

---

### Step 2: Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to and select: `packages/extension/dist/`
5. The extension icon should appear in your toolbar 🔐

---

### Step 3: First Use

1. **Click the extension icon** in your toolbar
2. **Enter a User ID** (e.g., your email address)
3. **Create a Master Password**
   - Make it strong! At least 16 characters
   - Mix uppercase, lowercase, numbers, symbols
   - This password encrypts ALL your data
4. **Click "Unlock Vault"**

🎉 Your vault is now created and unlocked!

---

### Step 4: Add Your First Password

1. Click **+ Add Password**
2. Fill in the form:
   - **Website/Service**: e.g., "GitHub"
   - **URL**: e.g., "https://github.com"
   - **Username**: your GitHub username
   - **Password**: your GitHub password (or click 🎲 to generate)
   - **Notes**: (optional) any additional info
3. Click **Save Password**

✅ Your password is now encrypted and saved!

---

### Step 5: Use Your Passwords

#### Method 1: Copy from Vault

1. Click the extension icon
2. Unlock your vault (if locked)
3. Search for the password you need
4. Click **Copy** next to the password
5. Paste into the login form

#### Method 2: Auto-Fill (Coming Soon)

The content script will detect login forms and add an autofill button automatically.

---

## 🔒 Security Tips

### DO ✅

- **Use a strong master password** (16+ characters)
- **Lock your vault** when stepping away from your computer
- **Keep your browser updated**
- **Use unique passwords** for each site (use the generator!)

### DON'T ❌

- **Don't share your master password** with anyone
- **Don't write down your master password**
- **Don't reuse your master password** from other services
- **Don't install untrusted browser extensions**

---

## 🛠️ Configuration

### Change Backend URL

Edit `packages/extension/src/background/service-worker.ts`:

```typescript
const BACKEND_URL = "http://localhost:3001"; // Change this
```

Then rebuild:

```bash
npm run build
```

### Change Auto-Lock Timeout

Edit `packages/extension/src/background/service-worker.ts`:

```typescript
const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes
```

Change to your preferred timeout (in milliseconds).

---

## 📱 Using the Extension

### Unlock Screen

![Unlock Screen](https://via.placeholder.com/380x500/6366f1/ffffff?text=Unlock+Screen)

- Enter your User ID and Master Password
- Click "Unlock Vault"
- Your master password is immediately cleared from memory

### Vault Screen

![Vault Screen](https://via.placeholder.com/380x500/6366f1/ffffff?text=Vault+Screen)

- Search for passwords
- Click "Copy" to copy password to clipboard
- Click "Lock" to lock your vault
- Click "+ Add Password" to add new entry

### Add Password Screen

![Add Password Screen](https://via.placeholder.com/380x500/6366f1/ffffff?text=Add+Password)

- Fill in website details
- Click 🎲 to generate a secure password
- Click 👁️ to show/hide password
- Click "Save Password" to encrypt and save

---

## 🔧 Troubleshooting

### Extension won't load

**Check:**

- Developer mode is enabled
- You selected the `dist/` folder (not `src/`)
- No errors in `chrome://extensions/`

**Fix:**

```bash
cd packages/extension
npm run build
```

### "Failed to unlock vault"

**Possible causes:**

- Wrong master password
- Backend not running
- Network error

**Fix:**

1. Double-check your master password
2. Start the backend: `cd packages/backend && npm run dev`
3. Check browser console (F12) for errors

### Vault locked unexpectedly

**This is normal!** The vault auto-locks after 15 minutes of inactivity for security.

Simply unlock again with your master password.

### Can't remember master password

**Unfortunately, there's no recovery option.** This is by design for zero-knowledge security.

You'll need to:

1. Create a new vault with a new master password
2. Manually re-add your passwords

**Prevention:** Use a password you'll remember, or store it in a secure physical location.

---

## 🎯 Next Steps

### For Users

- [ ] Add all your passwords to the vault
- [ ] Generate strong passwords for new accounts
- [ ] Set up auto-lock timeout to your preference
- [ ] Practice locking/unlocking the vault

### For Developers

- [ ] Review the security architecture (`SECURITY.md`)
- [ ] Customize the UI (`public/popup.html`, `public/popup.css`)
- [ ] Add new features (see `README.md` for ideas)
- [ ] Set up the backend (`packages/backend`)

---

## 📚 Learn More

- **Full Documentation**: `README.md`
- **Security Details**: `SECURITY.md`
- **Crypto Engine**: `../crypto-engine/README.md`
- **Backend API**: `../backend/README.md`

---

## 🆘 Need Help?

### Common Questions

**Q: Is my data safe?**
A: Yes! All encryption happens on your device. The backend only stores encrypted blobs it cannot decrypt.

**Q: What happens if I forget my master password?**
A: Unfortunately, there's no recovery. This is the trade-off for zero-knowledge security.

**Q: Can I use this on multiple computers?**
A: Yes! Your encrypted vault is synced via the backend. Just use the same User ID and Master Password.

**Q: How do I change my master password?**
A: Currently, you need to create a new vault. Password rotation feature is planned.

**Q: Is this production-ready?**
A: This is a demonstration/educational project. For production use, additional security audits are recommended.

---

## ✅ Quick Checklist

Before using the extension:

- [ ] Backend is running (`npm run dev` in `packages/backend`)
- [ ] Extension is built (`npm run build` in `packages/extension`)
- [ ] Extension is loaded in Chrome (`chrome://extensions/`)
- [ ] You've chosen a strong master password
- [ ] You understand the security model (read `SECURITY.md`)

---

**You're all set! Enjoy your secure, zero-knowledge password manager! 🔐**
