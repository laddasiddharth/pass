/**
 * Background Service Worker - Manifest V3
 * 
 * This is the security core of the extension. It:
 * - Holds the derived encryption key in memory (never persisted)
 * - Manages vault state and auto-lock timer
 * - Handles all cryptographic operations
 * - Communicates with popup and content scripts via message passing
 * 
 * Security guarantees:
 * - Key exists only in memory
 * - Browser close destroys the key
 * - Extension reload requires re-authentication
 * - Auto-lock after inactivity
 */

import { deriveKey, encrypt, decrypt } from '@password-manager/crypto-engine'
import type { DerivedKey, VaultEntry, EncryptedVault } from '@password-manager/crypto-engine'

// ============================================================================
// SECURITY-CRITICAL: In-Memory State
// ============================================================================

// Local interface for extension's password entries
interface PasswordEntry {
  id: string
  siteName: string
  siteUrl: string
  username: string
  password: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface SessionState {
  userId: string | null
  derivedKey: DerivedKey | null
  decryptedVault: PasswordEntry[] | null
  isLocked: boolean
  lastActivity: number
}


// This state exists ONLY in memory and is destroyed on extension reload/browser close
let sessionState: SessionState = {
  userId: null,
  derivedKey: null,
  decryptedVault: null,
  isLocked: true,
  lastActivity: Date.now()
}

// ============================================================================
// Configuration
// ============================================================================

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000 // 15 minutes in milliseconds
const BACKEND_URL = 'http://localhost:3001' // Phase 2 backend

// ============================================================================
// Auto-Lock Timer
// ============================================================================

let autoLockTimer: number | null = null

function resetAutoLockTimer(): void {
  sessionState.lastActivity = Date.now()
  
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer)
  }
  
  autoLockTimer = setTimeout(() => {
    lockVault()
  }, AUTO_LOCK_TIMEOUT) as unknown as number
}

function lockVault(): void {
  console.log('[Background] Locking vault and clearing sensitive data')
  
  // SECURITY: Explicitly clear all references to sensitive data
  sessionState.userId = null
  sessionState.derivedKey = null
  sessionState.decryptedVault = null
  sessionState.isLocked = true
  
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer)
    autoLockTimer = null
  }
  
  // Notify popup that vault is locked
  chrome.runtime.sendMessage({ type: 'VAULT_LOCKED' }).catch(() => {
    // Popup might not be open, ignore error
  })
}

// ============================================================================
// Message Handlers
// ============================================================================

interface UnlockVaultMessage {
  type: 'UNLOCK_VAULT'
  masterPassword: string
  userId: string
}

interface AddPasswordMessage {
  type: 'ADD_PASSWORD'
  entry: PasswordEntry
}


interface GetVaultMessage {
  type: 'GET_VAULT'
}

interface LockVaultMessage {
  type: 'LOCK_VAULT'
}

interface GetStatusMessage {
  type: 'GET_STATUS'
}

interface HeartbeatMessage {
  type: 'HEARTBEAT'
}

interface DeletePasswordMessage {
  type: 'DELETE_PASSWORD'
  entryId: string
}

interface UpdatePasswordMessage {
  type: 'UPDATE_PASSWORD'
  entry: PasswordEntry
}

interface RegisterUserMessage {
  type: 'REGISTER_USER'
  email: string
  masterPassword: string
}


type BackgroundMessage = 
  | UnlockVaultMessage 
  | AddPasswordMessage 
  | GetVaultMessage 
  | LockVaultMessage
  | GetStatusMessage
  | HeartbeatMessage
  | DeletePasswordMessage
  | UpdatePasswordMessage
  | RegisterUserMessage



chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type)
  
  // Handle messages asynchronously
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Background] Error handling message:', error)
      sendResponse({ success: false, error: error.message })
    })
  
  // Return true to indicate async response
  return true
})

async function handleMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'UNLOCK_VAULT':
      return await handleUnlockVault(message)
    
    case 'ADD_PASSWORD':
      return await handleAddPassword(message)
    
    case 'DELETE_PASSWORD':
      return await handleDeletePassword(message)

    case 'UPDATE_PASSWORD':
      return await handleUpdatePassword(message)
    
    case 'GET_VAULT':
      return handleGetVault()
    
    case 'LOCK_VAULT':
      return handleLockVault()
    
    case 'GET_STATUS':
      return handleGetStatus()
    
    case 'HEARTBEAT':
      resetAutoLockTimer() // Keep session alive
      return { success: true }
    
    case 'REGISTER_USER':
      return await handleRegisterUser(message)

    default:
      return Promise.resolve({ success: false, error: 'Unknown message type' })
  }
}

// ============================================================================
// Unlock Vault Handler
// ============================================================================

async function handleUnlockVault(message: UnlockVaultMessage): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Background] Unlocking vault for user:', message.userId)
    
    // Step 1: Fetch encrypted vault from backend
    const response = await fetch(`${BACKEND_URL}/api/vault/${message.userId}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        // New user - create empty vault
        console.log('[Background] No vault found, creating new vault')
        
        // Derive key from master password
        const derivedKey = await deriveKey(message.masterPassword)
        
        // Create empty vault
        const emptyVault: PasswordEntry[] = []
        // SECURITY: We use JSON.stringify(emptyVault) to treat the whole list as the secret payload
        const encryptedVault = await encrypt({ site: 'VAULT_ROOT', username: 'SYSTEM', password: JSON.stringify(emptyVault) }, derivedKey)
        
        // Save to backend
        await saveVault(message.userId, encryptedVault, [])
        
        // Store in session
        sessionState.userId = message.userId
        sessionState.derivedKey = derivedKey
        sessionState.decryptedVault = emptyVault
        sessionState.isLocked = false
        
        resetAutoLockTimer()
        
        return { success: true }

      }
      
      throw new Error(`Backend error: ${response.statusText}`)
    }
    
    const encryptedVault: EncryptedVault = await response.json()
    
    // Step 2: Derive key from master password
    // SECURITY: Use the salt from the encrypted vault
    const salt = base64ToBuffer(encryptedVault.salt)
    const derivedKey = await deriveKey(message.masterPassword, salt)
    
    // Step 3: Decrypt vault
    // This will throw if the password is incorrect
    const rootEntry = await decrypt(encryptedVault, derivedKey)
    const decryptedVault: PasswordEntry[] = JSON.parse(rootEntry.password) 
    // Step 4: Store in memory (NEVER persist to disk)
    sessionState.userId = message.userId
    sessionState.derivedKey = derivedKey
    sessionState.decryptedVault = decryptedVault
    sessionState.isLocked = false

    
    // Step 5: Start auto-lock timer
    resetAutoLockTimer()
    
    console.log('[Background] Vault unlocked successfully')
    
    return { success: true }
    
  } catch (error: any) {
    console.error('[Background] Failed to unlock vault:', error)
    
    // Clear any partial state
    sessionState.userId = null
    sessionState.derivedKey = null
    sessionState.decryptedVault = null
    sessionState.isLocked = true
    
    return { 
      success: false, 
      error: error.message || 'Failed to unlock vault. Check your master password.' 
    }
  }
}

// ============================================================================
// Register User Handler
// ============================================================================

async function handleRegisterUser(message: RegisterUserMessage): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Background] Registering new user:', message.email)
    
    // Step 1: Generate salt and derive keys
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const derivedKey = await deriveKey(message.masterPassword, salt)
    
    // Step 2: Create auth proof (verifier)
    const encoder = new TextEncoder()
    const proofData = encoder.encode("auth-proof")
    const proofBuffer = await crypto.subtle.sign("HMAC", derivedKey.authKey, proofData)
    const verifier = Array.from(new Uint8Array(proofBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Step 3: Register with backend
    const regResponse = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: message.email,
        salt: saltHex,
        verifier: verifier
      })
    })

    if (!regResponse.ok) {
      const errorData = await regResponse.json()
      throw new Error(errorData.message || errorData.error || 'Registration failed')
    }

    const regData = await regResponse.json()
    console.log('[Background] User registered successfully, ID:', regData.userId)

    // Step 4: Initialize an empty vault for the new user
    const emptyVault: PasswordEntry[] = []
    const encryptedVault = await encrypt({ 
      site: 'VAULT_ROOT', 
      username: 'SYSTEM', 
      password: JSON.stringify(emptyVault) 
    }, derivedKey)
    
    // Save to backend
    await saveVault(message.email, encryptedVault, [])
    
    // Step 5: Store in memory to "log in" the user immediately
    sessionState.userId = message.email
    sessionState.derivedKey = derivedKey
    sessionState.decryptedVault = emptyVault
    sessionState.isLocked = false
    
    resetAutoLockTimer()
    
    return { success: true }

  } catch (error: any) {
    console.error('[Background] Registration failed:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// Add Password Handler
// ============================================================================

async function handleAddPassword(message: AddPasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.derivedKey || !sessionState.decryptedVault) {
    return { success: false, error: 'Vault is locked' }
  }
  
  try {
    // Add entry to decrypted vault
    sessionState.decryptedVault.push(message.entry)
    
    // Re-encrypt and save to backend
    const encryptedVault = await encrypt({ site: 'VAULT_ROOT', username: 'SYSTEM', password: JSON.stringify(sessionState.decryptedVault) }, sessionState.derivedKey) 
    
    // Extract plaintext labels for server identification
    const labels = sessionState.decryptedVault.map(e => e.siteName)
    
    await saveVault(sessionState.userId!, encryptedVault, labels)
    
    resetAutoLockTimer()
    
    return { success: true }
    
  } catch (error: any) {
    console.error('[Background] Failed to add password:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// Get Vault Handler
// ============================================================================

function handleGetVault(): { success: boolean; vault?: PasswordEntry[]; error?: string } {
  if (sessionState.isLocked || !sessionState.decryptedVault) {
    return { success: false, error: 'Vault is locked' }
  }
  
  resetAutoLockTimer()
  
  return { 
    success: true, 
    vault: sessionState.decryptedVault 
  }
}


// ============================================================================
// Delete Password Handler
// ============================================================================

async function handleDeletePassword(message: DeletePasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.derivedKey || !sessionState.decryptedVault) {
    return { success: false, error: 'Vault is locked' }
  }

  try {
    // Remove entry from decrypted vault
    sessionState.decryptedVault = sessionState.decryptedVault.filter(e => e.id !== message.entryId)

    // Re-encrypt and save to backend
    const encryptedVault = await encrypt({ site: 'VAULT_ROOT', username: 'SYSTEM', password: JSON.stringify(sessionState.decryptedVault) }, sessionState.derivedKey)
    
    const labels = sessionState.decryptedVault.map(e => e.siteName)
    await saveVault(sessionState.userId!, encryptedVault, labels)

    resetAutoLockTimer()
    return { success: true }

  } catch (error: any) {
    console.error('[Background] Failed to delete password:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// Update Password Handler
// ============================================================================

async function handleUpdatePassword(message: UpdatePasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.derivedKey || !sessionState.decryptedVault) {
    return { success: false, error: 'Vault is locked' }
  }

  try {
    // Update entry in decrypted vault
    const index = sessionState.decryptedVault.findIndex(e => e.id === message.entry.id)
    if (index === -1) {
      return { success: false, error: 'Entry not found' }
    }

    sessionState.decryptedVault[index] = {
      ...message.entry,
      updatedAt: new Date().toISOString()
    }

    // Re-encrypt and save to backend
    const encryptedVault = await encrypt({ site: 'VAULT_ROOT', username: 'SYSTEM', password: JSON.stringify(sessionState.decryptedVault) }, sessionState.derivedKey)
    
    const labels = sessionState.decryptedVault.map(e => e.siteName)
    await saveVault(sessionState.userId!, encryptedVault, labels)

    resetAutoLockTimer()
    return { success: true }

  } catch (error: any) {
    console.error('[Background] Failed to update password:', error)
    return { success: false, error: error.message }
  }
}


// ============================================================================
// Lock Vault Handler
// ============================================================================

function handleLockVault(): { success: boolean } {
  lockVault()
  return { success: true }
}

// ============================================================================
// Get Status Handler
// ============================================================================

function handleGetStatus(): { isLocked: boolean } {
  return { isLocked: sessionState.isLocked }
}

async function saveVault(userId: string, encryptedVault: EncryptedVault, labels: string[]): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/vault/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedVault,
      labels
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to save vault: ${response.statusText}`)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function base64ToBuffer(base64: string): Uint8Array {
  try {
    const binary = atob(base64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i)
    }
    return buffer
  } catch (error) {
    console.error('[Background] Failed to decode base64:', error)
    return new Uint8Array(0)
  }
}

// ============================================================================
// Extension Lifecycle
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed')
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser started - vault is locked by default')
})

// SECURITY: When service worker is terminated, all state is lost
// This is a FEATURE, not a bug - it ensures the key is never persisted
console.log('[Background] Service worker initialized - vault is locked')
