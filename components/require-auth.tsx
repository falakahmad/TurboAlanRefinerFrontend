"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const auth = (() => { try { return useAuth() } catch { return null } })()
  const isAuthed = !!(auth && auth.isAuthenticated)
  const isInitialized = auth?.isInitialized ?? false
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // Wait for auth to initialize before redirecting
    if (isInitialized && !isAuthed && !hasRedirected) {
      // Check if auth data exists in localStorage (might be restoring)
      let hasStoredAuth = false
      try {
        const storedUser = localStorage.getItem('turbo-alan-user')
        const storedAuth = localStorage.getItem('refiner-auth-state')
        hasStoredAuth = !!(storedUser && storedAuth)
      } catch {}
      
      // If localStorage has auth data, wait longer for AuthContext to restore it
      // Otherwise, redirect quickly
      const delay = hasStoredAuth ? 800 : 200
      
      const t = setTimeout(() => {
        // Check one more time if user is now authenticated
        // (AuthContext might have restored from localStorage)
        if (auth?.isAuthenticated) {
          return // User is now authenticated, don't redirect
        }
        
        setHasRedirected(true)
        router.replace('/?login=1')
      }, delay)
      return () => clearTimeout(t)
    }
  }, [isAuthed, isInitialized, hasRedirected, router, auth])

  // Show loading while initializing
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

  // Show loading while redirecting
  if (!isAuthed && hasRedirected) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (!isAuthed) return null
  return <>{children}</>
}



