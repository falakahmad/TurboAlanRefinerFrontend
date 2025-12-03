"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, TrendingDown, Minus, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react"
import type { PassMetrics } from "@/lib/refiner-client"

interface StageChip {
  name: string
  status: "pending" | "running" | "completed" | "error"
  duration?: number
}

interface PassData {
  passNumber: number
  stages: StageChip[]
  metrics?: PassMetrics
  sparklineData: {
    changePercent: number
    tensionPercent: number
    normalizedLatency: number
    previousPassRisk: number
  }
}

interface ProgressTrackerProps {
  fileId: string
  fileName: string
  currentPass: number
  totalPasses: number
  passData: PassData[]
  onToggleMetrics?: () => void
}

export default function ProgressTracker({
  fileId,
  fileName,
  currentPass,
  totalPasses,
  passData,
  onToggleMetrics,
}: ProgressTrackerProps) {
  const [showTooltip, setShowTooltip] = useState<{ passNumber: number; x: number; y: number } | null>(null)
  const [metricsAligned, setMetricsAligned] = useState(false)

  const getStageColor = (status: StageChip["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "running":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStageIcon = (status: StageChip["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-3 h-3" />
      case "running":
        return <Loader2 className="w-3 h-3 animate-spin" />
      case "error":
        return <XCircle className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const renderSparkline = (data: number[], color: string, label: string) => {
    if (data.length < 1) return null

    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1

    // Better aspect ratio for more compact sparklines
    const width = 80
    const height = 40
    const padding = 6

    // Calculate current value and trend
    const currentValue = data[data.length - 1]
    const previousValue = data.length > 1 ? data[data.length - 2] : currentValue
    const trend = currentValue - previousValue
    const trendUp = trend > 0
    const trendDown = trend < 0

    let points: string | null = null
    let pathD: string | null = null
    
    if (data.length > 1) {
      // Create smooth curve using quadratic bezier
      const coords = data.map((value, index) => ({
        x: padding + (index / (data.length - 1)) * (width - 2 * padding),
        y: padding + (1 - (value - min) / range) * (height - 2 * padding)
      }))
      
      // Build smooth path
      pathD = coords.reduce((path, point, i) => {
        if (i === 0) return `M ${point.x},${point.y}`
        
        const prev = coords[i - 1]
        const cpx = (prev.x + point.x) / 2
        
        return `${path} Q ${cpx},${prev.y} ${cpx},${(prev.y + point.y) / 2} T ${point.x},${point.y}`
      }, '')
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold" style={{ color }}>{currentValue.toFixed(1)}</span>
            {data.length > 1 && (
              <>
                {trendUp && <TrendingUp className="w-3 h-3 text-green-600" />}
                {trendDown && <TrendingDown className="w-3 h-3 text-red-600" />}
                {!trendUp && !trendDown && <Minus className="w-3 h-3 text-gray-400" />}
              </>
            )}
          </div>
        </div>
        <div className="w-full h-10 flex items-center relative group">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Gradient definition for fill */}
            <defs>
              <linearGradient id={`gradient-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.2 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            
            {/* Fill area under curve */}
            {pathD && (
              <path
                d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
                fill={`url(#gradient-${label.replace(/\s/g, '')})`}
              />
            )}
            
            {/* Main line */}
            {pathD && (
              <path
                d={pathD}
                fill="none" 
                stroke={color} 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300 group-hover:stroke-[3]"
              />
            )}
            
            {/* Data points */}
            {data.map((value, index) => {
              const cx = data.length === 1 
                ? width / 2 
                : padding + (index / (data.length - 1)) * (width - 2 * padding)
              const cy = data.length === 1 
                ? height / 2 
                : padding + (1 - (value - min) / range) * (height - 2 * padding)
              
              const isLast = index === data.length - 1
              
              return (
                <g key={index}>
                  {/* Outer glow circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isLast ? "5" : "4"}
                    fill={color}
                    opacity="0.2"
                    className="transition-all duration-300"
                  />
                  {/* Main dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isLast ? "3" : "2"}
                    fill={color}
                    className="transition-all duration-300 group-hover:r-[4]"
                  />
                  {/* White center for last point */}
                  {isLast && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="1.5"
                      fill="white"
                      className="transition-all duration-300"
                    />
                  )}
                </g>
              )
            })}
          </svg>
          
          {/* Hover overlay with value */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow-lg border border-gray-200">
              <span className="text-xs font-semibold" style={{ color }}>{currentValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSparklineHover = (event: React.MouseEvent, passNumber: number) => {
    setShowTooltip({
      passNumber,
      x: event.clientX,
      y: event.clientY,
    })
  }

  return (
    <Card className="bg-card border-border w-full rounded-xl shadow-md">
      <CardHeader className="border-b border-border bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-t-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-card-foreground text-lg break-words font-semibold">{fileName}</CardTitle>
            <CardDescription className="text-muted-foreground break-words mt-1">
              Pass {currentPass} of {totalPasses} • File ID: {fileId}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleMetrics} 
            className="text-muted-foreground hover:text-foreground hover:bg-white/80 rounded-lg flex-shrink-0"
          >
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Metrics
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        {passData.map((pass) => (
          <div key={pass.passNumber} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground font-semibold">Pass {pass.passNumber}</h4>
              {pass.passNumber === currentPass && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 rounded-full px-3 py-1">Current</Badge>
              )}
            </div>

            {/* Stage Chips */}
            <div className="flex flex-wrap gap-2 w-full p-4 bg-muted/50 rounded-xl border border-border">
              {pass.stages.map((stage) => (
                <div 
                  key={stage.name} 
                  className={`px-3 py-1.5 rounded-lg text-xs border ${getStageColor(stage.status)}`}
                  style={{ minWidth: 'fit-content' }}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {getStageIcon(stage.status)}
                    <span className="font-medium">{stage.name}</span>
                    {stage.duration && (
                      <span className="text-xs opacity-70">
                        ({typeof stage.duration === 'number' ? stage.duration.toFixed(2) : stage.duration}ms)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sparklines - Fixed with proper containment */}
            {pass.sparklineData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border border-gray-200 overflow-hidden">
                <div
                  onMouseEnter={(e) => handleSparklineHover(e, pass.passNumber)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="cursor-pointer hover:bg-white/80 rounded-xl p-3 transition-all duration-200 border border-transparent hover:border-blue-200 hover:shadow-sm"
                >
                  {renderSparkline(
                    passData.slice(0, pass.passNumber).map((p) => p.sparklineData.changePercent),
                    "#3b82f6",
                    "Change %",
                  )}
                </div>
                <div
                  onMouseEnter={(e) => handleSparklineHover(e, pass.passNumber)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="cursor-pointer hover:bg-white/80 rounded-xl p-3 transition-all duration-200 border border-transparent hover:border-green-200 hover:shadow-sm"
                >
                  {renderSparkline(
                    passData.slice(0, pass.passNumber).map((p) => p.sparklineData.tensionPercent),
                    "#10b981",
                    "Tension %",
                  )}
                </div>
                <div
                  onMouseEnter={(e) => handleSparklineHover(e, pass.passNumber)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="cursor-pointer hover:bg-white/80 rounded-xl p-3 transition-all duration-200 border border-transparent hover:border-amber-200 hover:shadow-sm"
                >
                  {renderSparkline(
                    passData.slice(0, pass.passNumber).map((p) => p.sparklineData.normalizedLatency),
                    "#f59e0b",
                    "Latency",
                  )}
                </div>
                <div
                  onMouseEnter={(e) => handleSparklineHover(e, pass.passNumber)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="cursor-pointer hover:bg-white/80 rounded-xl p-3 transition-all duration-200 border border-transparent hover:border-red-200 hover:shadow-sm"
                >
                  {renderSparkline(
                    passData.slice(0, pass.passNumber).map((p) => p.sparklineData.previousPassRisk),
                    "#ef4444",
                    "Risk %",
                  )}
                </div>
              </div>
            )}

            {/* Detailed Metrics (Toggle-aligned) */}
            {pass.metrics && metricsAligned && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden">
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Punct/100w</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.punctuationPer100Words.toFixed(1)}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Sentences</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.sentences}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Transitions</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.transitions}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Rhythm CV</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.rhythmCV.toFixed(2)}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Keywords</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.keywords}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Synonym Rate</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{(pass.metrics.synonymRate * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Grammar Issues</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.grammarIssues}</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="text-xs text-muted-foreground font-medium">Edits/100w</div>
                  <div className="text-sm text-foreground font-semibold mt-1">{pass.metrics.editsPer100Words.toFixed(1)}</div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Toggle for metrics alignment */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="metricsToggle"
              checked={metricsAligned}
              onChange={(e) => setMetricsAligned(e.target.checked)}
              className="rounded w-4 h-4 cursor-pointer"
            />
            <label htmlFor="metricsToggle" className="text-muted-foreground text-sm cursor-pointer select-none">
              Show detailed metrics
            </label>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {passData.filter((p) => p.stages.every((s) => s.status === "completed")).length} of {passData.length} passes completed
          </div>
        </div>
      </CardContent>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="fixed z-50 p-3 bg-popover backdrop-blur-sm border border-border rounded-lg text-xs text-foreground pointer-events-none shadow-lg"
          style={{
            left: showTooltip.x + 10,
            top: showTooltip.y - 10,
          }}
        >
          <div className="font-semibold text-foreground mb-2">Pass {showTooltip.passNumber} Metrics</div>
          {passData.find((p) => p.passNumber === showTooltip.passNumber)?.metrics && (
            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Change:</span>
                <span className="font-medium">
                  {passData.find((p) => p.passNumber === showTooltip.passNumber)?.sparklineData.changePercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tension:</span>
                <span className="font-medium">
                  {passData.find((p) => p.passNumber === showTooltip.passNumber)?.sparklineData.tensionPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Risk:</span>
                <span className="font-medium">
                  {passData.find((p) => p.passNumber === showTooltip.passNumber)?.sparklineData.previousPassRisk.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}