"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

type LoadingState = {
  isLoading: boolean
  progress: number
  message?: string
  startLoading: (message?: string) => void
  stopLoading: () => void
  setProgress: (progress: number) => void
}

const LoadingContext = createContext<LoadingState | undefined>(undefined)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | undefined>(undefined)

  const startLoading = useCallback((msg?: string) => {
    setIsLoading(true)
    setProgress(0)
    setMessage(msg)
  }, [])

  const stopLoading = useCallback(() => {
    setProgress(100)
    setTimeout(() => {
      setIsLoading(false)
      setProgress(0)
      setMessage(undefined)
    }, 200)
  }, [])

  const updateProgress = useCallback((prog: number) => {
    setProgress(Math.min(100, Math.max(0, prog)))
  }, [])

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        progress,
        message,
        startLoading,
        stopLoading,
        setProgress: updateProgress,
      }}
    >
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading(): LoadingState {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider")
  }
  return context
}

