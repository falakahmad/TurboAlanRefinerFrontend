"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { refinerClient } from "@/lib/refiner-client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"

export default function UserMenu() {
  const { user: authUser, isAuthenticated, signout, signin } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [analytics, setAnalytics] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)
  
  // Check if we're on dashboard page
  const isOnDashboard = pathname === '/dashboard'

  // Refresh user data if avatarUrl is missing (might have been updated in DB)
  useEffect(() => {
    if (!isAuthenticated || !authUser) return
    
    const refreshUserData = async () => {
      try {
        const token = document.cookie
          .split(';')
          .find(c => c.trim().startsWith('refiner_auth='))
          ?.split('=')[1]?.trim()
        
        if (!token) return
        
        const response = await fetch('/api/auth', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            // Update user with fresh data (including avatarUrl if available)
            signin(data.user, token)
            // Reset avatar error if we got a new avatarUrl
            if (data.user.avatarUrl) {
              setAvatarError(false)
            }
          }
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error)
      }
    }
    
    // Only refresh if avatarUrl is missing or if we're on mount
    if (!authUser.avatarUrl) {
      refreshUserData()
    }
  }, [isAuthenticated, authUser?.id, signin]) // Only depend on user ID, not the whole user object

  // Don't render if not authenticated
  if (!isAuthenticated || !authUser) {
    return null
  }

  useEffect(() => {
    if (!open) return
    let canceled = false
    const load = async () => {
      setLoading(true)
      setAnalyticsError(null)
      try {
        const data = await refinerClient.getAnalytics()
        if (!canceled) {
          setAnalytics(data)
          setAnalyticsError(null)
        }
      } catch (error) {
        if (!canceled) {
          console.error('Failed to load analytics:', error)
          setAnalyticsError(error instanceof Error ? error.message : 'Failed to load analytics')
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 10000)
    return () => { canceled = true; clearInterval(t) }
  }, [open])

  const usageSummary = useMemo(() => {
    if (!analytics) return null
    const jobs = analytics.jobs || {}
    const openai = analytics.openai || {}
    return {
      totalJobs: jobs.totalJobs || 0,
      completed: jobs.completed || 0,
      running: jobs.running || 0,
      failed: jobs.failed || 0,
      totalRequests: openai.total_requests || 0,
      tokensIn: openai.total_tokens_in || 0,
      tokensOut: openai.total_tokens_out || 0,
    }
  }, [analytics])

  return (
    <div className="relative">
      <button
        aria-label="User menu"
        className="rounded-full overflow-hidden w-9 h-9 border border-border"
        onClick={() => setOpen(v => !v)}
      >
        {authUser.avatarUrl && !avatarError ? (
          <Image 
            src={authUser.avatarUrl} 
            alt="avatar" 
            width={36} 
            height={36} 
            className="rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-foreground">
            {(authUser.firstName?.[0] || authUser.email?.[0] || "U").toUpperCase()}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-md shadow-xl z-50 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
              {authUser.avatarUrl && !avatarError ? (
                <Image 
                  src={authUser.avatarUrl} 
                  alt="avatar" 
                  width={48} 
                  height={48} 
                  className="rounded-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-foreground">
                  {(authUser.firstName?.[0] || authUser.email?.[0] || "U").toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{authUser.firstName ? `${authUser.firstName} ${authUser.lastName || ""}` : authUser.email}</div>
              <div className="text-xs text-muted-foreground truncate">{authUser.email}</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">Usage</div>
          {!analytics && !loading && !analyticsError && (
            <div className="text-xs text-muted-foreground mb-2 italic">Usage stats unavailable.</div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Jobs</div>
              <div className="text-foreground font-medium">{usageSummary?.totalJobs ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="text-foreground font-medium">{usageSummary?.completed ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Running</div>
              <div className="text-foreground font-medium">{usageSummary?.running ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="text-foreground font-medium">{usageSummary?.failed ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded col-span-2">
              <div className="text-xs text-muted-foreground">OpenAI Requests (all time)</div>
              <div className="text-foreground font-medium">{usageSummary?.totalRequests ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Tokens In</div>
              <div className="text-foreground font-medium">{usageSummary?.tokensIn ?? 0}</div>
            </div>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground">Tokens Out</div>
              <div className="text-foreground font-medium">{usageSummary?.tokensOut ?? 0}</div>
            </div>
          </div>

          {loading && <div className="text-xs text-muted-foreground">Syncing…</div>}
          {analyticsError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {analyticsError}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <button 
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5" 
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              {!isOnDashboard && (
                <button
                  className="text-xs px-3 py-1.5 rounded-md bg-yellow-400 text-black hover:bg-yellow-500 transition-colors font-medium"
                  onClick={() => {
                    setOpen(false)
                    router.push('/dashboard')
                  }}
                >
                  Dashboard
                </button>
              )}
              {isOnDashboard && (
                <button
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
                  onClick={() => {
                    setOpen(false)
                    router.push('/')
                  }}
                >
                  Home
                </button>
              )}
              <button
                className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                onClick={async () => {
                  await signout()
                  toast({
                    title: "Signed out",
                    description: "You have been signed out successfully",
                  })
                  window.location.href = '/'
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





