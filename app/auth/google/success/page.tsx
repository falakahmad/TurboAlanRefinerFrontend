"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function GoogleAuthSuccessPage() {
  const router = useRouter()
  const { signin, isInitialized, isAuthenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    // Wait for AuthContext to initialize before processing
    if (!isInitialized) return

    const handleSuccess = async () => {
      try {
        // Get token and user from URL hash
        const hash = window.location.hash.substring(1) // Remove #
        const params = new URLSearchParams(hash)
        const token = params.get('token')
        const userStr = params.get('user')

        if (token && userStr) {
          try {
            const decodedUserStr = decodeURIComponent(userStr)
            const user = JSON.parse(decodedUserStr)
            
            // Ensure user has required fields
            if (!user.id || !user.email) {
              throw new Error('Invalid user data received')
            }
            
            // Normalize user object to match AuthContext expected structure
            const normalizedUser = {
              id: user.id,
              email: user.email,
              firstName: user.firstName || user.first_name || '',
              lastName: user.lastName || user.last_name || '',
              avatarUrl: user.avatarUrl || user.avatar_url || undefined,
            }
            
            // Set auth state via AuthContext
            signin(normalizedUser, token)
            
            // Also save to localStorage immediately to ensure persistence
            try {
              localStorage.setItem('turbo-alan-user', JSON.stringify(normalizedUser))
              localStorage.setItem('refiner-auth-state', JSON.stringify({ isAuthenticated: true, token }))
            } catch (storageError) {
              console.warn('Failed to save to localStorage:', storageError)
            }
            
            // Clear hash from URL
            window.history.replaceState({}, '', '/auth/google/success')
            
            // Wait a bit to ensure state updates complete
            // Since we've saved to localStorage, AuthContext will pick it up
            await new Promise(resolve => setTimeout(resolve, 300))
            
            setIsProcessing(false)
            // Redirect to dashboard
            router.push('/dashboard')
          } catch (parseError) {
            console.error('Error parsing user data:', parseError)
            setError('Failed to parse user data')
            setTimeout(() => {
              router.push('/?error=Failed to process authentication&login=1')
            }, 2000)
          }
        } else {
          // Fallback: try to get from cookie
          const cookies = document.cookie.split(';')
          const authCookie = cookies.find(c => c.trim().startsWith('refiner_auth='))
          if (authCookie) {
            const cookieToken = authCookie.split('=')[1]?.trim()
            if (cookieToken && cookieToken !== '1') {
              // Token is in cookie, but we need user data
              // Try to fetch user from API
              try {
                const userResponse = await fetch('/api/auth', {
                  headers: {
                    'Authorization': `Bearer ${cookieToken}`
                  }
                })
                
                if (userResponse.ok) {
                  const userData = await userResponse.json()
                  if (userData.user) {
                    signin(userData.user, cookieToken)
                    await new Promise(resolve => setTimeout(resolve, 200))
                    router.push('/dashboard')
                    return
                  }
                }
              } catch (fetchError) {
                console.error('Failed to fetch user:', fetchError)
              }
              
              // If fetch fails, still redirect - AuthContext might have user in localStorage
              router.push('/dashboard')
              return
            }
          }
          
          setError('No authentication data found')
          setTimeout(() => {
            router.push('/?error=Failed to complete authentication&login=1')
          }, 2000)
        }
      } catch (error) {
        console.error('Error processing Google auth success:', error)
        setError('Authentication failed')
        setTimeout(() => {
          router.push('/?error=Failed to process authentication&login=1')
        }, 2000)
      }
    }

    handleSuccess()
  }, [router, signin, isInitialized])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-red-500 mb-2">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
            <p className="text-muted-foreground">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  )
}

