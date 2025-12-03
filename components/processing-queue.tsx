"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useProcessing } from "@/contexts/ProcessingContext"
import { ProcessingEvent } from "@/lib/refiner-client"

interface QueueItem {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "error"
  progress: number
  currentPass: number
  totalPasses: number
  lastEvent?: ProcessingEvent
}

export default function ProcessingQueue() {
  const { processingEvents, isProcessing, clearProcessingEvents } = useProcessing()
  const [queue, setQueue] = useState<QueueItem[]>([])

  // Convert processing events to queue items
  useEffect(() => {
    const queueMap = new Map<string, QueueItem>()
    
    processingEvents.forEach(event => {
      if (!event.fileId || !event.fileName) return
      
      const existing = queueMap.get(event.fileId) || {
        id: event.fileId,
        name: event.fileName,
        status: "pending" as const,
        progress: 0,
        currentPass: 0,
        totalPasses: event.totalPasses || 1,
        lastEvent: event
      }

      // Update based on event type
      switch (event.type) {
        case "pass_start":
          existing.status = "processing"
          existing.currentPass = event.pass || 0
          existing.totalPasses = event.totalPasses || existing.totalPasses
          existing.progress = Math.round(((event.pass || 0) / existing.totalPasses) * 100)
          break
        case "stage_update":
          if (event.stage === "upload" && event.status === "completed") {
            existing.status = "completed"
            existing.progress = 100
          }
          break
        case "error":
          existing.status = "error"
          break
        case "complete":
          existing.status = "completed"
          existing.progress = 100
          break
      }

      existing.lastEvent = event
      queueMap.set(event.fileId, existing)
    })

    setQueue(Array.from(queueMap.values()))
  }, [processingEvents])

  const clearQueue = () => {
    clearProcessingEvents() // Clear the underlying events
    setQueue([])
  }

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const reorderItem = (id: string, direction: "up" | "down") => {
    setQueue((prev) => {
      const index = prev.findIndex((item) => item.id === id)
      if (index === -1) return prev

      const newQueue = [...prev]
      if (direction === "up" && index > 0) {
        ;[newQueue[index], newQueue[index - 1]] = [newQueue[index - 1], newQueue[index]]
      } else if (direction === "down" && index < newQueue.length - 1) {
        ;[newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]]
      }
      return newQueue
    })
  }

  const getStatusColor = (status: QueueItem["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-600 border-green-500/30"
      case "processing":
        return "bg-blue-500/20 text-blue-600 border-blue-500/30"
      case "error":
        return "bg-red-500/20 text-red-600 border-red-500/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Processing Queue</CardTitle>
            <CardDescription className="text-muted-foreground">Manage and monitor file processing</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-foreground border-border">
              {queue.length} files
            </Badge>
            {queue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearQueue}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-muted-foreground text-sm">No files in queue</p>
            <p className="text-muted-foreground/70 text-xs mt-1">Add files to start processing</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, index) => (
              <div key={item.id} className="p-4 bg-muted rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-muted-foreground text-xs font-mono">#{index + 1}</span>
                    <span className="text-foreground text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reorderItem(item.id, "up")}
                        disabled={index === 0}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reorderItem(item.id, "down")}
                        disabled={index === queue.length - 1}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>

                {item.status === "processing" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Pass {item.currentPass} of {item.totalPasses}
                      </span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.status === "completed" && (
                  <div className="text-xs text-green-600">Completed {item.totalPasses} passes • Ready for download</div>
                )}

                {item.status === "error" && (
                  <div className="text-xs text-red-600">Processing failed • Check logs for details</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
