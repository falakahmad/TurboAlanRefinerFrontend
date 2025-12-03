"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SignupModal from "./signup-modal"
import { useAuth } from "@/contexts/AuthContext"
import { useLoading } from "@/contexts/LoadingContext"
// MongoDB is handled via API routes, no direct client import needed
import { useToast } from "@/hooks/use-toast"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthenticated: () => void
}

export default function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const { signin } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    openaiApiKey: "",
    openaiModel: "gpt-4.1",
    targetScannerRisk: 15,
    minWordRatio: 0.8,
  })
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [signinData, setSigninData] = useState({
    email: "",
    password: ""
  })
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'password'>('email')
  const [otpCode, setOtpCode] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // Check for OAuth errors in URL when modal opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlError = params.get('error')
      if (urlError) {
        setError(decodeURIComponent(urlError))
        // Clear error from URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleGoogleAuth = () => {
    setError("")
    
    // Check if Google OAuth is configured
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      setError("Google OAuth is not configured. Please contact support.")
      return
    }
    
    setIsLoading(true)
    startLoading("Connecting to Google...")
    
    // Redirect to Google OAuth (server will handle state generation and OAuth flow)
    window.location.href = '/api/auth/google'
  }

  const handleSignin = async () => {
    setError("")
    if (!signinData.email || !signinData.password) {
      setError("Email and password are required")
      return
    }

    setIsLoading(true)
    startLoading("Signing in...")
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "signin",
          email: signinData.email,
          password: signinData.password
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Sign in failed")
      }

      // Use AuthContext to properly set authentication state
      if (data.user && data.token) {
        signin(data.user, data.token)
        
        // Also set cookie for middleware (with actual token)
        try {
          const expires = new Date(Date.now() + 7*24*60*60*1000).toUTCString()
          document.cookie = `refiner_auth=${data.token}; Path=/; Expires=${expires}; SameSite=Lax`
        } catch {}

        // Save settings separately for compatibility
        if (data.user.settings) {
          localStorage.setItem("turbo-alan-settings", JSON.stringify(data.user.settings))
        }
      }

      stopLoading()
      toast({
        title: "Welcome back!",
        description: `Signed in as ${signinData.email}`,
      })
      onAuthenticated()
    } catch (err) {
      stopLoading()
      const errorMsg = err instanceof Error ? err.message : "Sign in failed. Please try again."
      setError(errorMsg)
      toast({
        title: "Sign in failed",
        description: errorMsg,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSettingsSave = () => {
    // Save settings to localStorage or backend
    localStorage.setItem("turbo-alan-settings", JSON.stringify(settings))
    try {
      const expires = new Date(Date.now() + 7*24*60*60*1000).toUTCString()
      document.cookie = `refiner_auth=1; Path=/; Expires=${expires}; SameSite=Lax`
    } catch {}
    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully",
    })
    onAuthenticated()
  }

  const handleSignupSuccess = () => {
    setShowSignupModal(false)
    onAuthenticated()
  }

  const handleSwitchToSignup = () => {
    setShowSignupModal(true)
  }

  const handleForgotPassword = async () =>{
    setError("")
    if (!resetEmail) {
      setError("Please enter your email")
      return
    }

    setIsLoading(true)
    try {
      console.log('Sending password reset request to:', 'http://localhost:8000/auth/request-password-reset')
      console.log('Email:', resetEmail)
      
      // Call backend to request OTP
      const response = await fetch('http://localhost:8000/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send OTP')
      }

      setResetStep('otp')
      setError('')
    } catch (err) {
      console.error('Password reset error:', err)
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please check the console for details.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    setError("")
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: otpCode })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid OTP')
      }

      setTempToken(data.temp_token)
      setResetStep('password')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError("")
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match")
      return
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetEmail, 
          token: tempToken,
          new_password: newPassword 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password')
      }

      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 bg-white border-gray-200 shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <CardTitle className="text-gray-900">
            {showForgotPassword ? "Reset Password" : "Welcome to Turbo Alan Refiner"}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {showForgotPassword 
              ? resetStep === 'email' 
                ? "Enter your email to receive a verification code"
                : resetStep === 'otp'
                ? "Enter the 6-digit code sent to your email"
                : "Create a new password for your account"
              : "Configure your settings to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showForgotPassword ? (
            <div className="space-y-4">
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="text-green-600 bg-green-50 p-4 rounded-md">
                    Password reset successfully! You can now sign in with your new password.
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setResetSent(false)
                      setResetStep('email')
                      setOtpCode('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                    }}
                    className="text-gray-600"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {error}
                    </div>
                  )}
                  
                  {resetStep === 'email' && (
                    <>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                      <Button
                        onClick={handleForgotPassword}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                      >
                        {isLoading ? "Sending..." : "Send OTP Code"}
                      </Button>
                    </>
                  )}

                  {resetStep === 'otp' && (
                    <>
                      <div className="text-sm text-gray-600 text-center">
                        We've sent a 6-digit code to <strong>{resetEmail}</strong>
                      </div>
                      <Input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-center text-2xl tracking-widest"
                        maxLength={6}
                      />
                      <Button
                        onClick={handleVerifyOTP}
                        disabled={isLoading || otpCode.length !== 6}
                        className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                      >
                        {isLoading ? "Verifying..." : "Verify Code"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setResetStep('email')
                          setOtpCode('')
                          setError('')
                        }}
                        className="w-full text-gray-600 hover:text-gray-900 text-sm"
                      >
                        Resend Code
                      </Button>
                    </>
                  )}

                  {resetStep === 'password' && (
                    <>
                      <div className="text-sm text-gray-600 text-center">
                        Enter your new password
                      </div>
                      <Input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                      <Input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                      />
                      <Button
                        onClick={handleResetPassword}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                      >
                        {isLoading ? "Resetting..." : "Reset Password"}
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setResetStep('email')
                      setOtpCode('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                      setError('')
                    }}
                    className="w-full text-gray-600 hover:text-gray-900"
                  >
                    Back to Sign In
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Tabs defaultValue="auth" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100">
              <TabsTrigger
                value="auth"
                className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Authentication
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auth" className="space-y-4">
              <Button
                onClick={handleGoogleAuth}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 border-0"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                </div>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={signinData.email}
                  onChange={(e) => setSigninData({ ...signinData, email: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={signinData.password}
                  onChange={(e) => setSigninData({ ...signinData, password: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <Button 
                  onClick={handleSignin} 
                  disabled={isLoading}
                  className="w-full bg-gray-900 text-white hover:bg-gray-800"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </div>

              <div className="text-right">
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-yellow-600 hover:text-yellow-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <button
                    onClick={handleSwitchToSignup}
                    className="text-yellow-600 hover:text-yellow-700 font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-gray-700">
                  OpenAI API Key (Optional)
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-... (leave empty if not using AI features)"
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <p className="text-xs text-gray-500">
                  Optional: Add your OpenAI API key to enable AI-powered text refinement. Get your key from{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">
                    OpenAI Platform
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model" className="text-gray-700">
                  OpenAI Model
                </Label>
                <select
                  id="model"
                  value={settings.openaiModel}
                  onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 text-gray-900"
                >
                  <option value="gpt-4.1">GPT 4.1</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scannerRisk" className="text-gray-700">
                  Target Scanner Risk (%)
                </Label>
                <Input
                  id="scannerRisk"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.targetScannerRisk}
                  onChange={(e) => setSettings({ ...settings, targetScannerRisk: Number.parseInt(e.target.value) })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wordRatio" className="text-gray-700">
                  Min Word Ratio
                </Label>
                <Input
                  id="wordRatio"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.minWordRatio}
                  onChange={(e) => setSettings({ ...settings, minWordRatio: Number.parseFloat(e.target.value) })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <Button
                onClick={handleSettingsSave}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
              >
                Save Settings & Continue
              </Button>
            </TabsContent>
          </Tabs>
          )}

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full mt-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>

      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSignupSuccess={handleSignupSuccess}
        onSwitchToSignin={() => setShowSignupModal(false)}
      />
    </div>
  )
}
