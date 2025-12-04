"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"
import Dashboard from "@/components/dashboard"
import AuthModal from "@/components/auth-modal"
import { useAuth } from "@/contexts/AuthContext"
import RequireAuth from "@/components/require-auth"

export default function DashboardRoute() {
  const { isAuthenticated, isInitialized, signin } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()
  const [isProcessingGoogleAuth, setIsProcessingGoogleAuth] = useState(false)

  // Handle Google OAuth callback from hash
  useEffect(() => {
    if (!isInitialized || isProcessingGoogleAuth) return

    const handleGoogleAuth = async () => {
      try {
        const hash = window.location.hash.substring(1)
        if (!hash) return

        const params = new URLSearchParams(hash)
        const token = params.get('token')
        const userStr = params.get('user')
        const isGoogleAuth = params.get('google_auth') === 'true'

        if (isGoogleAuth && token && userStr) {
          setIsProcessingGoogleAuth(true)
          
          try {
            const decodedUserStr = decodeURIComponent(userStr)
            const user = JSON.parse(decodedUserStr)
            
            if (user.id && user.email) {
              const normalizedUser = {
                id: user.id,
                email: user.email,
                firstName: user.firstName || user.first_name || '',
                lastName: user.lastName || user.last_name || '',
                avatarUrl: user.avatarUrl || user.avatar_url || undefined,
              }
              
              signin(normalizedUser, token)
              
              // Clear hash from URL
              window.history.replaceState({}, '', '/dashboard')
              
              // Small delay to ensure state updates
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          } catch (parseError) {
            console.error('Error parsing Google auth data:', parseError)
          } finally {
            setIsProcessingGoogleAuth(false)
          }
        }
      } catch (error) {
        console.error('Error processing Google auth:', error)
        setIsProcessingGoogleAuth(false)
      }
    }

    handleGoogleAuth()
  }, [isInitialized, isProcessingGoogleAuth, signin])

  // Wait for auth to initialize before checking
  if (!isInitialized || isProcessingGoogleAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const handleAuthenticated = () => {
    setShowAuthModal(false)
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-white">
        <Header
          onLoginClick={() => setShowAuthModal(true)}
          showBackButton={true}
          onBackClick={() => {
            router.push('/')
          }}
          isAuthenticated={isAuthenticated}
        />
        <Dashboard />
        <Footer />
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthenticated={handleAuthenticated} />
      </div>
    </RequireAuth>
  )
}


