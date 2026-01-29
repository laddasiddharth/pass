import mongoose, { Schema, Document } from "mongoose"

// User Schema
export interface IUser extends Document {
  email: string
  salt: string
  verifier: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  salt: { type: String, required: true },
  verifier: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Session Status Schema
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  createdAt: Date
}

const SessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

// Vault Blob Schema
export interface IVaultBlob extends Document {
  userId: mongoose.Types.ObjectId
  deviceId: string
  ciphertext: string
  salt: string
  iv: string
  authTag: string
  version: number
  timestamp: number
  nonce: string
  createdAt: Date
  updatedAt: Date
}

const VaultBlobSchema = new Schema<IVaultBlob>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: { type: String, required: true },
  ciphertext: { type: String, required: true },
  salt: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  version: { type: Number, required: true },
  timestamp: { type: Number, required: true },
  nonce: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Sync Metadata Schema
export interface ISyncMetadata extends Document {
  userId: mongoose.Types.ObjectId
  deviceId: string
  lastUpdated: number
  vaultVersion: number
  nonce: string
  createdAt: Date
  updatedAt: Date
}

const SyncMetadataSchema = new Schema<ISyncMetadata>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: { type: String, required: true },
  lastUpdated: { type: Number, required: true },
  vaultVersion: { type: Number, required: true },
  nonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})
// Compound index for uniqueness
SyncMetadataSchema.index({ userId: 1, deviceId: 1 }, { unique: true })

// Simple Vault Schema (Phase 3 Extension Compatibility)
export interface ISimpleVault extends Document {
  userId: string
  data: any
  labels: string[]
  updatedAt: Date
}

const SimpleVaultSchema = new Schema<ISimpleVault>({
  userId: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  labels: { type: [String], default: [] }, // NEW: Plaintext labels for identification
  updatedAt: { type: Date, default: Date.now },
})

// OTP Schema for email verification
export interface IOTP extends Document {
  email: string
  code: string
  expiresAt: Date
  verified: boolean
  createdAt: Date
}

const OTPSchema = new Schema<IOTP>({
  email: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})

// Index for automatic deletion of expired OTPs
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const User = mongoose.model<IUser>("User", UserSchema)
export const Session = mongoose.model<ISession>("Session", SessionSchema)
export const VaultBlob = mongoose.model<IVaultBlob>("VaultBlob", VaultBlobSchema)
export const SyncMetadata = mongoose.model<ISyncMetadata>("SyncMetadata", SyncMetadataSchema)
export const SimpleVault = mongoose.model<ISimpleVault>("SimpleVault", SimpleVaultSchema)
export const OTP = mongoose.model<IOTP>("OTP", OTPSchema)
