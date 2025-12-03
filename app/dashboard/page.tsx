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
  const { isAuthenticated, isInitialized } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()

  // Wait for auth to initialize before checking
  if (!isInitialized) {
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


