# 🔐 ZeroKnowledge Vault - Password Manager

A modern, high-security password manager built with a **Zero-Knowledge architecture**. This project ensures that your master password and decrypted data **never leave your device**. The server only sees and stores encrypted "blobs" of data that it cannot read.

![Security](https://img.shields.io/badge/Security-Zero--Knowledge-green)
![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-blue)
![KDF](https://img.shields.io/badge/KDF-Argon2id-orange)

## 🚀 Overview

This repository is a **monorepo** containing all the necessary components for a full-scale password management system:

- **Browser Extension**: Chrome/Edge extension for managing passwords directly in your browser
- **Backend Sync Server**: Express.js & MongoDB backend for blind synchronization of encrypted vaults
- **Crypto Engine**: Standalone package handling all cryptographic operations using industrial-standard algorithms
- **Web Dashboard**: Next.js dashboard with OTP verification and full CRUD operations
- **OTP System**: Email-based two-factor authentication for enhanced security

---

## 🛡️ Security Architecture

### Zero-Knowledge Principles

- **🔑 Argon2id Key Derivation**: Uses Argon2id (via `@noble/hashes`) to derive high-entropy encryption keys from your master password
- **🔒 AES-256-GCM Encryption**: All vault data is encrypted locally using AES-GCM before being sent to the server
- **🎯 SRP-style Authentication**: Proves you know your password without ever sending it (or its hash) to the server
- **📧 OTP Verification**: Email-based one-time passwords for additional security layer
- **💾 Client-Side Decryption**: All decryption happens in your browser - server never sees plaintext

### Security Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Login → Server verifies credentials                 │
│ 2. OTP Sent → Email verification code sent                  │
│ 3. OTP Verified → Server sends encrypted vault blob         │
│ 4. Local Decryption → Browser decrypts using master password│
│ 5. Memory Storage → Passwords stored in RAM only            │
│ 6. Operations → View/Copy/Edit without backend              │
│ 7. Save Changes → Re-encrypt and sync to server             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```text
├── packages/
│   ├── extension/        # Browser extension (Chrome Manifest V3)
│   ├── backend/          # Node.js + MongoDB synchronization server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── authRoutes.ts      # Authentication endpoints
│   │   │   │   ├── syncRoutes.ts      # Vault sync endpoints
│   │   │   │   └── otpRoutes.ts       # OTP verification endpoints
│   │   │   ├── services/
│   │   │   │   └── otpService.ts      # Email OTP service
│   │   │   └── database/
│   │   │       └── models.ts          # MongoDB schemas
│   └── crypto-engine/    # Local cryptographic core
├── app/                  # Next.js Web Dashboard
│   ├── dashboard/        # Main dashboard with OTP verification
│   └── page.tsx          # Landing/Login page
├── components/           # Shared UI components (Shadcn/UI)
└── hooks/                # React hooks for vault management
```

---

## ✨ Key Features

### 🔐 Security Features

- ✅ **Zero-Knowledge Architecture** - Server never sees your passwords
- ✅ **End-to-End Encryption** - AES-256-GCM encryption
- ✅ **Argon2id KDF** - Industry-standard key derivation
- ✅ **OTP Verification** - Email-based two-factor authentication
- ✅ **Auto-Lock** - Automatic vault locking after inactivity
- ✅ **Memory-Only Storage** - Decrypted passwords never touch disk

### 📱 Dashboard Features

- ✅ **OTP Authentication** - Secure email-based verification
- ✅ **Full CRUD Operations** - Create, Read, Update, Delete credentials
- ✅ **Password Strength Indicator** - Real-time password strength analysis
- ✅ **Password Generator** - Generate strong, random passwords
- ✅ **Search & Filter** - Quickly find credentials
- ✅ **Copy to Clipboard** - One-click password copying
- ✅ **Edit Modal** - Beautiful modal for editing credentials
- ✅ **Delete Confirmation** - Prevent accidental deletions
- ✅ **Responsive Design** - Works on desktop and mobile

### 🔧 Extension Features

- ✅ **In-Extension Registration** - Create account directly from popup
- ✅ **Blind Synchronization** - Sync encrypted vault across devices
- ✅ **Auto-Fill** - Automatically fill login forms
- ✅ **Context Menu** - Right-click to save credentials
- ✅ **Plaintext Labels** - Site names for easy management

### 📧 OTP System

- ✅ **Email Delivery** - Beautiful HTML email templates
- ✅ **10-Minute Expiration** - OTPs expire for security
- ✅ **Resend Functionality** - Request new codes with cooldown
- ✅ **Development Mode** - Console logging when SMTP not configured
- ✅ **Automatic Cleanup** - MongoDB TTL index removes expired OTPs

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or local MongoDB)
- Gmail account (for OTP emails) or other SMTP service

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/laddasiddharth/pass.git
   cd pass
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Setup Environment Variables:**

   Create a `.env` file in `packages/backend/.env`:

   ```env
   PORT=3001
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/password-manager?retryWrites=true&w=majority

   # SMTP Configuration (Optional - for OTP emails)
   # If not configured, OTP will be logged to console in development
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM="ZeroKnowledge Vault" <your-email@gmail.com>
   ```

4. **Setup Gmail App Password (for OTP emails):**
   - Enable 2-Factor Authentication on your Gmail account
   - Go to https://myaccount.google.com/apppasswords
   - Generate an App Password for "Mail"
   - Copy the 16-character password to `SMTP_PASS` in `.env`

---

## 🚀 Running the Project

### 1. Start the Backend

```bash
cd packages/backend
npm run dev
```

Backend will start on `http://localhost:3001`

### 2. Start the Dashboard

```bash
# From root directory
npm run dev
```

Dashboard will start on `http://localhost:3000`

### 3. Build & Load the Extension

```bash
cd packages/extension
node build.js
```

- Open Chrome and go to `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked** and select the `packages/extension/dist` folder

---

## 📖 Usage Guide

### Dashboard Workflow

1. **Register/Login**
   - Navigate to `http://localhost:3000`
   - Create an account or login with existing credentials

2. **OTP Verification**
   - Check your email for the 6-digit OTP code
   - Or check backend console if SMTP is not configured
   - Enter the OTP to unlock your vault

3. **Manage Passwords**
   - **Add**: Fill the form and click "Save Password"
   - **View**: Click the eye icon to reveal passwords
   - **Copy**: Click the copy icon to copy to clipboard
   - **Edit**: Click the blue edit icon to modify credentials
   - **Delete**: Click the red trash icon to remove credentials

4. **Lock Vault**
   - Click the "Lock" button to lock and redirect to login
   - Or logout completely with the logout button

### Extension Workflow

1. **Register** directly from the extension popup
2. **Login** with your credentials
3. **Auto-fill** credentials on websites
4. **Save** new credentials via context menu
5. **Sync** automatically with the backend

---

## 🔍 Development Tools

### Debug Helper

The dashboard includes a debug helper for viewing vault state in the browser console:

```javascript
// View vault state
__VAULT_DEBUG__;

// View all passwords in a table
__VAULT_DEBUG__.viewAll();

// Check specific properties
__VAULT_DEBUG__.decryptedEntries;
__VAULT_DEBUG__.isUnlocked;
__VAULT_DEBUG__.hasKeys;
```

**Note:** Remove this in production builds for security.

---

## 🎨 Tech Stack

### Frontend

- **Next.js 16** - React framework with Turbopack
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Beautiful UI components
- **Lucide Icons** - Modern icon library
- **Sonner** - Toast notifications

### Backend

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Nodemailer** - Email sending
- **TypeScript** - Type-safe development

### Crypto

- **@noble/hashes** - Argon2id, SHA-256
- **Web Crypto API** - AES-256-GCM encryption
- **Custom Crypto Engine** - Zero-knowledge implementation

---

## 📧 OTP Email Configuration

### Development Mode (Default)

If SMTP is not configured, OTP codes will be logged to the backend console:

```
[OTP] 🔧 Development mode - OTP for user@example.com: 123456
```

### Production Mode (Email Sending)

Configure SMTP in `packages/backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="ZeroKnowledge Vault" <your-email@gmail.com>
```

See `packages/backend/OTP_SETUP.md` for detailed configuration guides for:

- Gmail
- SendGrid
- AWS SES
- Mailgun

---

## 🔒 Security Best Practices

### For Users

- ✅ Use a strong, unique master password
- ✅ Enable 2FA on your email account
- ✅ Lock your vault when not in use
- ✅ Don't share your master password
- ✅ Verify OTP codes before entering

### For Developers

- ✅ Never log sensitive data in production
- ✅ Use environment variables for secrets
- ✅ Implement rate limiting on OTP endpoints
- ✅ Use HTTPS in production
- ✅ Remove debug helpers in production builds
- ✅ Regularly update dependencies

---

## 🧪 Testing

### Test OTP System

1. Start backend and frontend servers
2. Login to the dashboard
3. Check email or console for OTP
4. Enter OTP to unlock vault
5. Test add/edit/delete operations

### Test Extension

1. Build and load extension
2. Register new account
3. Save credentials on a website
4. Verify sync with dashboard
5. Test auto-fill functionality

---

## 📊 Database Schema

### User Model

```typescript
{
  email: string;
  verifier: string; // SRP verifier
  salt: string; // User-specific salt
}
```

### Vault Model

```typescript
{
  email: string
  encryptedVault: string  // Encrypted blob
  labels: string[]        // Site names (unencrypted)
  lastSync: Date
}
```

### OTP Model

```typescript
{
  email: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **@noble/hashes** - For Argon2id implementation
- **Shadcn/UI** - For beautiful UI components
- **Next.js Team** - For the amazing framework
- **MongoDB** - For the database platform

---

## 📞 Support

For issues, questions, or suggestions:

- 🐛 [Open an Issue](https://github.com/laddasiddharth/pass/issues)
- 📧 Email: laddasiddharth@gmail.com
- 💬 Discussions: [GitHub Discussions](https://github.com/laddasiddharth/pass/discussions)

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Biometric authentication
- [ ] Password sharing (encrypted)
- [ ] Secure notes
- [ ] File attachments
- [ ] Import from other password managers
- [ ] Browser extension for Firefox/Safari
- [ ] Self-hosted option
- [ ] Audit logs
- [ ] Emergency access

---

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ by [Siddharth Ladda](https://github.com/laddasiddharth)**
