"use client"

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react'
import { refinerClient } from '@/lib/refiner-client'
import { useAuth } from './AuthContext'

interface AnalyticsData {
  jobs: {
    totalJobs: number
    completed: number
    failed: number
    running: number
    successRate: number
    performanceMetrics: {
      avgChangePercent: number
      avgTensionPercent: number
      avgProcessingTime: number
      avgRiskReduction: number
    }
    recentActivity: Array<{
      id: string
      fileName: string
      timestamp: string
      status: string
      action: string
    }>
  }
  openai: {
    total_requests: number
    total_tokens_in: number
    total_tokens_out: number
    total_cost: number
    current_model: string
    last_24h: {
      requests: number
      tokens_in: number
      tokens_out: number
      cost: number
      series: Array<{
        hour: number
        requests: number
        tokens_in: number
        tokens_out: number
        cost: number
      }>
    }
  }
  schema_usage: {
    total_usages: number
    most_used_schema: string | null
    most_used_count: number
    least_used_schema: string | null
    least_used_count: number
    average_usage: number
    schema_usage: Record<string, number>
    schema_last_used: Record<string, string>
  }
}

interface AnalyticsContextType {
  analytics: AnalyticsData | null
  loading: boolean
  error: string | null
  refreshAnalytics: () => Promise<void>
  lastUpdated: Date | null
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refreshAnalytics = useCallback(async (userIdOverride?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // Use provided userId or get from auth context
      // If userIdOverride is explicitly undefined/null, fetch all users
      const userId = userIdOverride !== undefined ? userIdOverride : (user?.id || undefined)
      const data = await refinerClient.getAnalytics(userId)
      setAnalytics(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError("Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial load
  useEffect(() => {
    refreshAnalytics()
  }, [refreshAnalytics])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshAnalytics, 30000)
    return () => clearInterval(interval)
  }, [refreshAnalytics])

  // Listen for processing completion events
  useEffect(() => {
    const handleProcessingComplete = () => {
      refreshAnalytics()
    }

    window.addEventListener("refiner-processing-complete", handleProcessingComplete)
    return () => window.removeEventListener("refiner-processing-complete", handleProcessingComplete)
  }, [refreshAnalytics])

  return (
    <AnalyticsContext.Provider value={{ analytics, loading, error, refreshAnalytics, lastUpdated }}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider')
  }
  return context
}
