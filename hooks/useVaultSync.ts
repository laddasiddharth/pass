"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { apiClient, type VaultEntry, type SyncPayload } from "@/lib/api-client"
import { v4 as uuidv4 } from "uuid"
import { deriveKey } from "@password-manager/crypto-engine"

export interface UseVaultSyncState {
  userId: string | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastSyncTime: number | null
  version: number
  vaults: VaultEntry[]
  salt: string | null
}

export interface UseVaultSyncActions {
  register: (email: string, masterPassword: string) => Promise<void>
  login: (email: string, masterPassword: string) => Promise<void>
  logout: () => void
  encryptAndSync: (entries: VaultEntry[]) => Promise<void>
  pullAndDecrypt: () => Promise<VaultEntry[]>
}

export function useVaultSync(): [UseVaultSyncState, UseVaultSyncActions] {
  const [state, setState] = useState<UseVaultSyncState>({
    userId: null,
    email: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    lastSyncTime: null,
    version: 0,
    vaults: [],
    salt: null,
  })

  const deviceIdRef = useRef<string>("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("device_id")
      if (stored) {
        deviceIdRef.current = stored
      } else {
        const newId = uuidv4()
        localStorage.setItem("device_id", newId)
        deviceIdRef.current = newId
      }
      
      // Restore authentication state from localStorage
      const storedSalt = localStorage.getItem("user_salt")
      const storedUserId = localStorage.getItem("user_id")
      const storedEmail = localStorage.getItem("user_email")
      const storedToken = localStorage.getItem("auth_token")
      
      if (storedSalt && storedUserId && storedToken && storedEmail) {
        // Restore session token to API client
        apiClient.setToken(storedToken)
        
        setState(prev => ({ 
          ...prev, 
          salt: storedSalt,
          userId: storedUserId,
          email: storedEmail,
          isAuthenticated: true
        }))
      }
    }
  }, [])

  const register = useCallback(async (email: string, masterPassword: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      // Generate random salt on client (16 bytes = 128 bits)
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
      const salt = Array.from(saltBuffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // Derive keys using Argon2id
      const { authKey } = await deriveKey(masterPassword, saltBuffer)

      // Create proof by computing HMAC of a known string
      const encoder = new TextEncoder()
      const proofData = encoder.encode("auth-proof")
      const proof = await crypto.subtle.sign("HMAC", authKey, proofData)
      const proofHex = Array.from(new Uint8Array(proof))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // Register with server
      const response = await apiClient.register(email, proofHex, salt)

      apiClient.setToken(response.sessionToken)
      localStorage.setItem("user_salt", salt)
      localStorage.setItem("user_id", response.userId)
      localStorage.setItem("user_email", email)
      setState((prev) => ({
        ...prev,
        userId: response.userId,
        email: email,
        isAuthenticated: true,
        isLoading: false,
        salt: salt,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [])

  const login = useCallback(async (email: string, masterPassword: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      // 1. Get salt from server
      const { salt } = await apiClient.getSalt(email)
      
      // Convert salt hex to buffer
      const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

      // 2. Derive keys using Argon2id (same as during registration)
      const { authKey } = await deriveKey(masterPassword, saltBuffer)

      // 3. Re-compute verifier (proof of knowledge of password)
      const encoder = new TextEncoder()
      const proofData = encoder.encode("auth-proof")
      const verifierBuffer = await crypto.subtle.sign("HMAC", authKey, proofData)
      const verifier = Array.from(new Uint8Array(verifierBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // 4. Generate random challenge
      const challengeBuffer = crypto.getRandomValues(new Uint8Array(16))
      const challenge = Array.from(challengeBuffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // 5. Compute client proof = SHA-256(verifier + challenge)
      // This proves we have the verifier without sending it over the wire
      const combined = new TextEncoder().encode(verifier + challenge)
      const clientProofBuffer = await crypto.subtle.digest("SHA-256", combined)
      const clientProof = Array.from(new Uint8Array(clientProofBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // 6. Send login request
      const response = await apiClient.login(email, challenge, clientProof)

      apiClient.setToken(response.sessionToken)
      localStorage.setItem("user_salt", salt)
      localStorage.setItem("user_id", response.userId)
      localStorage.setItem("user_email", email)
      setState((prev) => ({
        ...prev,
        userId: response.userId,
        email: email,
        isAuthenticated: true,
        isLoading: false,
        salt: salt,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    apiClient.clearToken()
    localStorage.removeItem("user_salt")
    localStorage.removeItem("user_id")
    localStorage.removeItem("user_email")
    setState({
      userId: null,
      email: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastSyncTime: null,
      version: 0,
      vaults: [],
      salt: null,
    })
  }, [])

  const encryptAndSync = useCallback(
    async (entries: VaultEntry[]) => {
      if (!state.isAuthenticated) throw new Error("Not authenticated")

      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        // This is a placeholder - actual encryption happens in the component
        // using the crypto-engine directly with the master password
        const payload: SyncPayload = {
          ciphertext: "", // Set by caller after encryption
          iv: "",
          salt: "",
          tag: "",
          deviceId: deviceIdRef.current,
          version: state.version + 1,
        }

        const response = await apiClient.pushVault(payload)

        setState((prev) => ({
          ...prev,
          lastSyncTime: Date.now(),
          version: response.version,
          isLoading: false,
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed"
        setState((prev) => ({ ...prev, error: message, isLoading: false }))
        throw err
      }
    },
    [state.isAuthenticated, state.version],
  )

  const pullAndDecrypt = useCallback(async (): Promise<VaultEntry[]> => {
    if (!state.isAuthenticated) throw new Error("Not authenticated")

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await apiClient.pullVault(deviceIdRef.current, state.version)

      // Placeholder: actual decryption happens in component with master password
      // and crypto-engine decryptVault function

      setState((prev) => ({
        ...prev,
        lastSyncTime: Date.now(),
        version: response.version,
        isLoading: false,
      }))

      return []
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pull failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [state.isAuthenticated, state.version])

  return [
    state,
    {
      register,
      login,
      logout,
      encryptAndSync,
      pullAndDecrypt,
    },
  ]
}
