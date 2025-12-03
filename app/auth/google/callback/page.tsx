"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

function GoogleCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signin } = useAuth()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      if (error) {
        router.push(`/?error=${encodeURIComponent('Google OAuth failed: ' + error)}&login=1`)
        return
      }

      if (!code) {
        router.push(`/?error=${encodeURIComponent('No authorization code received.')}&login=1`)
        return
      }

      try {
        // Exchange code for token via our callback API
        const response = await fetch(`/api/auth/google/callback?code=${code}&state=${state || ''}`)
        
        if (response.redirected) {
          // If redirected, follow the redirect
          window.location.href = response.url
          return
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }))
          router.push(`/?error=${encodeURIComponent(errorData.error || 'Authentication failed')}&login=1`)
          return
        }

        // If we get here, authentication was successful
        // The callback route should have set cookies and redirected
        router.push('/dashboard')
      } catch (err) {
        console.error('Google callback error:', err)
        router.push(`/?error=${encodeURIComponent('An error occurred during authentication.')}&login=1`)
      }
    }

    handleCallback()
  }, [searchParams, router, signin])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
        <p className="text-muted-foreground">Completing Google sign in...</p>
      </div>
    </div>
  )
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  )
}

