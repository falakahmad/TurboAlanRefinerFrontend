"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAnalytics } from "@/contexts/AnalyticsContext"

interface AnalyticsData {
  totalJobs: number
  completed: number
  failed: number
  running: number
  avgProgress: number
  recentActivity?: Array<{
    id: string
    fileName: string
    timestamp: string
    action: string
    result: "success" | "error" | "warning"
  }>
  performanceMetrics?: {
    avgChangePercent: number
    avgTensionPercent: number
    avgLatency: number
    avgRiskReduction: number
  }
}

export default function AnalyticsDashboard() {
  const { analytics: rawAnalytics, loading, error } = useAnalytics()
  
  // Transform the analytics data to match the expected format
  const analytics: AnalyticsData = {
    totalJobs: rawAnalytics?.jobs?.totalJobs || 0,
    completed: rawAnalytics?.jobs?.completed || 0,
    failed: rawAnalytics?.jobs?.failed || 0,
    running: rawAnalytics?.jobs?.running || 0,
    avgProgress: rawAnalytics?.jobs?.successRate || 0,
    recentActivity: rawAnalytics?.jobs?.recentActivity || [],
    performanceMetrics: {
      avgChangePercent: rawAnalytics?.jobs?.performanceMetrics?.avgChangePercent || 0,
      avgTensionPercent: rawAnalytics?.jobs?.performanceMetrics?.avgTensionPercent || 0,
      avgLatency: rawAnalytics?.jobs?.performanceMetrics?.avgProcessingTime || 0,
      avgRiskReduction: rawAnalytics?.jobs?.performanceMetrics?.avgRiskReduction || 0,
          },
  }


  const getEventAction = (event: any) => {
    switch (event.type) {
      case "complete":
        return "Processing completed"
      case "error":
        return "Processing failed"
      case "pass_start":
        return `Started pass ${event.pass}`
      case "pass_complete":
        return `Completed pass ${event.pass}`
      default:
        return "Processing event"
    }
  }

  const getEventResult = (event: any): "success" | "error" | "warning" => {
    switch (event.type) {
      case "complete":
        return "success"
      case "error":
        return "error"
      case "pass_start":
      case "pass_complete":
        return "success"
      default:
        return "warning"
    }
  }

  const getActivityColor = (result: "success" | "error" | "warning") => {
    switch (result) {
      case "success":
        return "text-green-700"
      case "error":
        return "text-red-700"
      case "warning":
        return "text-yellow-700"
      default:
        return "text-muted-foreground"
    }
  }

  const getActivityIcon = (result: "success" | "error" | "warning") => {
    switch (result) {
      case "success":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case "error":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case "warning":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto mb-2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-16 h-4 mx-auto bg-gray-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading analytics...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-red-200">
          <CardContent className="p-6 text-center">
            <div className="text-red-600 mb-2">Error loading analytics</div>
            <div className="text-muted-foreground text-sm mb-4">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const successRate = analytics.totalJobs > 0 
    ? ((analytics.completed / analytics.totalJobs) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{analytics.completed}</div>
              <div className="text-xs text-muted-foreground">Jobs Completed</div>
              <div className="text-xs text-muted-foreground mt-1">of {analytics.totalJobs} total</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-700">{analytics.failed}</div>
              <div className="text-xs text-muted-foreground">Failed Jobs</div>
              <div className="text-xs text-muted-foreground mt-1">need attention</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">{analytics.running}</div>
              <div className="text-xs text-muted-foreground">Currently Running</div>
              <div className="text-xs text-muted-foreground mt-1">active jobs</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{successRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
              <div className="text-xs text-muted-foreground mt-1">completion rate</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Performance Overview</CardTitle>
          <CardDescription className="text-muted-foreground">Average metrics across all processing sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeDasharray={`${analytics.performanceMetrics?.avgChangePercent || 0}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-foreground font-medium">
                    {analytics.performanceMetrics?.avgChangePercent?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Avg Change</div>
            </div>

            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeDasharray={`${analytics.performanceMetrics?.avgTensionPercent || 0}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-foreground font-medium">
                    {analytics.performanceMetrics?.avgTensionPercent?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Avg Tension</div>
            </div>

            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    strokeDasharray={`${((analytics.performanceMetrics?.avgLatency || 0) / 200) * 100}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-foreground font-medium">
                    {analytics.performanceMetrics?.avgLatency?.toFixed(0) || 0}ms
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>

            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="2"
                    strokeDasharray={`${analytics.performanceMetrics?.avgRiskReduction || 0}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-foreground font-medium">
                    {analytics.performanceMetrics?.avgRiskReduction?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Risk Reduction</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Recent Activity</CardTitle>
          <CardDescription className="text-muted-foreground">Latest processing events and results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recentActivity && analytics.recentActivity.length > 0 ? (
              analytics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className={getActivityColor(activity.result)}>{getActivityIcon(activity.result)}</div>
                  <div className="flex-1">
                    <div className="text-foreground text-sm font-medium">{activity.fileName}</div>
                    <div className="text-muted-foreground text-xs">{activity.action}</div>
                  </div>
                  <div className="text-muted-foreground text-xs">{activity.timestamp}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No recent activity
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Usage Statistics */}
      {rawAnalytics?.openai && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">OpenAI Usage & Costs</CardTitle>
            <CardDescription className="text-muted-foreground">
              Model: {rawAnalytics.openai.current_model || "gpt-4"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  ${(rawAnalytics.openai.total_cost || 0).toFixed(4)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Cost</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {rawAnalytics.openai.total_requests || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Requests</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {(rawAnalytics.openai.total_tokens_in || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Input Tokens</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {(rawAnalytics.openai.total_tokens_out || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Output Tokens</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Per Request</div>
                <div className="text-lg font-semibold text-foreground">
                  ${rawAnalytics.openai.total_requests > 0 
                    ? (rawAnalytics.openai.total_cost / rawAnalytics.openai.total_requests).toFixed(4)
                    : "0.0000"}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Input Cost</div>
                <div className="text-lg font-semibold text-foreground">
                  ${((rawAnalytics.openai.total_tokens_in || 0) / 1000 * 0.03).toFixed(4)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(rawAnalytics.openai.total_tokens_in || 0).toLocaleString()} tokens × $0.03/1K
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Output Cost</div>
                <div className="text-lg font-semibold text-foreground">
                  ${((rawAnalytics.openai.total_tokens_out || 0) / 1000 * 0.06).toFixed(4)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(rawAnalytics.openai.total_tokens_out || 0).toLocaleString()} tokens × $0.06/1K
                </div>
              </div>
            </div>

            {rawAnalytics.openai.last_24h && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium text-foreground mb-2">Last 24 Hours</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="text-lg font-semibold text-foreground">
                      ${(rawAnalytics.openai.last_24h.cost || 0).toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Requests</div>
                    <div className="text-lg font-semibold text-foreground">
                      {rawAnalytics.openai.last_24h.requests || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">In Tokens</div>
                    <div className="text-lg font-semibold text-foreground">
                      {(rawAnalytics.openai.last_24h.tokens_in || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Out Tokens</div>
                    <div className="text-lg font-semibold text-foreground">
                      {(rawAnalytics.openai.last_24h.tokens_out || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schema Usage Statistics */}
      {rawAnalytics?.schema_usage && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Schema Usage Statistics</CardTitle>
            <CardDescription className="text-muted-foreground">Tracking schema activations and usage patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {rawAnalytics.schema_usage.total_usages || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Usages</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-lg font-semibold text-foreground">
                  {rawAnalytics.schema_usage.most_used_schema || "None"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Most Used ({rawAnalytics.schema_usage.most_used_count || 0} times)
                </div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-lg font-semibold text-foreground">
                  {rawAnalytics.schema_usage.least_used_schema || "None"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Least Used ({rawAnalytics.schema_usage.least_used_count || 0} times)
                </div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {(rawAnalytics.schema_usage.average_usage || 0).toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg Usage</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
