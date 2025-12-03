"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import UserMenu from "@/components/user-menu"

interface HeaderProps {
  onLoginClick: () => void
  showBackButton?: boolean
  onBackClick?: () => void
  isAuthenticated?: boolean
}

export default function Header({
  onLoginClick,
  showBackButton = false,
  onBackClick,
  isAuthenticated = false,
}: HeaderProps) {
  const ctx = (() => { try { return useAuth() } catch { return null } })()
  const authed = ctx ? ctx.isAuthenticated : isAuthenticated
  const doLogout = async () => {
    if (ctx) {
      await ctx.signout()
    } else {
      try {
        // Clear client state
        try { localStorage.removeItem('refiner-auth-state') } catch {}
        try { localStorage.removeItem('turbo-alan-user') } catch {}
        // Clear cookie server-side
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch {}
      // Redirect to hero page
      window.location.href = '/'
    }
  }
  return (
    <header className="relative z-20 flex items-center justify-between p-6">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <button
            onClick={onBackClick}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 px-3 py-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        <Link href={showBackButton ? "/dashboard" : "/"} className="text-white font-medium text-lg flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center border border-yellow-300/50">
            <span className="text-white font-bold text-sm drop-shadow-sm">T</span>
          </div>
          <span className="instrument">Turbo Alan Refiner</span>
        </Link>
      </div>

      {!showBackButton && (
        <nav className="flex items-center space-x-2">
          <Link
            href="/features"
            className="text-white/80 hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            Features
          </Link>
          <Link
            href="/product"
            className="text-white/80 hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            How it Works
          </Link>
          <Link
            href="/pricing"
            className="text-white/80 hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            Pricing
          </Link>
        </nav>
      )}

      {/* Show login button when NOT authenticated and NOT on dashboard */}
      {!showBackButton && !authed && (
        <div id="gooey-btn" className="relative flex items-center group" style={{ filter: "url(#gooey-filter)" }}>
          <button className="absolute right-0 px-2.5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-normal text-xs transition-all duration-300 hover:from-yellow-300 hover:to-yellow-400 cursor-pointer h-8 flex items-center justify-center -translate-x-10 group-hover:-translate-x-19 z-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
          <button
            onClick={onLoginClick}
            className="px-6 py-2 rounded-full bg-white text-black font-normal text-xs transition-all duration-300 hover:bg-gradient-to-r hover:from-yellow-400 hover:to-yellow-500 cursor-pointer h-8 flex items-center z-10"
          >
            Login
          </button>
        </div>
      )}
      
      {/* Show UserMenu when authenticated (both on dashboard and home) */}
      {authed && (
        <UserMenu />
      )}
    </header>
  )
}
