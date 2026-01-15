/**
 * Simple Backend Server for Password Manager
 * Stores encrypted vault blobs (blind synchronization)
 */

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = 3001

// Middleware
app.use(express.json({ limit: '10mb' }))

// CORS for extension
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// In-memory storage (for demo - use database in production)
const vaults = new Map()

// Data directory for persistence
const dataDir = join(__dirname, 'data')
const vaultsFile = join(dataDir, 'vaults.json')

// Load vaults from file
function loadVaults() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    if (fs.existsSync(vaultsFile)) {
      const data = fs.readFileSync(vaultsFile, 'utf8')
      const loaded = JSON.parse(data)
      Object.entries(loaded).forEach(([key, value]) => {
        vaults.set(key, value)
      })
      console.log(`Loaded ${vaults.size} vaults from disk`)
    }
  } catch (error) {
    console.error('Error loading vaults:', error)
  }
}

// Save vaults to file
function saveVaults() {
  try {
    const data = Object.fromEntries(vaults)
    fs.writeFileSync(vaultsFile, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving vaults:', error)
  }
}

// Load vaults on startup
loadVaults()

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', vaults: vaults.size })
})

// Get encrypted vault
app.get('/api/vault/:userId', (req, res) => {
  const { userId } = req.params
  
  console.log(`GET /api/vault/${userId}`)
  
  const vault = vaults.get(userId)
  
  if (!vault) {
    return res.status(404).json({ error: 'Vault not found' })
  }
  
  res.json(vault)
})

// Save encrypted vault
app.put('/api/vault/:userId', (req, res) => {
  const { userId } = req.params
  const encryptedVault = req.body
  
  console.log(`PUT /api/vault/${userId}`)
  console.log('Encrypted vault size:', JSON.stringify(encryptedVault).length, 'bytes')
  
  // Validate encrypted vault structure
  if (!encryptedVault.ciphertext || !encryptedVault.iv || !encryptedVault.salt) {
    return res.status(400).json({ error: 'Invalid vault structure' })
  }
  
  // Store encrypted vault (blind storage - cannot decrypt)
  vaults.set(userId, encryptedVault)
  
  // Save to disk
  saveVaults()
  
  res.json({ success: true })
})

// Delete vault (for testing)
app.delete('/api/vault/:userId', (req, res) => {
  const { userId } = req.params
  
  console.log(`DELETE /api/vault/${userId}`)
  
  vaults.delete(userId)
  saveVaults()
  
  res.json({ success: true })
})

// List all vaults (for debugging)
app.get('/api/vaults', (req, res) => {
  const vaultList = Array.from(vaults.keys()).map(userId => ({
    userId,
    size: JSON.stringify(vaults.get(userId)).length
  }))
  
  res.json({ vaults: vaultList })
})

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║  Password Manager Backend Server              ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log('')
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Vaults loaded: ${vaults.size}`)
  console.log('')
  console.log('Endpoints:')
  console.log(`  GET    /health`)
  console.log(`  GET    /api/vault/:userId`)
  console.log(`  PUT    /api/vault/:userId`)
  console.log(`  DELETE /api/vault/:userId`)
  console.log(`  GET    /api/vaults (debug)`)
  console.log('')
  console.log('🔒 Zero-knowledge: Server cannot decrypt vault data')
  console.log('')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n💾 Saving vaults...')
  saveVaults()
  console.log('👋 Server shutting down')
  process.exit(0)
})
