"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAnalytics } from "@/contexts/AnalyticsContext"
import { useAuth } from "@/contexts/AuthContext"

interface HourBucket {
  hour: number
  requests: number
  tokens_in: number
  tokens_out: number
}

// OpenAI Pricing (as of 2024)
const OPENAI_PRICING = {
  'gpt-4': {
    input: 0.03, // $0.03 per 1K tokens
    output: 0.06  // $0.06 per 1K tokens
  },
  'gpt-4-turbo': {
    input: 0.01, // $0.01 per 1K tokens
    output: 0.03  // $0.03 per 1K tokens
  },
  'gpt-4o': {
    input: 0.005, // $0.005 per 1K tokens
    output: 0.015  // $0.015 per 1K tokens
  },
  'gpt-3.5-turbo': {
    input: 0.0015, // $0.0015 per 1K tokens
    output: 0.002  // $0.002 per 1K tokens
  }
}

interface CostBreakdown {
  totalCost: number
  inputCost: number
  outputCost: number
  costPerRequest: number
  costPerPass: number
  estimatedMonthlyCost: number
}

interface AnalyticsResponse {
  jobs?: {
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
  openai?: {
    total_requests: number
    total_tokens_in: number
    total_tokens_out: number
    total_cost: number
    current_model: string
    last_24h: { requests: number; tokens_in: number; tokens_out: number; cost: number; series: HourBucket[] }
  }
  schema_usage?: {
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

export default function AdminAnalytics() {
  const { user } = useAuth()
  const { analytics: data, loading: isLoading, error, refreshAnalytics } = useAnalytics()
  const [selectedModel, setSelectedModel] = useState<'gpt-4' | 'gpt-4-turbo' | 'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4')
  const [viewMode, setViewMode] = useState<'user' | 'all'>('user') // 'user' for user-specific, 'all' for aggregate

  // Update selected model when data loads
  useMemo(() => {
    if (data?.openai?.current_model) {
      const model = data.openai.current_model.toLowerCase()
      if (model.includes('gpt-4o')) {
        setSelectedModel('gpt-4o')
      } else if (model.includes('gpt-4-turbo')) {
        setSelectedModel('gpt-4-turbo')
      } else if (model.includes('gpt-3.5')) {
        setSelectedModel('gpt-3.5-turbo')
      } else if (model.includes('gpt-4')) {
        setSelectedModel('gpt-4')
      }
    }
  }, [data])

  const series = data?.openai?.last_24h?.series || []

  // Field normalization helpers (handle tokens_in vs token_count, etc.)
  const normTokensIn = (v: any) => Number((v ?? data?.openai?.total_tokens_in ?? 0)) || 0
  const normTokensOut = (v: any) => Number((v ?? data?.openai?.total_tokens_out ?? 0)) || 0
  const totalRequests = Number(data?.openai?.total_requests ?? 0) || 0

  // Calculate costs based on selected model
  const costBreakdown = useMemo((): CostBreakdown => {
    if (!data?.openai) {
      return {
        totalCost: 0,
        inputCost: 0,
        outputCost: 0,
        costPerRequest: 0,
        costPerPass: 0,
        estimatedMonthlyCost: 0
      }
    }

    // Use real cost data from backend if available
    if (data.openai.total_cost && data.openai.total_cost > 0) {
      const totalRequests = data.openai.total_requests || 0
      const totalJobs = data.jobs?.totalJobs || 0
      
      return {
        totalCost: data.openai.total_cost,
        inputCost: data.openai.total_cost * 0.4, // Rough estimate
        outputCost: data.openai.total_cost * 0.6, // Rough estimate
        costPerRequest: data.openai.total_cost / Math.max(totalRequests, 1),
        costPerPass: data.openai.total_cost / Math.max(totalJobs, 1),
        estimatedMonthlyCost: data.openai.total_cost * 30
      }
    }

    // Fallback to model pricing calculation
    const pricing = OPENAI_PRICING[selectedModel] || OPENAI_PRICING['gpt-4'] // Fallback to gpt-4 if model not found
    const totalTokensIn = normTokensIn(undefined)
    const totalTokensOut = normTokensOut(undefined)
    const totalRequests = Number(data.openai.total_requests || 0)
    const totalJobs = data.jobs?.totalJobs || 0

    // Calculate costs (pricing is per 1K tokens)
    const inputCost = (totalTokensIn / 1000) * (pricing?.input || 0.03)
    const outputCost = (totalTokensOut / 1000) * (pricing?.output || 0.06)
    const totalCost = inputCost + outputCost

    // Calculate per-request and per-pass costs
    const costPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0
    const costPerPass = totalJobs > 0 ? totalCost / totalJobs : 0

    // Estimate monthly cost (assuming 30 days)
    const dailyCost = totalCost / Math.max(1, Math.ceil((Date.now() - (30 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000)))
    const estimatedMonthlyCost = dailyCost * 30

    return {
      totalCost,
      inputCost,
      outputCost,
      costPerRequest,
      costPerPass,
      estimatedMonthlyCost
    }
  }, [data, selectedModel])

  // Calculate 24h cost trend
  const hourlyCosts = useMemo(() => {
    if (!data?.openai?.last_24h?.series) return []
    
    const pricing = OPENAI_PRICING[selectedModel] || OPENAI_PRICING['gpt-4'] // Fallback to gpt-4 if model not found
    return series.map(bucket => {
      const inputCost = (Number(bucket.tokens_in ?? 0) / 1000) * (pricing?.input || 0.03)
      const outputCost = (Number(bucket.tokens_out ?? 0) / 1000) * (pricing?.output || 0.06)
      return {
        hour: bucket.hour,
        cost: inputCost + outputCost,
        requests: bucket.requests
      }
    })
  }, [series, selectedModel])

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Admin Analytics</CardTitle>
            <CardDescription className="text-muted-foreground">
              {viewMode === 'user' ? 'Your Usage Statistics' : 'All Users Statistics'}
            </CardDescription>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'user' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('user')
                  refreshAnalytics(user?.id)
                }}
                className="text-xs"
              >
                My Stats
              </Button>
              <Button
                variant={viewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('all')
                  refreshAnalytics(null)
                }}
                className="text-xs"
              >
                All Users
              </Button>
            </div>
          )}
        </div>
        
        {/* Model Selection */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Model:</span>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value as any)}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
          {data?.openai?.current_model && (
            <span className="text-xs text-green-600 font-medium">
              (Currently using: {data.openai.current_model})
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="text-xs text-muted-foreground">Refreshing…</div>}
        {!isLoading && !data && (
          <div className="text-xs text-muted-foreground">No analytics data yet.</div>
        )}

        {/* Cost Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="text-xs text-green-600 font-medium">Total Cost</div>
            <div className="text-lg font-bold text-green-800">${costBreakdown.totalCost.toFixed(4)}</div>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-xs text-blue-600 font-medium">Per Request</div>
            <div className="text-lg font-bold text-blue-800">${costBreakdown.costPerRequest.toFixed(4)}</div>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <div className="text-xs text-purple-600 font-medium">Per Pass</div>
            <div className="text-lg font-bold text-purple-800">${costBreakdown.costPerPass.toFixed(4)}</div>
          </div>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded">
            <div className="text-xs text-orange-600 font-medium">Est. Monthly</div>
            <div className="text-lg font-bold text-orange-800">${costBreakdown.estimatedMonthlyCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Token Usage */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            {data?.openai?.total_requests ?? 0} requests
          </Badge>
          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
            {normTokensIn(undefined).toLocaleString()} in-tokens
          </Badge>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            {normTokensOut(undefined).toLocaleString()} out-tokens
          </Badge>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Input Cost</div>
            <div className="text-foreground font-medium">${costBreakdown.inputCost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">
              {normTokensIn(undefined).toLocaleString()} tokens × ${OPENAI_PRICING[selectedModel].input}/1K
            </div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Output Cost</div>
            <div className="text-foreground font-medium">${costBreakdown.outputCost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">
              {normTokensOut(undefined).toLocaleString()} tokens × ${OPENAI_PRICING[selectedModel].output}/1K
            </div>
          </div>
        </div>

        {/* Cost Trend Chart */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Last 24h cost/hour</div>
          <div className="grid grid-cols-12 gap-1 items-end h-20">
            {hourlyCosts.slice(-12).map((b, idx) => (
              <div 
                key={idx} 
                className="bg-gradient-to-t from-green-400 to-green-600 rounded-sm" 
                style={{ height: `${Math.min(100, (b.cost * 1000) / Math.max(1, Math.max(...hourlyCosts.map(h => h.cost))))}%` }} 
                title={`${new Date(b.hour*1000).toLocaleTimeString()} • $${b.cost.toFixed(4)} • ${b.requests} req`} 
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>${hourlyCosts.length > 0 ? Math.min(...hourlyCosts.map(h => h.cost)).toFixed(4) : '0'}</span>
            <span>${hourlyCosts.length > 0 ? Math.max(...hourlyCosts.map(h => h.cost)).toFixed(4) : '0'}</span>
          </div>
        </div>

        {/* Job stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Total Jobs</div>
            <div className="text-foreground font-medium">{data?.jobs?.totalJobs ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              ${costBreakdown.costPerPass.toFixed(4)} avg cost
            </div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-foreground font-medium">{data?.jobs?.completed ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              {data?.jobs?.totalJobs ? ((data.jobs.completed / data.jobs.totalJobs) * 100).toFixed(1) : 0}% success
            </div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Running</div>
            <div className="text-foreground font-medium">{data?.jobs?.running ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              Active processing
            </div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-foreground font-medium">{data?.jobs?.failed ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              {data?.jobs?.totalJobs ? ((data.jobs.failed / data.jobs.totalJobs) * 100).toFixed(1) : 0}% failure
            </div>
          </div>
        </div>

        {/* Schema Usage Statistics */}
        {data?.schema_usage && (
          <div className="space-y-4">
            <div className="text-sm font-medium text-gray-800">Schema Usage Statistics</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                <div className="text-xs text-purple-600 font-medium">Total Usages</div>
                <div className="text-lg font-bold text-purple-800">{data.schema_usage.total_usages ?? 0}</div>
                <div className="text-xs text-purple-600">Schema activations</div>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
                <div className="text-xs text-indigo-600 font-medium">Most Used</div>
                <div className="text-lg font-bold text-indigo-800">
                  {data.schema_usage.most_used_schema ? 
                    data.schema_usage.most_used_schema.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                    'None'
                  }
                </div>
                <div className="text-xs text-indigo-600">
                  {data.schema_usage.most_used_count ?? 0} times
                </div>
              </div>
              <div className="p-3 bg-pink-50 border border-pink-200 rounded">
                <div className="text-xs text-pink-600 font-medium">Least Used</div>
                <div className="text-lg font-bold text-pink-800">
                  {data.schema_usage.least_used_schema ? 
                    data.schema_usage.least_used_schema.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                    'None'
                  }
                </div>
                <div className="text-xs text-pink-600">
                  {data.schema_usage.least_used_count ?? 0} times
                </div>
              </div>
              <div className="p-3 bg-teal-50 border border-teal-200 rounded">
                <div className="text-xs text-teal-600 font-medium">Avg Usage</div>
                <div className="text-lg font-bold text-teal-800">
                  {(data.schema_usage.average_usage ?? 0).toFixed(1)}
                </div>
                <div className="text-xs text-teal-600">Per schema</div>
              </div>
            </div>
            
            {/* Schema Usage Breakdown */}
            <div className="space-y-2">
              <div className="text-xs text-gray-600 font-medium">Schema Usage Breakdown</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(data.schema_usage.schema_usage || {})
                  .sort(([,a], [,b]) => b - a)
                  .map(([schemaId, count]) => (
                    <div key={schemaId} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                      <span className="text-gray-700">
                        {schemaId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{count}</span>
                        <span className="text-gray-500">uses</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Billing Summary */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-gray-800 mb-2">Billing Summary</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-gray-600">Current Period</div>
              <div className="font-bold text-lg">${costBreakdown.totalCost.toFixed(4)}</div>
              <div className="text-gray-500">
                {data?.openai?.total_requests ?? 0} requests • {data?.jobs?.totalJobs ?? 0} jobs
              </div>
            </div>
            <div>
              <div className="text-gray-600">Projected Monthly</div>
              <div className="font-bold text-lg">${costBreakdown.estimatedMonthlyCost.toFixed(2)}</div>
              <div className="text-gray-500">
                Based on current usage pattern
              </div>
            </div>
            <div>
              <div className="text-gray-600">Cost Efficiency</div>
              <div className="font-bold text-lg">
                {data?.jobs?.totalJobs ? (costBreakdown.totalCost / data.jobs.totalJobs).toFixed(4) : '0'}$/job
              </div>
              <div className="text-gray-500">
                Average cost per refinement job
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


