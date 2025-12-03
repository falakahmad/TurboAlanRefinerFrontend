"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
// MongoDB is handled via API routes, no direct client import needed
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import ShaderBackground from "@/components/shader-background"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async () => {
    setError("")
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      // Get token from URL or localStorage
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token') || localStorage.getItem('reset_token')
      const email = urlParams.get('email') || localStorage.getItem('reset_email')
      
      if (!token || !email) {
        throw new Error("Reset token or email missing. Please request a new password reset.")
      }

      // Call backend API to reset password
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          new_password: password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Failed to reset password")
      }

      setSuccess(true)
      // Clear reset token from localStorage
      localStorage.removeItem('reset_token')
      localStorage.removeItem('reset_email')
      setTimeout(() => {
        router.push("/")
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <ShaderBackground>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md bg-white border-gray-200 shadow-2xl">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <CardTitle className="text-gray-900">Reset Password</CardTitle>
              <CardDescription className="text-gray-600">Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="text-center space-y-4">
                  <div className="text-green-600 bg-green-50 p-4 rounded-md">
                    Password updated successfully! Redirecting to login...
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="New Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                    />
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                  >
                    {isLoading ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ShaderBackground>
    </div>
  )
}
