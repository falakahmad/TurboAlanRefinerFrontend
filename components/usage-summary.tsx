"use client"

import { useAnalytics } from "@/contexts/AnalyticsContext"

export default function UsageSummary() {
  const { analytics, loading, error } = useAnalytics()
  
  // Map API response structure to component values
  const jobsData = analytics?.jobs || {}
  const openaiData = analytics?.openai || {}
  
  const totalJobs = jobsData.totalJobs ?? 0
  const completed = jobsData.completed ?? 0
  const running = jobsData.running ?? 0
  const failed = jobsData.failed ?? 0
  const totalReq = openaiData.total_requests ?? 0
  const tokensIn = openaiData.total_tokens_in ?? 0
  const tokensOut = openaiData.total_tokens_out ?? 0

  const Item = ({ label, value }: { label: string; value: string | number }) => (
    <div className="p-3 rounded-lg bg-muted/50 border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-medium">{value}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      {(!analytics && !loading && error) && (
        <div className="col-span-2 md:col-span-6 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      {(!analytics && !loading && !error) && (
        <div className="col-span-2 md:col-span-6 text-xs text-muted-foreground">Usage stats unavailable.</div>
      )}
      {loading && (
        <div className="col-span-2 md:col-span-6 text-xs text-muted-foreground">Loading stats...</div>
      )}
      {analytics && (
        <>
          <Item label="Jobs" value={totalJobs} />
          <Item label="Completed" value={completed} />
          <Item label="Running" value={running} />
          <Item label="Failed" value={failed} />
          <Item label="OpenAI Requests (all time)" value={totalReq} />
          <div className="grid grid-cols-2 gap-2">
            <Item label="Tokens In" value={tokensIn} />
            <Item label="Tokens Out" value={tokensOut} />
          </div>
        </>
      )}
    </div>
  )
}


