/**
 * Popup UI Script
 * 
 * Handles user interaction and communicates with the background service worker.
 * 
 * SECURITY NOTES:
 * - Master password is sent to background worker and immediately cleared
 * - No cryptographic operations happen here
 * - All sensitive operations delegated to background worker
 */

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

// ============================================================================
// DOM Elements
// ============================================================================

// Screens
const unlockScreen = document.getElementById('unlock-screen') as HTMLElement
const registerScreen = document.getElementById('register-screen') as HTMLElement
const vaultScreen = document.getElementById('vault-screen') as HTMLElement
const addPasswordScreen = document.getElementById('add-password-screen') as HTMLElement

// Unlock form
const unlockForm = document.getElementById('unlock-form') as HTMLFormElement
const userIdInput = document.getElementById('user-id') as HTMLInputElement
const masterPasswordInput = document.getElementById('master-password') as HTMLInputElement
const unlockBtn = document.getElementById('unlock-btn') as HTMLButtonElement
const unlockLoading = document.getElementById('unlock-loading') as HTMLElement
const unlockError = document.getElementById('unlock-error') as HTMLElement
const goToRegisterBtn = document.getElementById('go-to-register') as HTMLElement

// Register form
const registerForm = document.getElementById('register-form') as HTMLFormElement
const regEmailInput = document.getElementById('reg-email') as HTMLInputElement
const regPasswordInput = document.getElementById('reg-password') as HTMLInputElement
const regPasswordConfirmInput = document.getElementById('reg-password-confirm') as HTMLInputElement
const registerBtn = document.getElementById('register-btn') as HTMLButtonElement
const registerLoading = document.getElementById('register-loading') as HTMLElement
const registerError = document.getElementById('register-error') as HTMLElement
const goToLoginBtn = document.getElementById('go-to-login') as HTMLElement

// Vault screen
const lockBtn = document.getElementById('lock-btn') as HTMLButtonElement
const searchInput = document.getElementById('search-input') as HTMLInputElement
const vaultList = document.getElementById('vault-list') as HTMLElement
const emptyState = document.getElementById('empty-state') as HTMLElement
const addPasswordBtn = document.getElementById('add-password-btn') as HTMLButtonElement
const userDisplay = document.getElementById('user-display') as HTMLElement
const displayUserEmail = document.getElementById('display-user-email') as HTMLElement

// Add password form
const backBtn = document.getElementById('back-btn') as HTMLButtonElement
const addPasswordForm = document.getElementById('add-password-form') as HTMLFormElement
const siteNameInput = document.getElementById('site-name') as HTMLInputElement
const siteUrlInput = document.getElementById('site-url') as HTMLInputElement
const usernameInput = document.getElementById('username') as HTMLInputElement
const passwordInput = document.getElementById('password') as HTMLInputElement
const notesInput = document.getElementById('notes') as HTMLTextAreaElement
const togglePasswordBtn = document.getElementById('toggle-password') as HTMLButtonElement
const generatePasswordBtn = document.getElementById('generate-password') as HTMLButtonElement
const addError = document.getElementById('add-error') as HTMLElement
const saveBtn = addPasswordForm?.querySelector('button[type="submit"]') as HTMLButtonElement


// ============================================================================
// State
// ============================================================================

let currentVault: PasswordEntry[] = []
let currentUserId = ''
let editingEntryId: string | null = null


// ============================================================================
// Initialization
// ============================================================================

async function init() {
  // Check if vault is already unlocked
  const status = await sendMessage({ type: 'GET_STATUS' })
  
  if (status && !status.isLocked) {
    await loadVault()
    showScreen('vault')
  } else {
    showScreen('unlock')
  }
  
  // Start heartbeat to keep background script alive while popup is open
  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'HEARTBEAT' }).catch(() => {})
  }, 10000)

  // Load saved user ID
  const saved = await chrome.storage.local.get(['userId'])
  if (saved.userId) {
    if (userIdInput) userIdInput.value = saved.userId
    currentUserId = saved.userId
  }
}


// ============================================================================
// Screen Management
// ============================================================================

function showScreen(screenName: string) {
  if (unlockScreen) unlockScreen.classList.add('hidden')
  if (registerScreen) registerScreen.classList.add('hidden')
  if (vaultScreen) vaultScreen.classList.add('hidden')
  if (addPasswordScreen) addPasswordScreen.classList.add('hidden')
  
  switch (screenName) {
    case 'unlock':
      if (unlockScreen) unlockScreen.classList.remove('hidden')
      if (masterPasswordInput) masterPasswordInput.focus()
      break
    case 'register':
      if (registerScreen) registerScreen.classList.remove('hidden')
      if (regEmailInput) regEmailInput.focus()
      break
    case 'vault':
      if (vaultScreen) vaultScreen.classList.remove('hidden')
      if (userDisplay) userDisplay.classList.remove('hidden')
      if (displayUserEmail) displayUserEmail.textContent = currentUserId
      if (searchInput) searchInput.focus()
      break
    case 'add-password':
      if (addPasswordScreen) addPasswordScreen.classList.remove('hidden')
      if (siteNameInput) siteNameInput.focus()
      break
  }
}

// ============================================================================
// Unlock Vault
// ============================================================================

if (unlockForm) {
  unlockForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const userId = userIdInput.value.trim()
    const masterPassword = masterPasswordInput.value
    
    if (!userId || !masterPassword) {
      showError(unlockError, 'Please enter both User ID and Master Password')
      return
    }
    
    // Show loading state
    if (unlockBtn) unlockBtn.disabled = true
    if (unlockLoading) unlockLoading.classList.remove('hidden')
    if (unlockError) unlockError.classList.add('hidden')
    
    try {
      // Send unlock request to background worker
      const response = await sendMessage({
        type: 'UNLOCK_VAULT',
        masterPassword,
        userId
      })
      
      if (response && response.success) {
        // SECURITY: Clear master password immediately
        if (masterPasswordInput) masterPasswordInput.value = ''
        
        // Save user ID for convenience
        currentUserId = userId
        await chrome.storage.local.set({ userId })
        
        // Load and display vault
        await loadVault()
        showScreen('vault')
      } else {
        showError(unlockError, (response && response.error) || 'Failed to unlock vault')
      }
    } catch (error: any) {
      showError(unlockError, error.message)
    } finally {
      if (unlockBtn) unlockBtn.disabled = false
      if (unlockLoading) unlockLoading.classList.add('hidden')
    }
  })
}

// Navigation
if (goToRegisterBtn) {
  goToRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault()
    showScreen('register')
  })
}

if (goToLoginBtn) {
  goToLoginBtn.addEventListener('click', (e) => {
    e.preventDefault()
    showScreen('unlock')
  })
}

// ============================================================================
// Register User
// ============================================================================

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const email = regEmailInput.value.trim()
    const password = regPasswordInput.value
    const confirm = regPasswordConfirmInput.value
    
    if (!email || !password || !confirm) {
      showError(registerError, 'Please fill in all fields')
      return
    }
    
    if (password !== confirm) {
      showError(registerError, 'Passwords do not match')
      return
    }
    
    if (password.length < 8) {
      showError(registerError, 'Password must be at least 8 characters')
      return
    }
    
    // Show loading state
    if (registerBtn) registerBtn.disabled = true
    if (registerLoading) registerLoading.classList.remove('hidden')
    if (registerError) registerError.classList.add('hidden')
    
    try {
      const response = await sendMessage({
        type: 'REGISTER_USER',
        email,
        masterPassword: password
      })
      
      if (response && response.success) {
        // Registration successful
        currentUserId = email
        await chrome.storage.local.set({ userId: email })
        
        // Clear inputs
        if (regPasswordInput) regPasswordInput.value = ''
        if (regPasswordConfirmInput) regPasswordConfirmInput.value = ''
        
        // Show vault
        await loadVault()
        showScreen('vault')
      } else {
        showError(registerError, (response && response.error) || 'Failed to register')
      }
    } catch (error: any) {
      showError(registerError, error.message)
    } finally {
      if (registerBtn) registerBtn.disabled = false
      if (registerLoading) registerLoading.classList.add('hidden')
    }
  })
}

// ============================================================================
// Load Vault
// ============================================================================

async function loadVault() {
  try {
    const response = await sendMessage({ type: 'GET_VAULT' })
    
    if (response && response.success) {
      currentVault = response.vault
      renderVault(currentVault)
    } else {
      showError(unlockError, (response && response.error) || 'Failed to load vault')
    }
  } catch (error) {
    console.error('Failed to load vault:', error)
  }
}

// ============================================================================
// Render Vault
// ============================================================================

function renderVault(entries: PasswordEntry[]) {
  if (!vaultList) return
  vaultList.innerHTML = ''
  
  if (entries.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden')
    return
  }
  
  if (emptyState) emptyState.classList.add('hidden')
  
  entries.forEach((entry, index) => {
    const item = createVaultItem(entry, index)
    vaultList.appendChild(item)
  })
}

function createVaultItem(entry: PasswordEntry, index: number) {
  const div = document.createElement('div')
  div.className = 'vault-item'
  
  div.innerHTML = `
    <div class="vault-item-header">
      <div class="vault-item-title">${escapeHtml(entry.siteName)}</div>
      <div class="vault-item-actions">
        <button class="action-btn edit-btn">Edit</button>
        <button class="action-btn delete-btn delete">Delete</button>
        <button class="copy-btn">Copy</button>
      </div>
    </div>
    <div class="vault-item-url">${escapeHtml(entry.siteUrl)}</div>
    <div class="vault-item-username">${escapeHtml(entry.username)}</div>
  `
  
  // Add copy functionality
  const copyBtn = div.querySelector('.copy-btn') as HTMLButtonElement
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyToClipboard(entry.password, copyBtn)
    })
  }

  // Add edit functionality
  const editBtn = div.querySelector('.edit-btn') as HTMLButtonElement
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      startEdit(entry)
    })
  }

  // Add delete functionality
  const deleteBtn = div.querySelector('.delete-btn') as HTMLButtonElement
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      handleDelete(entry.id)
    })
  }
  
  return div
}

async function startEdit(entry: PasswordEntry) {
  editingEntryId = entry.id
  const title = document.getElementById('add-password-title')
  if (title) title.textContent = 'Edit Password'
  
  if (siteNameInput) siteNameInput.value = entry.siteName
  if (siteUrlInput) siteUrlInput.value = entry.siteUrl
  if (usernameInput) usernameInput.value = entry.username
  if (passwordInput) passwordInput.value = entry.password
  if (notesInput) notesInput.value = entry.notes || ''
  
  showScreen('add-password')
}

async function handleDelete(entryId: string) {
  if (!confirm('Are you sure you want to delete this password?')) return

  try {
    const response = await sendMessage({
      type: 'DELETE_PASSWORD',
      entryId
    })
    
    if (response && response.success) {
      await loadVault()
    } else {
      alert((response && response.error) || 'Failed to delete password')
    }
  } catch (error: any) {
    alert(error.message)
  }
}


// ============================================================================
// Search
// ============================================================================

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase()
    
    if (!query) {
      renderVault(currentVault)
      return
    }
    
    const filtered = currentVault.filter(entry => 
      entry.siteName.toLowerCase().includes(query) ||
      entry.siteUrl.toLowerCase().includes(query) ||
      entry.username.toLowerCase().includes(query)
    )
    
    renderVault(filtered)
  })
}

// ============================================================================
// Add Password
// ============================================================================

if (addPasswordBtn) {
  addPasswordBtn.addEventListener('click', () => {
    editingEntryId = null
    const title = document.getElementById('add-password-title')
    if (title) title.textContent = 'Add Password'
    if (addPasswordForm) addPasswordForm.reset()
    showScreen('add-password')
  })
}

if (backBtn) {
  backBtn.addEventListener('click', () => {
    showScreen('vault')
    if (addPasswordForm) addPasswordForm.reset()
    if (addError) addError.classList.add('hidden')
  })
}

if (addPasswordForm) {
  addPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const originalBtnText = saveBtn ? saveBtn.textContent : 'Save'
    if (saveBtn) {
      saveBtn.disabled = true
      saveBtn.textContent = 'Saving...'
    }
    if (addError) addError.classList.add('hidden')
    
    const entry: PasswordEntry = {
      id: editingEntryId || crypto.randomUUID(),
      siteName: siteNameInput.value.trim(),
      siteUrl: siteUrlInput.value.trim(),
      username: usernameInput.value.trim(),
      password: passwordInput.value,
      notes: notesInput.value.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    try {
      const type = editingEntryId ? 'UPDATE_PASSWORD' : 'ADD_PASSWORD'
      const response = await sendMessage({
        type,
        entry
      })
      
      if (response && response.success) {
        // Clear form BEFORE switching screens to ensure clean state
        if (addPasswordForm) addPasswordForm.reset()
        editingEntryId = null
        
        // Reload vault and go back
        await loadVault()
        showScreen('vault')
      } else {
        showError(addError, (response && response.error) || 'Failed to save password')
      }
    } catch (error: any) {
      showError(addError, error.message)
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false
        saveBtn.textContent = originalBtnText
      }
    }
  })
}

// ============================================================================
// Password Utilities
// ============================================================================

if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    if (!passwordInput) return
    const type = passwordInput.type === 'password' ? 'text' : 'password'
    passwordInput.type = type
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈'
  })
}

if (generatePasswordBtn) {
  generatePasswordBtn.addEventListener('click', () => {
    if (!passwordInput) return
    const password = generateSecurePassword()
    passwordInput.value = password
    passwordInput.type = 'text'
    if (togglePasswordBtn) togglePasswordBtn.textContent = '🙈'
  })
}

function generateSecurePassword(length = 20) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length]
  }
  
  return password
}

// ============================================================================
// Lock Vault
// ============================================================================

if (lockBtn) {
  lockBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'LOCK_VAULT' })
    currentVault = []
    showScreen('unlock')
    if (masterPasswordInput) masterPasswordInput.value = ''
  })
}

// Listen for lock events from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VAULT_LOCKED') {
    currentVault = []
    showScreen('unlock')
    if (masterPasswordInput) masterPasswordInput.value = ''
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

async function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        // Automatic redirection if vault is locked
        if (response && response.error === 'Vault is locked') {
          console.warn('[Popup] Vault is locked, redirecting to unlock screen')
          currentVault = []
          showScreen('unlock')
          if (masterPasswordInput) masterPasswordInput.value = ''
        }
        resolve(response)
      }
    })
  })
}

function showError(element: HTMLElement | null, message: string) {
  if (!element) return
  element.textContent = message
  element.classList.remove('hidden')
  
  setTimeout(() => {
    element.classList.add('hidden')
  }, 5000)
}

function escapeHtml(text: string) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function copyToClipboard(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text)
    
    const originalText = button.textContent
    button.textContent = '✓ Copied'
    button.classList.add('copied')
    
    setTimeout(() => {
      button.textContent = originalText
      button.classList.remove('copied')
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

// ============================================================================
// Initialize
// ============================================================================

init()

