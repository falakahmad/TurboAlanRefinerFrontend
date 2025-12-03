"use client"

import Header from "@/components/header"
import Footer from "@/components/footer"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const auth = (() => { try { return useAuth() } catch { return null } })()
  const isAuthenticated = !!(auth && auth.isAuthenticated)

  return (
    <div className="min-h-screen bg-background">
      <Header
        onLoginClick={() => router.push('/dashboard')}
        showBackButton={true}
        onBackClick={() => (isAuthenticated ? router.push('/dashboard') : router.back())}
        isAuthenticated={isAuthenticated}
      />
      {children}
      <Footer />
    </div>
  )
}


