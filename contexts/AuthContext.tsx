"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

type AuthUser = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

type AuthState = {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  isInitialized: boolean
  signin: (user: AuthUser, token: string) => void
  signout: () => Promise<void>
}

const Ctx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from localStorage/cookie once on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        // Load user from localStorage
        const userRaw = localStorage.getItem('turbo-alan-user')
        if (userRaw) {
          const parsedUser = JSON.parse(userRaw)
          setUser(parsedUser)
        }
      } catch {}
      
      try {
        // Load token from localStorage
        const authRaw = localStorage.getItem('refiner-auth-state')
        if (authRaw) {
          const authState = JSON.parse(authRaw)
          if (authState?.token) {
            setToken(authState.token)
          }
        }
      } catch {}
      
      try {
        // Also check cookie for token (for SSR compatibility)
        const cookies = document.cookie.split(';')
        const authCookie = cookies.find(c => c.trim().startsWith('refiner_auth='))
        if (authCookie) {
          const cookieToken = authCookie.split('=')[1]?.trim()
          if (cookieToken && cookieToken !== '1') { // Don't use placeholder "1"
            setToken(cookieToken)
            // If we have token from cookie but no user, try to restore user
            const userRaw = localStorage.getItem('turbo-alan-user')
            if (userRaw) {
              try {
                const parsedUser = JSON.parse(userRaw)
                setUser(parsedUser)
              } catch {}
            }
          }
        }
      } catch {}
      
      setIsInitialized(true)
    }
    
    initializeAuth()
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      if (user) localStorage.setItem('turbo-alan-user', JSON.stringify(user))
    } catch {}
  }, [user])
  useEffect(() => {
    try {
      localStorage.setItem('refiner-auth-state', JSON.stringify({ isAuthenticated: !!token, token }))
    } catch {}
  }, [token])

  // Minimal expiry check (JWT exp if present)
  useEffect(() => {
    if (!token) return
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        const exp = payload?.exp ? Number(payload.exp) * 1000 : 0
        if (exp && Date.now() > exp) {
          // expired; do not auto-clear user, but mark token null
          setToken(null)
        }
      }
    } catch {}
  }, [token])

  const signin = useCallback((u: AuthUser, t: string) => {
    setUser(u)
    setToken(t)
    try {
      const expires = new Date(Date.now() + 7*24*60*60*1000).toUTCString()
      document.cookie = `refiner_auth=${t}; Path=/; Expires=${expires}; SameSite=Lax`
    } catch {}
  }, [])

  const signout = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    try { localStorage.removeItem('refiner-auth-state') } catch {}
    try { localStorage.removeItem('turbo-alan-user') } catch {}
    try { document.cookie = 'refiner_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT' } catch {}
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    isAuthenticated: !!token,
    user,
    token,
    isInitialized,
    signin,
    signout,
  }), [token, user, isInitialized, signin, signout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}



