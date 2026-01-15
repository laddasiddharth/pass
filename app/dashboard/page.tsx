"use client"

import type React from "react"

import { useState } from "react"
import { useVaultSync } from "@/hooks/useVaultSync"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function DashboardPage() {
  const [state, actions] = useVaultSync()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "register">("login")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === "register") {
        await actions.register(email, password)
      } else {
        await actions.login(email, password)
      }
    } catch (err) {
      console.error("Auth error:", err)
    }
  }

  if (!state.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{mode === "register" ? "Register" : "Login"}</CardTitle>
            <CardDescription>Zero-knowledge password manager with Phase 1 + Phase 2 integration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Master Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Strong master password"
                  required
                />
              </div>

              <Button type="submit" disabled={state.isLoading} className="w-full">
                {state.isLoading ? "Processing..." : mode === "register" ? "Register" : "Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode(mode === "register" ? "login" : "register")}
              >
                {mode === "register" ? "Already have an account?" : "Need an account?"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Vault Dashboard</h1>
        <p className="text-gray-600">User ID: {state.userId}</p>
        <p className="text-gray-600">
          Last Sync: {state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleString() : "Never"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Phase 1 (Crypto Engine)</span>
            <span className="text-green-600">✓ Ready</span>
          </div>
          <div className="flex justify-between">
            <span>Phase 2 (Backend Sync)</span>
            <span className="text-green-600">✓ Connected</span>
          </div>
          <div className="flex justify-between">
            <span>Authentication</span>
            <span className="text-green-600">✓ Verified</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={actions.logout} variant="destructive">
        Logout
      </Button>
    </div>
  )
}
