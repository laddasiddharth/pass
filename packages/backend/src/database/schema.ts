/**
 * Database schema and initialization for SQLite.
 * The server stores only opaque encrypted data and minimal metadata.
 * No plaintext passwords or keys are ever stored.
 */

import sqlite3 from "sqlite3"

export interface Database {
  run(sql: string, params?: any[]): Promise<any>
  get(sql: string, params?: any[]): Promise<any>
  all(sql: string, params?: any[]): Promise<any[]>
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

let dbInstance: sqlite3.Database | null = null

/**
 * SQLite wrapper for async operations
 */
function promisify(db: sqlite3.Database): Database {
  return {
    run(sql: string, params?: any[]) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err)
          else resolve({ lastID: this.lastID, changes: this.changes })
        })
      })
    },
    get(sql: string, params?: any[]) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
    },
    all(sql: string, params?: any[]) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        })
      })
    },
    exec(sql: string) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },
    close() {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }
}

export async function initializeDatabase(dbPath: string): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        reject(err)
        return
      }

      const dbWrapper = promisify(db)
      dbInstance = db

      try {
        // Enable foreign keys
        await dbWrapper.exec("PRAGMA foreign_keys = ON")

        // Users table: stores email, salt, and verifier only (no passwords)
        await dbWrapper.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL,
            verifier TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `)

        // Devices table: tracks which devices have access
        await dbWrapper.exec(`
          CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            deviceName TEXT NOT NULL,
            deviceFingerprint TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            lastSyncedAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_devices_userId ON devices(userId);
        `)

        // VaultBlobs table: stores encrypted vault data as opaque blobs
        await dbWrapper.exec(`
          CREATE TABLE IF NOT EXISTS vaultBlobs (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            deviceId TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            salt TEXT NOT NULL,
            iv TEXT NOT NULL,
            authTag TEXT NOT NULL,
            version INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            nonce TEXT NOT NULL UNIQUE,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_vaultBlobs_userId ON vaultBlobs(userId);
          CREATE INDEX IF NOT EXISTS idx_vaultBlobs_deviceId ON vaultBlobs(deviceId);
          CREATE INDEX IF NOT EXISTS idx_vaultBlobs_version ON vaultBlobs(version);
        `)

        // SyncMetadata table: tracks sync state per device
        await dbWrapper.exec(`
          CREATE TABLE IF NOT EXISTS syncMetadata (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            deviceId TEXT NOT NULL,
            lastUpdated INTEGER NOT NULL,
            vaultVersion INTEGER NOT NULL,
            nonce TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            UNIQUE(userId, deviceId),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_syncMetadata_userId ON syncMetadata(userId);
        `)

        // SessionTokens table: stores temporary authentication tokens
        await dbWrapper.exec(`
          CREATE TABLE IF NOT EXISTS sessionTokens (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expiresAt INTEGER NOT NULL,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_sessionTokens_token ON sessionTokens(token);
          CREATE INDEX IF NOT EXISTS idx_sessionTokens_expiresAt ON sessionTokens(expiresAt);
        `)

        console.log("[v0] Database initialized successfully")
        resolve(dbWrapper)
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function closeDatabase(db: Database): Promise<void> {
  await db.close()
}
