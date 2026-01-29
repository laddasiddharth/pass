"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useVaultSync } from "@/hooks/useVaultSync"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Shield, 
  Lock, 
  Unlock, 
  Plus, 
  Key, 
  Eye, 
  EyeOff, 
  LogOut, 
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  Copy,
  AlertCircle,
  Trash2,
  Sparkles,
  Edit,
  X
} from "lucide-react"
import { deriveKey, encryptVault, decryptVault } from "@password-manager/crypto-engine"
import type { DerivedKey } from "@password-manager/crypto-engine"
import { toast } from "sonner"

// --- Types ---
interface DecryptedEntry {
  id: string
  site: string
  username: string
  password: string
  lastUpdated: string
  isPasswordVisible: boolean
}

// --- Helpers ---
const calculatePasswordStrength = (password: string) => {
  if (!password) return { score: 0, label: "None", color: "bg-gray-200" }
  
  let score = 0
  if (password.length >= 8) score += 20
  if (password.length >= 12) score += 20
  if (/[A-Z]/.test(password)) score += 15
  if (/[a-z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[^A-Za-z0-9]/.test(password)) score += 15

  if (score < 40) return { score, label: "Weak", color: "bg-red-500" }
  if (score < 75) return { score, label: "Moderate", color: "bg-yellow-500" }
  return { score, label: "Strong", color: "bg-green-500" }
}

export default function DashboardPage() {
  const [session, actions] = useVaultSync()
  
  // UI State
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes in seconds
  
  // Vault Data (In-Memory Only)
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([])
  const [derivedKeys, setDerivedKeys] = useState<DerivedKey | null>(null)
  
  // Add Entry Form
  const [newEntry, setNewEntry] = useState({ 
    site: "", 
    username: "", 
    password: "", 
    url: "", 
    notes: "", 
    showPassword: false 
  })
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const strength = calculatePasswordStrength(newEntry.password)

  // Edit Entry State
  const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Inactivity Lock Timer
  const lastActivityRef = useRef<number>(Date.now())
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  const lockVault = useCallback(() => {
    // Phase 4: Zero out sensitive memory
    setDerivedKeys(null)
    setDecryptedEntries([])
    setOtpCode("")
    setIsUnlocked(false)
    setOtpVerified(false)
    toast.info("Vault locked for security")
    // Redirect to login page
    window.location.href = "/"
  }, [])

  // Send OTP on component mount
  useEffect(() => {
    if (session.isAuthenticated && session.email && !otpSent) {
      sendOTPToUser()
    }
  }, [session.isAuthenticated, session.email])

  // Countdown timer for OTP expiration
  useEffect(() => {
    if (!otpSent || otpVerified) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          toast.error("OTP expired. Please request a new code.")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [otpSent, otpVerified])

  // Send OTP to user's email
  const sendOTPToUser = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: session.email }),
      })

      if (response.ok) {
        setOtpSent(true)
        setTimeLeft(600) // Reset timer to 10 minutes
        toast.success("OTP sent to your email")
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to send OTP")
      }
    } catch (error) {
      console.error("Send OTP error:", error)
      toast.error("Failed to send OTP. Please try again.")
    }
  }

  // Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length !== 6) return

    setIsVerifyingOtp(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: session.email,
          code: otpCode 
        }),
      })

      if (response.ok) {
        setOtpVerified(true)
        toast.success("OTP verified successfully!")
        // Automatically proceed to unlock vault
        await unlockVault()
      } else {
        const error = await response.json()
        toast.error(error.message || "Invalid OTP code")
      }
    } catch (error) {
      console.error("Verify OTP error:", error)
      toast.error("Failed to verify OTP. Please try again.")
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle Activity for Auto-lock
  useEffect(() => {
    if (!isUnlocked) return

    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        lockVault()
      }
    }, 10000)

    window.addEventListener("mousemove", handleActivity)
    window.addEventListener("keydown", handleActivity)

    return () => {
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
      clearInterval(checkInactivity)
    }
  }, [isUnlocked, lockVault])

  // Unlock vault after OTP verification
  const unlockVault = async () => {
    try {
      // 1. Derive encryption key locally using Phase-1 crypto engine
      // The salt is retrieved from the session state (fetched during login/register)
      if (!session.salt) {
        throw new Error("No salt found for user. Please re-login.")
      }

      // For now, we'll use the user's email as a temporary master password
      // In a real implementation, you'd prompt for the master password after OTP verification
      const tempPassword = session.email || ""
      const saltBuffer = new Uint8Array(session.salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
      const keys = await deriveKey(tempPassword, saltBuffer)
      setDerivedKeys(keys)

      // 2. Fetch and decrypt vault from backend
      try {
        console.log('[Dashboard] Fetching vault from backend...')
        console.log('[Dashboard] email:', session.email)
        
        // Use the SimpleVault endpoint (extension compatibility)
        // SimpleVault uses email as userId
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || '')}`, {
          method: "GET",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
          }
        })
        
        console.log('[Dashboard] Response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[Dashboard] Response data:', data)
          
          // SimpleVault returns the encrypted data directly
          if (data && data.ciphertext && data.iv && data.salt) {
            console.log('[Dashboard] Decrypting vault...')
            // Import the decrypt function from crypto-engine
            const { decrypt } = await import("@password-manager/crypto-engine")
            
            // Create EncryptedVault object
            const encryptedVault = {
              ciphertext: data.ciphertext,
              iv: data.iv,
              salt: data.salt,
              algorithm: "AES-256-GCM" as const,
              derivationAlgorithm: "Argon2id" as const
            }
            
            // Decrypt the vault
            const decryptedEntry = await decrypt(encryptedVault, keys)
            console.log('[Dashboard] Decrypted entry:', decryptedEntry)
            console.log('[Dashboard] Decrypted entry type:', typeof decryptedEntry)
            console.log('[Dashboard] Decrypted entry keys:', Object.keys(decryptedEntry))
            console.log('[Dashboard] Decrypted entry JSON:', JSON.stringify(decryptedEntry, null, 2))
            
            // The extension stores credentials as an array
            // The decrypt function returns a VaultEntry, but the actual data might be in a property
            let entries: any[] = []
            
            // Check if decryptedEntry is already an array
            if (Array.isArray(decryptedEntry)) {
              console.log('[Dashboard] Decrypted entry is an array')
              entries = decryptedEntry
            } 
            // Check if it's a VaultEntry with the data in a property
            else if (decryptedEntry && typeof decryptedEntry === 'object') {
              console.log('[Dashboard] Decrypted entry is an object, inspecting properties...')
              
              // Log all properties
              for (const [key, value] of Object.entries(decryptedEntry)) {
                console.log(`[Dashboard] Property "${key}":`, value, 'Type:', typeof value)
              }
              
              // Try to find an array property
              const possibleArrays = Object.values(decryptedEntry).filter(val => Array.isArray(val))
              if (possibleArrays.length > 0) {
                console.log('[Dashboard] Found array in property')
                entries = possibleArrays[0] as any[]
              } else {
                // Check if any property contains a JSON string that's an array
                for (const [key, value] of Object.entries(decryptedEntry)) {
                  if (typeof value === 'string') {
                    try {
                      const parsed = JSON.parse(value)
                      if (Array.isArray(parsed)) {
                        console.log(`[Dashboard] Found JSON array in property "${key}"`)
                        entries = parsed
                        break
                      }
                    } catch (e) {
                      // Not JSON, continue
                    }
                  }
                }
                
                // If still no entries, treat as single entry
                if (entries.length === 0) {
                  console.log('[Dashboard] Treating as single entry')
                  entries = [decryptedEntry]
                }
              }
            }
            
            console.log('[Dashboard] Parsed entries:', entries)
            console.log('[Dashboard] Number of entries:', entries.length)
            
            // Add visibility flag to each entry
            // Handle both 'site' and 'siteName' fields (extension uses 'siteName')
            // Filter out system entries (VAULT_ROOT)
            const entriesWithVisibility = entries
              .filter((entry: any) => {
                const siteName = entry.siteName || entry.site || ''
                return siteName !== 'VAULT_ROOT' && siteName !== 'SYSTEM'
              })
              .map((entry: any, index: number) => {
                console.log(`[Dashboard] Processing entry ${index}:`, entry)
                return {
                  id: entry.id || Math.random().toString(36).substring(7),
                  site: entry.siteName || entry.site || 'Unknown',
                  username: entry.username || '',
                  password: entry.password || '',
                  // Preserve all extension fields for re-encryption
                  siteUrl: entry.siteUrl || entry.url || '',
                  siteName: entry.siteName || entry.site || 'Unknown',
                  notes: entry.notes || '',
                  createdAt: entry.createdAt || new Date().toISOString(),
                  updatedAt: entry.updatedAt || new Date().toISOString(),
                  lastUpdated: entry.updatedAt || entry.lastUpdated || new Date().toLocaleDateString(),
                  isPasswordVisible: false
                }
              })
            
            console.log('[Dashboard] Setting entries:', entriesWithVisibility)
            setDecryptedEntries(entriesWithVisibility)
            toast.success(`Loaded ${entriesWithVisibility.length} credential(s)`)
          } else {
            console.log('[Dashboard] No encrypted data found in response')
          }
        } else if (response.status === 404) {
          console.log('[Dashboard] No vault found for user (new user)')
        } else {
          const errorText = await response.text()
          console.error('[Dashboard] Response not OK:', response.status, errorText)
        }
      } catch (fetchErr) {
        console.error('[Dashboard] Fetch/decrypt error:', fetchErr)
        // Continue with empty vault - this is fine for new users
      }
      
      
      setIsUnlocked(true)
      toast.success("Vault unlocked successfully")
    } catch (err) {
      console.error("Unlock error:", err)
      toast.error("Failed to unlock vault")
    }
  }

  // Generate strong password
  const generatePassword = () => {
    const length = 16
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
    let password = ""
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length]
    }
    setNewEntry({...newEntry, password})
    toast.success("Strong password generated")
  }

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEntry.site || !newEntry.username || !newEntry.password) return

    setIsAddingEntry(true)
    try {
      console.log('[Dashboard] Adding new credential...')
      
      // Create the new entry
      const entryId = Math.random().toString(36).substring(7)
      const newCredential = {
        id: entryId,
        siteName: newEntry.site,
        siteUrl: newEntry.url || '',
        username: newEntry.username,
        password: newEntry.password,
        notes: newEntry.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Add to existing entries
      const updatedEntries = [...decryptedEntries.map(e => ({
        id: e.id,
        siteName: (e as any).siteName || e.site,
        siteUrl: (e as any).siteUrl || '',
        username: e.username,
        password: e.password,
        notes: (e as any).notes || '',
        createdAt: (e as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })), newCredential]
      
      console.log('[Dashboard] Encrypting', updatedEntries.length, 'credentials...')
      
      // Get the derived keys from the unlock process
      if (!derivedKeys) {
        toast.error("Encryption key not available. Please unlock vault first.")
        return
      }
      
      // Get salt
      const salt = localStorage.getItem("user_salt")
      if (!salt) {
        toast.error("Salt not found. Please re-login.")
        return
      }
      
      // IMPORTANT: Match the extension's format
      // The extension wraps the array in a VaultEntry object with VAULT_ROOT/SYSTEM
      const { encrypt } = await import("@password-manager/crypto-engine")
      
      // Wrap the credentials array in a VaultEntry object (matching extension format)
      const vaultEntry = {
        site: 'VAULT_ROOT',
        username: 'SYSTEM',
        password: JSON.stringify(updatedEntries)
      }
      
      // Encrypt using the crypto engine's encrypt function with the full DerivedKey
      const encryptedVault = await encrypt(vaultEntry, derivedKeys)
      
      console.log('[Dashboard] Saving to MongoDB...')
      
      // Extract site names for labels
      const labels = updatedEntries.map(e => e.siteName.toLowerCase())
      
      // Save to MongoDB
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || '')}`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("auth_token")}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          encryptedVault,
          labels
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`)
      }
      
      console.log('[Dashboard] Saved successfully!')
      
      // Update local state
      const displayEntry: DecryptedEntry = {
        id: entryId,
        site: newEntry.site,
        username: newEntry.username,
        password: newEntry.password,
        lastUpdated: new Date().toLocaleDateString(),
        isPasswordVisible: false
      }
      
      setDecryptedEntries([...decryptedEntries, displayEntry])
      setNewEntry({ site: "", username: "", password: "", url: "", notes: "", showPassword: false })
      toast.success("Credential saved and synced to vault!")
  } catch (err) {
    console.error('[Dashboard] Add entry error:', err)
    toast.error("Failed to save credential: " + (err instanceof Error ? err.message : "Unknown error"))
  } finally {
    setIsAddingEntry(false)
  }
}

// Edit entry
const handleEditEntry = (entry: DecryptedEntry) => {
  setEditingEntry(entry)
  setIsEditModalOpen(true)
}

const handleSaveEdit = async () => {
  if (!editingEntry) return

  setIsSavingEdit(true)
  try {
    console.log('[Dashboard] Updating credential...')
    
    // Update the entry in the list
    const updatedEntries = decryptedEntries.map(e => 
      e.id === editingEntry.id ? {
        ...editingEntry,
        lastUpdated: new Date().toLocaleDateString(),
        updatedAt: new Date().toISOString()
      } : e
    )
    
    // Get the derived keys
    if (!derivedKeys) {
      toast.error("Encryption key not available. Please unlock vault first.")
      return
    }
    
    // Get salt
    const salt = localStorage.getItem("user_salt")
    if (!salt) {
      toast.error("Salt not found. Please re-login.")
      return
    }
    
    // Prepare credentials for encryption
    const credentialsForEncryption = updatedEntries.map(e => ({
      id: e.id,
      siteName: (e as any).siteName || e.site,
      siteUrl: (e as any).siteUrl || '',
      username: e.username,
      password: e.password,
      notes: (e as any).notes || '',
      createdAt: (e as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    
    console.log('[Dashboard] Encrypting', credentialsForEncryption.length, 'credentials...')
    
    const { encrypt } = await import("@password-manager/crypto-engine")
    
    // Wrap in VaultEntry object
    const vaultEntry = {
      site: 'VAULT_ROOT',
      username: 'SYSTEM',
      password: JSON.stringify(credentialsForEncryption)
    }
    
    const encryptedVault = await encrypt(vaultEntry, derivedKeys)
    
    console.log('[Dashboard] Saving to MongoDB...')
    
    const labels = credentialsForEncryption.map(e => e.siteName.toLowerCase())
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || '')}`, {
      method: "PUT",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem("auth_token")}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        encryptedVault,
        labels
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to save: ${response.status}`)
    }
    
    console.log('[Dashboard] Updated successfully!')
    
    // Update local state
    setDecryptedEntries(updatedEntries)
    setIsEditModalOpen(false)
    setEditingEntry(null)
    toast.success("Credential updated successfully!")
  } catch (err) {
    console.error('[Dashboard] Edit entry error:', err)
    toast.error("Failed to update credential: " + (err instanceof Error ? err.message : "Unknown error"))
  } finally {
    setIsSavingEdit(false)
  }
}

// Delete entry
const handleDeleteEntry = async (entryId: string) => {
  if (!confirm("Are you sure you want to delete this credential? This action cannot be undone.")) {
    return
  }

  try {
    console.log('[Dashboard] Deleting credential...')
    
    // Remove from list
    const updatedEntries = decryptedEntries.filter(e => e.id !== entryId)
    
    // Get the derived keys
    if (!derivedKeys) {
      toast.error("Encryption key not available. Please unlock vault first.")
      return
    }
    
    // Get salt
    const salt = localStorage.getItem("user_salt")
    if (!salt) {
      toast.error("Salt not found. Please re-login.")
      return
    }
    
    // Prepare credentials for encryption
    const credentialsForEncryption = updatedEntries.map(e => ({
      id: e.id,
      siteName: (e as any).siteName || e.site,
      siteUrl: (e as any).siteUrl || '',
      username: e.username,
      password: e.password,
      notes: (e as any).notes || '',
      createdAt: (e as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    
    console.log('[Dashboard] Encrypting', credentialsForEncryption.length, 'credentials...')
    
    const { encrypt } = await import("@password-manager/crypto-engine")
    
    // Wrap in VaultEntry object
    const vaultEntry = {
      site: 'VAULT_ROOT',
      username: 'SYSTEM',
      password: JSON.stringify(credentialsForEncryption)
    }
    
    const encryptedVault = await encrypt(vaultEntry, derivedKeys)
    
    console.log('[Dashboard] Saving to MongoDB...')
    
    const labels = credentialsForEncryption.map(e => e.siteName.toLowerCase())
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || '')}`, {
      method: "PUT",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem("auth_token")}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        encryptedVault,
        labels
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to save: ${response.status}`)
    }
    
    console.log('[Dashboard] Deleted successfully!')
    
    // Update local state
    setDecryptedEntries(updatedEntries)
    toast.success("Credential deleted successfully!")
    } catch (err) {
      console.error('[Dashboard] Add entry error:', err)
      toast.error("Failed to save credential: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setIsAddingEntry(false)
    }
  }

  const togglePasswordVisibility = (id: string) => {
    setDecryptedEntries(entries => 
      entries.map(e => e.id === id ? { ...e, isPasswordVisible: !e.isPasswordVisible } : e)
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.info("Copied to clipboard")
  }

  // --- Render Login Screen (Authenticated but Locked) ---
  if (!session.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md border-2 border-slate-200 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-slate-100 p-3 rounded-full w-fit">
              <Shield className="h-10 w-10 text-slate-800" />
            </div>
            <CardTitle className="text-2xl font-bold">Secure Vault</CardTitle>
            <CardDescription>Authentication required to access your passwords</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
               <p className="text-sm text-slate-600 mb-4">You are not signed in. Please log in to your account.</p>
               <Button onClick={() => window.location.href = "/"} className="w-full">
                 Go to Login / Register
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Render OTP Verification State ---
  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
        <Card className="w-full max-w-md border-2 border-primary/20 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto bg-gradient-to-br from-primary/20 to-indigo-500/20 p-4 rounded-2xl w-fit mb-2">
              <ShieldCheck className="h-14 w-14 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              Verify Your Identity
            </CardTitle>
            <CardDescription className="text-base">
              Enter the 6-digit OTP sent to your registered email
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleVerifyOTP}>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="otp-input" className="text-sm font-semibold text-slate-700">
                  One-Time Password
                </Label>
                <div className="relative">
                  <Input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="text-center text-2xl font-bold tracking-[0.5em] h-14 border-2 border-slate-200 focus:border-primary transition-all"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtpCode(value)
                    }}
                    autoFocus
                    required
                    disabled={!otpSent || timeLeft === 0}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <p className="text-slate-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {timeLeft > 0 ? `Code expires in ${formatTime(timeLeft)}` : 'Code expired'}
                  </p>
                  <Button 
                    type="button" 
                    variant="link" 
                    size="sm" 
                    className="text-primary hover:text-primary/80 p-0 h-auto"
                    onClick={sendOTPToUser}
                    disabled={timeLeft > 540} // Disable if less than 1 minute has passed
                  >
                    Resend Code
                  </Button>
                </div>
              </div>

              {!otpSent && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800">
                    <strong>Sending OTP...</strong> Please wait while we send the verification code to your email.
                  </AlertDescription>
                </Alert>
              )}

              {otpSent && !process.env.NEXT_PUBLIC_SMTP_CONFIGURED && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    <strong>Development Mode:</strong> Check the backend console for your OTP code.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white font-semibold shadow-lg" 
                disabled={isVerifyingOtp || otpCode.length !== 6 || timeLeft === 0}
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Verifying OTP...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Verify & Unlock
                  </>
                )}
              </Button>
              
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                onClick={actions.logout} 
                className="text-slate-500 hover:text-red-500 hover:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout and clear session
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  // --- Render Unlocked Dashboard ---
  const filteredEntries = decryptedEntries.filter(e => 
    e.site.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 hidden md:block">ZeroKnowledge Vault</h1>
          <div className="flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium border border-green-200 ml-2">
            <Unlock className="h-3 w-3 mr-1" />
            Unlocked
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search vault..." 
              className="pl-9 h-9 w-64 bg-slate-50 border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={lockVault} className="text-slate-600">
            <Lock className="mr-2 h-4 w-4" />
            Lock
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { lockVault(); actions.logout(); }} className="text-red-500 hover:bg-red-50">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
        {/* Statistics & Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-primary text-white border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/80">Stored Credentials</CardDescription>
              <CardTitle className="text-3xl font-bold">{decryptedEntries.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-white/70">
                <Clock className="h-3 w-3 mr-1" />
                Updated just now
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>Security Status</CardDescription>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                AES-256-GCM
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-500">
              Keys are never stored in browser memory across sessions.
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>Inactivity Lock</CardDescription>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                5 Minutes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-500">
              Vault will auto-lock if no activity is detected.
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add New Credential Form */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-slate-200 sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5 text-primary" />
                  Add New Credential
                </CardTitle>
                <CardDescription>New entries are encrypted before syncing.</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddEntry}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site">Website/Service</Label>
                    <Input 
                      id="site" 
                      placeholder="e.g., GitHub, Gmail" 
                      value={newEntry.site}
                      onChange={(e) => setNewEntry({...newEntry, site: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input 
                      id="url" 
                      type="url"
                      placeholder="https://example.com" 
                      value={newEntry.url || ''}
                      onChange={(e) => setNewEntry({...newEntry, url: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">Username/Email</Label>
                    <Input 
                      id="username" 
                      placeholder="your@email.com" 
                      value={newEntry.username}
                      onChange={(e) => setNewEntry({...newEntry, username: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="new-password">Password</Label>
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${strength.color.replace('bg-', 'text-')}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="relative">
                      <Input 
                        id="new-password" 
                        type={newEntry.showPassword ? "text" : "password"}
                        placeholder="Enter password" 
                        value={newEntry.password}
                        onChange={(e) => setNewEntry({...newEntry, password: e.target.value})}
                        className="pr-20"
                        required
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary"
                          onClick={() => setNewEntry({...newEntry, showPassword: !newEntry.showPassword})}
                        >
                          {newEntry.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary"
                          onClick={generatePassword}
                          title="Generate strong password"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={strength.score} className={`h-1.5 ${strength.color}`} />
                      <p className="text-[10px] text-slate-400 italic">
                        Strength is calculated locally based on entropy rules.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <textarea
                      id="notes"
                      placeholder="Additional information"
                      rows={3}
                      value={newEntry.notes || ''}
                      onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isAddingEntry}>
                    {isAddingEntry ? "Encrypting..." : "Save Password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Vault Listing */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Stored Credentials</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.info("Syncing with backend...")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync
                </Button>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="text-center py-20 px-6 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
                <div className="bg-slate-50 p-4 rounded-full w-fit mx-auto mb-4">
                  <ShieldAlert className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">No credentials found</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">
                  {searchQuery ? "No entries match your search." : "Start by adding your first secure credential using the form."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredEntries.map((entry) => (
                  <Card key={entry.id} className="group hover:border-primary/50 transition-all duration-200">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600 font-bold uppercase text-xs w-10 h-10 flex items-center justify-center">
                          {entry.site[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{entry.site}</h4>
                          <p className="text-sm text-slate-500">{entry.username}</p>
                          {/* Password Strength Indicator */}
                          {(() => {
                            const strength = calculatePasswordStrength(entry.password)
                            return (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-20">
                                  <div 
                                    className={`h-full ${strength.color} transition-all duration-300`}
                                    style={{ width: `${strength.score}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-semibold ${
                                  strength.label === 'Strong' ? 'text-green-600' :
                                  strength.label === 'Moderate' ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {strength.label}
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 w-full sm:w-auto">
                        <div className="flex-1 sm:w-48 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                          <code className="text-sm font-mono text-slate-700">
                            {entry.isPasswordVisible ? entry.password : "••••••••••••"}
                          </code>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-slate-400 hover:text-primary"
                              onClick={() => togglePasswordVisibility(entry.id)}
                            >
                              {entry.isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-slate-400 hover:text-primary"
                              onClick={() => copyToClipboard(entry.password)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <div className="text-[10px] text-slate-400 flex flex-col items-end">
                             <span className="uppercase font-bold">Updated</span>
                             <span>{entry.lastUpdated}</span>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-9 w-9 text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                             onClick={() => handleEditEntry(entry)}
                             title="Edit credential"
                           >
                             <Edit className="h-5 w-5" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50"
                             onClick={() => handleDeleteEntry(entry.id)}
                             title="Delete credential"
                           >
                             <Trash2 className="h-5 w-5" />
                           </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            <Alert className="bg-blue-50 border-blue-100 text-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs">
                Metadata like <strong>Site Name</strong> and <strong>Username</strong> are also encrypted in the actual vault blob. The server only sees anonymous encrypted packets.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
      
      {/* Edit Modal */}
      {isEditModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-primary/20 shadow-2xl">
            <CardHeader className="border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Edit className="h-5 w-5 text-primary" />
                    Edit Credential
                  </CardTitle>
                  <CardDescription>Update your stored credential information</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingEntry(null)
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="edit-site">Website/Service</Label>
                <Input
                  id="edit-site"
                  placeholder="e.g., GitHub, Gmail"
                  value={editingEntry.site}
                  onChange={(e) => setEditingEntry({...editingEntry, site: e.target.value})}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  type="url"
                  placeholder="https://example.com"
                  value={(editingEntry as any).siteUrl || ''}
                  onChange={(e) => setEditingEntry({...editingEntry, siteUrl: e.target.value} as any)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username/Email</Label>
                <Input
                  id="edit-username"
                  placeholder="your@email.com"
                  value={editingEntry.username}
                  onChange={(e) => setEditingEntry({...editingEntry, username: e.target.value})}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="edit-password">Password</Label>
                  {(() => {
                    const strength = calculatePasswordStrength(editingEntry.password)
                    return (
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${strength.color.replace('bg-', 'text-')}`}>
                        {strength.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={editingEntry.isPasswordVisible ? "text" : "password"}
                    placeholder="Enter password"
                    value={editingEntry.password}
                    onChange={(e) => setEditingEntry({...editingEntry, password: e.target.value})}
                    className="pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-primary"
                    onClick={() => setEditingEntry({...editingEntry, isPasswordVisible: !editingEntry.isPasswordVisible})}
                  >
                    {editingEntry.isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="space-y-1">
                  {(() => {
                    const strength = calculatePasswordStrength(editingEntry.password)
                    return <Progress value={strength.score} className={`h-1.5 ${strength.color}`} />
                  })()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <textarea
                  id="edit-notes"
                  placeholder="Additional information"
                  rows={3}
                  value={(editingEntry as any).notes || ''}
                  onChange={(e) => setEditingEntry({...editingEntry, notes: e.target.value} as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-slate-200 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingEntry(null)
                }}
                className="flex-1"
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      
      <footer className="bg-white border-t border-slate-200 py-6 px-8 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 ZeroKnowledge Password Manager. Phase 1–3 Implementation.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
              End-to-end Encrypted
            </span>
            <span className="flex items-center">
              <Lock className="h-3 w-3 mr-1 text-indigo-500" />
              Argon2id KDF
            </span>
            <span className="flex items-center">
              <Unlock className="h-3 w-3 mr-1 text-amber-500" />
              AES-256-GCM
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

