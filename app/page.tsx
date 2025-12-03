"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import ShaderBackground from "@/components/shader-background"
import PulsingCircle from "@/components/pulsing-circle"
import AuthModal from "@/components/auth-modal"
import HeroContent from "@/components/hero-content"
import FeaturesSection from "@/components/features-section"
import HowItWorksSection from "@/components/how-it-works-section"
import PricingSection from "@/components/pricing-section"
import Footer from "@/components/footer"
import { useAuth } from "@/contexts/AuthContext"
import { loadStripe } from "@stripe/stripe-js"

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

function handleGetStarted(planName: string) {
  // Navigate to checkout page to collect details before starting Stripe flow
  window.location.assign(`/checkout?plan=${encodeURIComponent(planName)}`)
}

export default function TurboAlanRefiner() {
  const { isAuthenticated, isInitialized } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()

  const handleAuthenticated = () => {
    setShowAuthModal(false)
    router.push('/dashboard')
  }

  // Check for OAuth errors in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      if (error) {
        setShowAuthModal(true)
        // Clear error from URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  // Show loading while auth initializes
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

  return (
    <div className="min-h-screen bg-white">
      <div className="relative">
        <ShaderBackground>
          <Header
            onLoginClick={() => setShowAuthModal(true)}
            showBackButton={false}
            isAuthenticated={isAuthenticated}
          />
          <HeroContent onGetStarted={() => setShowAuthModal(true)} />
          <PulsingCircle />
        </ShaderBackground>
      </div>

      <div className="bg-white">
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection
          onGetStarted={handleGetStarted}
        />
        <Footer />
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthenticated={handleAuthenticated} />
    </div>
  )
}
