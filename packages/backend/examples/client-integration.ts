/**
 * Example: How a client integrates with the blind sync backend.
 * This shows the full flow from password to sync.
 */

// Import from crypto-engine package
import { deriveMasterKey, encryptVault, decryptVault, type VaultData } from "@password-manager/crypto-engine"

/**
 * Client class for interacting with the blind sync backend
 */
class PasswordManagerClient {
  private apiUrl: string
  private sessionToken: string | null = null
  private userId: string | null = null
  private deviceId: string
  private masterKey: CryptoKey | null = null

  constructor(apiUrl = "http://localhost:3001") {
    this.apiUrl = apiUrl
    this.deviceId = this.generateDeviceId()
  }

  /**
   * Register a new account
   */
  async register(email: string, masterPassword: string): Promise<{ userId: string; salt: string }> {
    // Step 1: Generate random salt
    const saltBytes = crypto.getRandomValues(new Uint8Array(16))
    const salt = Buffer.from(saltBytes).toString("base64")

    // Step 2: Derive Argon2id key
    const { key, _salt } = await deriveMasterKey(masterPassword, salt)
    this.masterKey = key

    // Step 3: Compute verifier (HMAC of key)
    const verifier = await this.computeVerifier(key, "register")

    // Step 4: Send to server
    const response = await fetch(`${this.apiUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        salt,
        verifier,
      }),
    })

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`)
    }

    const { userId } = await response.json()
    this.userId = userId

    console.log("[Client] Registration successful, userId:", userId)
    return { userId, salt }
  }

  /**
   * Login to existing account
   */
  async login(email: string, masterPassword: string): Promise<{ userId: string; sessionToken: string }> {
    // Step 1: Request salt from server (first call, no auth)
    const userResponse = await fetch(`${this.apiUrl}/auth/login-prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (!userResponse.ok) {
      throw new Error(`Login preparation failed`)
    }

    const { salt } = await userResponse.json()

    // Step 2: Derive key with salt from server
    const { key } = await deriveMasterKey(masterPassword, salt)
    this.masterKey = key

    // Step 3: Create challenge-response
    const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")
    const clientProof = await this.computeVerifier(key, challenge)

    // Step 4: Send challenge and proof
    const loginResponse = await fetch(`${this.apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        challenge,
        clientProof,
      }),
    })

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`)
    }

    const { userId, sessionToken, serverProof } = await loginResponse.json()

    // Step 5: Verify server knows the verifier
    const expectedProof = await this.computeVerifier(key, challenge)
    if (serverProof !== expectedProof) {
      throw new Error("Server proof verification failed - MITM attack detected?")
    }

    this.userId = userId
    this.sessionToken = sessionToken

    console.log("[Client] Login successful, userId:", userId)
    return { userId, sessionToken }
  }

  /**
   * Push encrypted vault to server
   */
  async pushVault(vaultData: VaultData): Promise<string> {
    if (!this.sessionToken || !this.userId || !this.masterKey) {
      throw new Error("Not authenticated. Call login() first.")
    }

    // Step 1: Encrypt vault with derived key
    const encrypted = await encryptVault(this.masterKey, vaultData)

    // Step 2: Generate unique nonce for replay prevention
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")

    // Step 3: Send to server
    const response = await fetch(`${this.apiUrl}/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify({
        userId: this.userId,
        deviceId: this.deviceId,
        vault: {
          ...encrypted,
          nonce,
          version: 1,
          timestamp: Date.now(),
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`)
    }

    const { vaultId } = await response.json()
    console.log("[Client] Vault pushed, vaultId:", vaultId)
    return vaultId
  }

  /**
   * Pull encrypted vaults from server
   */
  async pullVaults(lastVersion?: number): Promise<VaultData[]> {
    if (!this.sessionToken || !this.userId || !this.masterKey) {
      throw new Error("Not authenticated. Call login() first.")
    }

    // Step 1: Request vaults from server
    const response = await fetch(`${this.apiUrl}/sync/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify({
        userId: this.userId,
        deviceId: this.deviceId,
        lastVersion,
      }),
    })

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`)
    }

    const { vaults, currentVersion } = await response.json()
    console.log(`[Client] Pulled ${vaults.length} vaults, current version:`, currentVersion)

    // Step 2: Decrypt vaults with master key
    const decryptedVaults: VaultData[] = []

    for (const vault of vaults) {
      try {
        const decrypted = await decryptVault(this.masterKey, {
          ciphertext: vault.ciphertext,
          salt: vault.salt,
          iv: vault.iv,
          authTag: vault.authTag,
        })

        decryptedVaults.push(decrypted)
      } catch (error) {
        console.error("[Client] Decryption failed for vault:", vault.id, error)
        // Continue with next vault
      }
    }

    return decryptedVaults
  }

  /**
   * Helper: Compute HMAC verifier
   */
  private async computeVerifier(key: CryptoKey, data: string): Promise<string> {
    const hmac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
    return Buffer.from(hmac).toString("hex")
  }

  /**
   * Helper: Generate unique device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem("pm-device-id")
    if (stored) return stored

    const deviceId = crypto.randomUUID()
    localStorage.setItem("pm-device-id", deviceId)
    return deviceId
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.sessionToken = null
    this.userId = null
    this.masterKey = null
    console.log("[Client] Logged out")
  }
}

// Example usage
async function example() {
  const client = new PasswordManagerClient("http://localhost:3001")

  try {
    // Register
    await client.register("user@example.com", "my-master-password")

    // Login
    await client.login("user@example.com", "my-master-password")

    // Encrypt and push vault
    const vault: VaultData = {
      site: "github.com",
      username: "user@example.com",
      password: "github-token-123",
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
      },
    }

    await client.pushVault(vault)

    // Pull and decrypt vaults
    const vaults = await client.pullVaults()
    console.log("Decrypted vaults:", vaults)

    // Logout
    client.logout()
  } catch (error) {
    console.error("Error:", error)
  }
}

export { PasswordManagerClient }
