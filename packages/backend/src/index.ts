/**
 * Blind synchronization backend for zero-knowledge password manager.
 *
 * This server implements Phase 2 of the password manager architecture.
 * It stores encrypted vault blobs and authenticates users without ever
 * handling plaintext passwords or decrypted vault contents.
 */

import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { initializeDatabase, closeDatabase } from "./database/schema.js"
import { createAuthRouter } from "./routes/authRoutes.js"
import { createSyncRouter } from "./routes/syncRoutes.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/vault.db")

async function start() {
  try {
    console.log("[v0] Starting blind synchronization backend...")

    // Initialize database
    const db = await initializeDatabase(DB_PATH)
    console.log(`[v0] Database initialized at ${DB_PATH}`)

    // Create Express app
    const app = express()

    // CORS for dashboard and extension
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      
      if (req.method === "OPTIONS") {
        return res.sendStatus(200)
      }
      next()
    })

    // Middleware
    app.use(express.json())

    // Request logging (non-sensitive)
    app.use((req, res, next) => {
      console.log(`[v0] ${req.method} ${req.path}`)
      next()
    })

    // Routes
    app.use("/auth", createAuthRouter(db))
    app.use("/sync", createSyncRouter(db))

    // Phase 3 compatibility routes for extension
    // Simple vault storage (blind synchronize)
    const vaults = new Map<string, any>()
    
    app.get("/api/vault/:userId", (req, res) => {
      const { userId } = req.params
      console.log(`[v0] Extension GET /api/vault/${userId}`)
      const vault = vaults.get(userId)
      if (!vault) return res.status(404).json({ error: "Vault not found" })
      res.json(vault)
    })

    app.put("/api/vault/:userId", (req, res) => {
      const { userId } = req.params
      console.log(`[v0] Extension PUT /api/vault/${userId}`)
      vaults.set(userId, req.body)
      res.json({ success: true })
    })

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        apiStyles: ["phase2", "phase3"],
        activeVaults: vaults.size
      })
    })

    // 404 handler
    app.use((req, res) => {
      console.warn(`[v0] 404 Not Found: ${req.method} ${req.path}`)
      res.status(404).json({
        error: "Not found",
        code: "NOT_FOUND",
        message: `Endpoint ${req.path} not found`,
      })
    })

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("[v0] Server error:", err)
      res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      })
    })

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`[v0] Blind sync backend listening on port ${PORT}`)
      console.log(`[v0] Health check: GET http://localhost:${PORT}/health`)
    })

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[v0] Shutting down gracefully...")
      server.close(async () => {
        await closeDatabase(db)
        console.log("[v0] Database closed, exiting")
        process.exit(0)
      })
    }

    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  } catch (error) {
    console.error("[v0] Failed to start server:", error)
    process.exit(1)
  }
}

start()
