/**
 * Content Script
 * 
 * Runs in the context of web pages to detect login forms and enable autofill.
 * 
 * SECURITY CONSTRAINTS:
 * - NO access to cryptographic operations
 * - NO access to decrypted vault data
 * - Can only request autofill via background worker
 * - Cannot read master password or encryption keys
 * 
 * This script is intentionally minimal to maintain security boundaries.
 */

console.log('[Content Script] Password Manager content script loaded')

// ============================================================================
// Form Detection
// ============================================================================

function detectLoginForms() {
  const forms = document.querySelectorAll('form')
  
  forms.forEach(form => {
    const passwordInputs = form.querySelectorAll('input[type="password"]')
    const usernameInputs = form.querySelectorAll('input[type="text"], input[type="email"]')
    
    if (passwordInputs.length > 0 && usernameInputs.length > 0) {
      console.log('[Content Script] Login form detected')
      addAutofillButton(form, usernameInputs[0] as HTMLInputElement, passwordInputs[0] as HTMLInputElement)
    }
  })
}

// ============================================================================
// Autofill Button
// ============================================================================

function addAutofillButton(form: HTMLFormElement, usernameInput: HTMLInputElement, passwordInput: HTMLInputElement) {
  // Check if button already exists
  if (form.querySelector('.pm-autofill-btn')) {
    return
  }
  
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pm-autofill-btn'
  button.textContent = '🔐 Autofill'
  button.style.cssText = `
    position: absolute;
    top: -30px;
    right: 0;
    padding: 6px 12px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `
  
  button.addEventListener('click', async () => {
    const currentUrl = window.location.href
    
    // Request autofill from background worker
    chrome.runtime.sendMessage({
      type: 'REQUEST_AUTOFILL',
      url: currentUrl
    }, (response) => {
      if (response && response.success && response.entry) {
        if (usernameInput) usernameInput.value = response.entry.username
        if (passwordInput) passwordInput.value = response.entry.password
        
        // Trigger input events for frameworks like React
        if (usernameInput) usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
        if (passwordInput) passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
        
        button.textContent = '✓ Filled'
        setTimeout(() => {
          button.textContent = '🔐 Autofill'
        }, 2000)
      } else {
        button.textContent = '❌ Not found'
        setTimeout(() => {
          button.textContent = '🔐 Autofill'
        }, 2000)
      }
    })
  })
  
  // Position button relative to form
  const formRect = form.getBoundingClientRect()
  if (formRect.top > 40) {
    form.style.position = 'relative'
    form.appendChild(button)
  }
}

// ============================================================================
// Initialize
// ============================================================================

// Detect forms on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectLoginForms)
} else {
  detectLoginForms()
}

// Re-detect forms when DOM changes (for SPAs)
const observer = new MutationObserver(() => {
  detectLoginForms()
})

if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// SECURITY NOTE: This content script has NO access to:
// - Master password
// - Derived encryption key
// - Decrypted vault data
// - Cryptographic operations
// 
// All sensitive operations are handled by the background service worker.

