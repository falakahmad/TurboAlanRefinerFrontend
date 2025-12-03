"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { refinerClient } from "@/lib/refiner-client"

interface LogEntry {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "DEBUG"
  message: string
}

const parseLogLine = (line: string): LogEntry | null => {
  if (!line || !line.trim()) return null
  
  let timestamp = new Date().toISOString()
  let level: LogEntry["level"] = "INFO"
  let message = line.trim()
  
  // Format 1: "2025-11-15T02:39:04Z [INFO] api.main: message" (ISO format with brackets)
  // Format 2: "2025-11-15 03:20:10,132 - api.main - INFO - message" (standard Python logging)
  // Format 3: "2025-11-15 02:52:47,614 - refiner - INFO - message" (alternative)
  
  const isoTimestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/)
  const standardTimestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})/)
  
  if (isoTimestampMatch) {
    timestamp = isoTimestampMatch[1]
  } else if (standardTimestampMatch) {
    // Convert "2025-11-15 03:20:10,132" to ISO format
    const ts = standardTimestampMatch[1].replace(',', '.').replace(' ', 'T') + 'Z'
    timestamp = ts
  }
  
  // Try to find log level in brackets first: [INFO], [ERROR], etc.
  const bracketLevelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG|WARNING)\]/i)
  if (bracketLevelMatch) {
    const levelStr = bracketLevelMatch[1].toUpperCase()
    if (levelStr === "WARNING") {
      level = "WARN"
    } else if (["INFO", "WARN", "ERROR", "DEBUG"].includes(levelStr)) {
      level = levelStr as LogEntry["level"]
    }
    
    // Extract message after the level bracket
    const levelIndex = line.indexOf(bracketLevelMatch[0])
    if (levelIndex !== -1) {
      const afterBracket = line.substring(levelIndex + bracketLevelMatch[0].length)
      const colonIndex = afterBracket.indexOf(":")
      if (colonIndex !== -1) {
        message = afterBracket.substring(colonIndex + 1).trim()
      } else {
        message = afterBracket.trim()
      }
    }
  } else {
    // Try format 2/3: " - logger - INFO - message" or " - api.main - INFO - message"
    // Pattern: timestamp - logger_name - LEVEL - message
    const dashLevelMatch = line.match(/ - [\w.]+ - (INFO|WARN|ERROR|DEBUG|WARNING) - /i)
    if (dashLevelMatch) {
      const levelStr = dashLevelMatch[1].toUpperCase()
      if (levelStr === "WARNING") {
        level = "WARN"
      } else if (["INFO", "WARN", "ERROR", "DEBUG"].includes(levelStr)) {
        level = levelStr as LogEntry["level"]
      }
      
      // Extract message after the dash level pattern
      const dashIndex = line.indexOf(dashLevelMatch[0])
      if (dashIndex !== -1) {
        message = line.substring(dashIndex + dashLevelMatch[0].length).trim()
      }
    }
  }
  
  // If message is still the whole line, try to extract just the meaningful part
  if (message === line.trim() && message.length > 100) {
    // For very long lines, try to find the actual message part
    const jsonMatch = message.match(/\{.*\}/)
    if (jsonMatch) {
      message = jsonMatch[0]
    }
  }
  
  return { timestamp, level, message: message || line }
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await refinerClient.getLogs(200)
      
      // Check for error in response
      if ((response as any)?.error) {
        setError(`Failed to load logs: ${(response as any).error}`)
        setLogs([])
        return
      }
      
      const rawLines = Array.isArray((response as any)?.lines) ? (response as any).lines as string[] : []
      const structured = Array.isArray((response as any)?.logs) ? (response as any).logs as LogEntry[] : []
      
      // Parse raw log lines into structured entries
      const parsedLines: LogEntry[] = rawLines
        .map(parseLogLine)
        .filter((entry): entry is LogEntry => entry !== null)
      
      const merged = structured.length > 0 ? structured : parsedLines
      setLogs(merged)
      
      // If no logs and no error, log file might be empty
      if (merged.length === 0 && rawLines.length === 0) {
        setError("No logs found. Log file may be empty or not yet created.")
      }
    } catch (error) {
      console.error("Failed to load logs:", error)
      setError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, loadLogs])

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "ERROR":
        return "bg-red-500/20 text-red-600 border-red-500/30"
      case "WARN":
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
      case "INFO":
        return "bg-blue-500/20 text-blue-600 border-blue-500/30"
      case "DEBUG":
        return "bg-gray-500/20 text-gray-600 border-gray-500/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const safeLogs = Array.isArray(logs) ? logs : []

  const filteredLogs = safeLogs.filter((log) => {
    if (filter === "all") return true
    return log.level === filter
  })

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">System Logs</CardTitle>
            <CardDescription className="text-muted-foreground">
              Real-time processing logs and system events
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="autoRefresh" className="text-muted-foreground text-sm">
                Auto-refresh
              </label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground text-sm">Filter:</span>
          {["all", "ERROR", "WARN", "INFO", "DEBUG"].map((level) => (
            <Button
              key={level}
              variant={filter === level ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(level)}
              className={
                filter === level
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
              }
            >
              {level.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Log Entries */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {error && (
            <div className="text-center py-4">
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</p>
            </div>
          )}
          {!error && filteredLogs.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No logs found</p>
              <p className="text-muted-foreground text-xs mt-2">Logs will appear here as the system processes files.</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded text-sm">
                <Badge className={`${getLevelColor(log.level)} text-xs`}>{log.level}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground break-words">{log.message}</div>
                  <div className="text-muted-foreground text-xs mt-1">{formatTimestamp(log.timestamp)}</div>
                </div>
              </div>
            ))
          ) : null}
        </div>

        {/* Log Statistics */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Showing {filteredLogs.length} of {safeLogs.length} entries
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <span className="text-red-600">{safeLogs.filter((l) => l.level === "ERROR").length} errors</span>
            <span className="text-yellow-600">{safeLogs.filter((l) => l.level === "WARN").length} warnings</span>
            <span className="text-blue-600">{safeLogs.filter((l) => l.level === "INFO").length} info</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
