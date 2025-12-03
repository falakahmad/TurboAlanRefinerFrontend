"use client"

import { useLoading } from "@/contexts/LoadingContext"

export default function LoadingBar() {
  const { isLoading, progress, message } = useLoading()

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 transition-all duration-300 ease-out shadow-lg"
          style={{
            width: `${progress}%`,
            boxShadow: "0 0 10px rgba(250, 204, 21, 0.5)",
          }}
        />
      </div>
      {message && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-900">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  )
}

