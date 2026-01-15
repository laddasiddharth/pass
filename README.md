# 🔐 Zero-Knowledge Password Manager

A modern, high-security password manager built with a Zero-Knowledge architecture. This project ensures that your master password and decrypted data **never leave your device**. The server only sees and stores encrypted "blobs" of data that it cannot read.

## 🚀 Overview

This repository is a **monorepo** containing all the necessary components for a full-scale password management system:

- **Browser Extension**: A Chrome/Edge extension for managing passwords directly in your browser.
- **Backend Sync Server**: An Express.js & MongoDB backend that handles blind synchronization of encrypted vaults.
- **Crypto Engine**: A standalone package that handles all cryptographic operations using industrial-standard algorithms.
- **Web Dashboard**: A Next.js dashboard for managing your account and viewing vault metadata.

## 🛡️ Security Architecture

### Zero-Knowledge Principles

- **Argon2id Key Derivation**: Uses Argon2id (via `@noble/hashes`) to derive high-entropy encryption keys from your master password.
- **AES-256-GCM Encryption**: All vault data is encrypted locally using AES-GCM before being sent to the server.
- **SRP-style Authentication**: Proves you know your password to the server without ever actually sending the password (or even its hash).

## 📁 Project Structure

```text
├── packages/
│   ├── extension/        # Browser extension (Chrome Manifest V3)
│   ├── backend/          # Node.js + MongoDB synchronization server
│   └── crypto-engine/    # Local cryptographic core
├── app/                  # Next.js Web Dashboard
├── components/           # Shared UI components (Shadcn/UI)
└── hooks/                # Strategic React hooks for vault management
```

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or local MongoDB)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/laddasiddharth/pass.git
    cd pass
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Setup Environment Variables:**
    Create a `.env` file in the root (and in `packages/backend/.env`):
    ```env
    PORT=3001
    MONGODB_URI=your_mongodb_connection_string
    ```

### Running the Project

#### 1. Start the Backend

```bash
cd packages/backend
npm run dev
```

#### 2. Start the Dashboard

```bash
# From root
npm run dev
```

#### 3. Build & Load the Extension

```bash
cd packages/extension
node build.js
```

- Open Chrome and go to `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked** and select the `packages/extension/dist` folder.

## ✨ Key Features

- ✅ **In-Extension Registration**: Create a new zero-knowledge account directly from the popup.
- ✅ **Blind Synchronization**: Sync your encrypted vault across devices without the server ever seeing your passwords.
- ✅ **Plaintext Labels**: Securely store identifying site names/labels for easy management while keeping credentials encrypted.
- ✅ **Auto-Lock**: The extension automatically locks and clears sensitive keys from memory after 15 minutes of inactivity.

## 📜 License

This project is for educational and personal use. Security-sensitive applications should always undergo a full independent audit.
