"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { useLoading } from "@/contexts/LoadingContext"
import { useToast } from "@/hooks/use-toast"

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
  onSignupSuccess: () => void
  onSwitchToSignin: () => void
}

interface SignupFormData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  openaiApiKey: string
  openaiModel: string
  targetScannerRisk: number
  minWordRatio: number
}

export default function SignupModal({ isOpen, onClose, onSignupSuccess, onSwitchToSignin }: SignupModalProps) {
  const { signin } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  const { toast } = useToast()
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    openaiApiKey: "",
    openaiModel: "gpt-4.1",
    targetScannerRisk: 15,
    minWordRatio: 0.8,
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"account" | "settings">("account")

  if (!isOpen) return null

  const validateAccountStep = () => {
    if (!formData.firstName.trim()) {
      setError("First name is required")
      return false
    }
    if (!formData.lastName.trim()) {
      setError("Last name is required")
      return false
    }
    if (!formData.email.trim()) {
      setError("Email is required")
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address")
      return false
    }
    if (!formData.password) {
      setError("Password is required")
      return false
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return false
    }
    return true
  }

  const validateSettingsStep = () => {
    // OpenAI API key is now optional during signup
    // Users can add it later in settings if they want to use AI features
    return true
  }

  const handleNext = () => {
    setError("")
    if (step === "account" && validateAccountStep()) {
      setStep("settings")
    }
  }

  const handleBack = () => {
    setStep("account")
    setError("")
  }

  const handleSignup = async () => {
    setError("")
    if (!validateSettingsStep()) return

    setIsLoading(true)
    startLoading("Creating account...")
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "signup",
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          settings: {
            openaiApiKey: formData.openaiApiKey || "", // Allow empty API key
            openaiModel: formData.openaiModel,
            targetScannerRisk: formData.targetScannerRisk,
            minWordRatio: formData.minWordRatio,
          }
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
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
        title: "Account created!",
        description: `Welcome, ${formData.firstName}! Your account has been created successfully.`,
      })
      onSignupSuccess()
    } catch (err) {
      stopLoading()
      const errorMsg = err instanceof Error ? err.message : "Signup failed. Please try again."
      setError(errorMsg)
      toast({
        title: "Signup failed",
        description: errorMsg,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = () => {
    setError("")
    
    // Check if Google OAuth is configured
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      setError("Google OAuth is not configured. Please contact support.")
      toast({
        title: "Google OAuth unavailable",
        description: "Google OAuth is not configured. Please contact support.",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)
    startLoading("Connecting to Google...")
    
    // Redirect to Google OAuth (server will handle state generation and OAuth flow)
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 bg-white border-gray-200 shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <CardTitle className="text-gray-900">
            {step === "account" ? "Create Your Account" : "Configure Settings"}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {step === "account" 
              ? "Join Turbo Alan Refiner to get started" 
              : "Configure your preferences (optional - you can skip and add later)"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {step === "account" ? (
            <div className="space-y-4">
              <Button
                onClick={handleGoogleSignup}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                Sign up with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or sign up with email</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-gray-700">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-gray-700">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <Button 
                onClick={handleNext}
                className="w-full bg-gray-900 text-white hover:bg-gray-800"
              >
                Next: Configure Settings
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-gray-700">
                  OpenAI API Key (Optional)
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-... (leave empty to add later)"
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <p className="text-xs text-gray-500">
                  Optional: Add your OpenAI API key now or later in settings. Get your key from{" "}
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
                  value={formData.openaiModel}
                  onChange={(e) => setFormData({ ...formData, openaiModel: e.target.value })}
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
                  value={formData.targetScannerRisk}
                  onChange={(e) => setFormData({ ...formData, targetScannerRisk: Number.parseInt(e.target.value) || 15 })}
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
                  value={formData.minWordRatio}
                  onChange={(e) => setFormData({ ...formData, minWordRatio: Number.parseFloat(e.target.value) || 0.8 })}
                  className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSignup}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600"
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  You can always add your OpenAI API key later in settings
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button
                onClick={onSwitchToSignin}
                className="text-yellow-600 hover:text-yellow-700 font-medium hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full mt-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
