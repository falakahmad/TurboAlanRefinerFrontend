"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { refinerClient } from "@/lib/refiner-client"
import { useProcessing } from "@/contexts/ProcessingContext"

interface BatchResult {
  id: string
  sessionId: string
  timestamp: Date
  totalFiles: number
  completedFiles: number
  failedFiles: number
  totalPasses: number
  averageRiskReduction: number
  processingTime: number
  outputFiles: Array<{
    originalName: string
    passes: number
    finalPath: string
    driveId?: string
    riskReduction: number
    status: "completed" | "failed"
  }>
  sessionSettings: {
    aggressiveness: string
    targetRisk: number
    schemaLevels: Record<string, number>
  }
}

export default function BatchResults() {
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { processingEvents } = useProcessing()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  // Load batch results from API and processing events
  useEffect(() => {
    const loadBatchResults = async () => {
      try {
        setLoading(true)
        const jobs = await refinerClient.getJobs()
        
        // Group jobs by session/batch and transform to batch results
        const jobMap = new Map<string, BatchResult>()
        
        jobs.jobs?.forEach((job: any) => {
          const sessionId = job.sessionId || `session_${job.id}`
          const batchId = job.batchId || `batch_${job.id}`
          
          if (!jobMap.has(batchId)) {
            jobMap.set(batchId, {
              id: batchId,
              sessionId,
              timestamp: new Date(job.createdAt || job.timestamp || Date.now()),
              totalFiles: 0,
              completedFiles: 0,
              failedFiles: 0,
              totalPasses: 0,
              averageRiskReduction: 0,
              processingTime: job.processingTime || 0,
              outputFiles: [],
              sessionSettings: {
                aggressiveness: job.aggressiveness || job.settings?.aggressiveness || "medium",
                targetRisk: job.targetRisk || job.settings?.scannerRisk || 20,
                schemaLevels: job.schemaLevels || job.settings?.schemaLevels || {},
              },
            })
          }
          
          const batch = jobMap.get(batchId)!
          batch.totalFiles++
          batch.totalPasses += job.passes || 0
          
          if (job.status === "completed") {
            batch.completedFiles++
            batch.outputFiles.push({
              originalName: job.fileName || job.originalName || "Unknown file",
              passes: job.passes || 0,
              finalPath: job.outputPath || job.finalPath || "",
              driveId: job.driveId,
              riskReduction: job.riskReduction || job.metrics?.scannerRisk ? (100 - job.metrics.scannerRisk) : 0,
              status: "completed",
            })
          } else if (job.status === "failed") {
            batch.failedFiles++
            batch.outputFiles.push({
              originalName: job.fileName || job.originalName || "Unknown file",
              passes: 0,
              finalPath: "",
              riskReduction: 0,
              status: "failed",
            })
          }
        })
        
        // Also process current processing events to get real-time data
        const eventMap = new Map<string, BatchResult>()
        processingEvents.forEach(event => {
          if (event.type === "pass_complete" && event.fileId && event.fileName) {
            const sessionId = `live_session_${event.jobId}`
            const batchId = `live_batch_${event.jobId}`
            
            if (!eventMap.has(batchId)) {
              eventMap.set(batchId, {
                id: batchId,
                sessionId,
                timestamp: new Date(),
                totalFiles: 0,
                completedFiles: 0,
                failedFiles: 0,
                totalPasses: 0,
                averageRiskReduction: 0,
                processingTime: 0,
                outputFiles: [],
                sessionSettings: {
                  aggressiveness: "medium",
                  targetRisk: 20,
                  schemaLevels: {},
                },
              })
            }
            
            const batch = eventMap.get(batchId)!
            if (!batch.outputFiles.find(f => f.originalName === event.fileName)) {
              batch.totalFiles++
              batch.completedFiles++
              batch.totalPasses += event.pass || 0
              batch.outputFiles.push({
                originalName: event.fileName,
                passes: event.pass || 0,
                finalPath: event.outputPath || (event as any).metrics?.localPath || "",
                riskReduction: event.metrics?.scannerRisk ? (100 - event.metrics.scannerRisk) : 0,
                status: "completed",
              })
            }
          }
        })
        
        // Merge API data with live event data
        const allBatches = [...Array.from(jobMap.values()), ...Array.from(eventMap.values())]
        
        // Calculate averages for each batch
        allBatches.forEach(batch => {
          if (batch.completedFiles > 0) {
            batch.averageRiskReduction = batch.outputFiles
              .filter(f => f.status === "completed")
              .reduce((sum, f) => sum + f.riskReduction, 0) / batch.completedFiles
          }
        })
        
        setBatchResults(allBatches.sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        ))
      } catch (err) {
        console.error("Failed to load batch results:", err)
        setError("Failed to load batch results")
      } finally {
        setLoading(false)
      }
    }

    loadBatchResults()
  }, [processingEvents])

  // Listen for processing completion events to refresh batch results
  useEffect(() => {
    const handleProcessingComplete = () => {
      console.log("🔔 BatchResults: Processing complete event received, will re-render via processingEvents dependency")
      // No need to do anything here - the processingEvents useEffect above will handle it
    }

    window.addEventListener("refiner-processing-complete", handleProcessingComplete)
    return () => window.removeEventListener("refiner-processing-complete", handleProcessingComplete)
  }, [])

  const filteredResults = batchResults.filter(
    (batch) =>
      batch.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.outputFiles.some((file) => file.originalName.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const downloadBatchFiles = async (batchId: string) => {
    const batch = batchResults.find((b) => b.id === batchId)
    if (batch) {
      try {
        // Download all completed files from the batch
        for (const file of batch.outputFiles.filter(f => f.status === "completed")) {
          if (file.driveId) {
            const result = await refinerClient.downloadDriveFile(file.driveId)
            if (result.downloadUrl) {
              window.open(result.downloadUrl, '_blank')
            }
          } else {
            // Download local file
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(file.finalPath)}`)
            if (response.ok) {
              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = file.originalName
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
            }
          }
        }
      } catch (error) {
        console.error("Batch download failed:", error)
      }
    }
  }

  const downloadSingleFile = async (filePath: string, fileName: string, driveId?: string) => {
    try {
      if (driveId) {
        const result = await refinerClient.downloadDriveFile(driveId)
        if (result.downloadUrl) {
          window.open(result.downloadUrl, '_blank')
        }
      } else {
        const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`)
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          console.error('Download failed:', response.statusText)
        }
      }
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const exportSessionJSON = (batchId: string) => {
    const batch = batchResults.find((b) => b.id === batchId)
    if (batch) {
      const sessionData = {
        sessionId: batch.sessionId,
        timestamp: batch.timestamp,
        settings: batch.sessionSettings,
        results: {
          totalFiles: batch.totalFiles,
          completedFiles: batch.completedFiles,
          failedFiles: batch.failedFiles,
          totalPasses: batch.totalPasses,
          averageRiskReduction: batch.averageRiskReduction,
          processingTime: batch.processingTime,
        },
        outputFiles: batch.outputFiles,
      }

      const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `session_${batch.sessionId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const getStatusColor = (status: "completed" | "failed") => {
    return status === "completed"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-red-100 text-red-800 border-red-200"
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <div className="w-8 h-8 mx-auto mb-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="text-muted-foreground">Loading batch results...</div>
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
            <div className="text-red-600 mb-2">Error loading batch results</div>
            <div className="text-muted-foreground text-sm">{error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Batch Results</CardTitle>
              <CardDescription className="text-muted-foreground">
                View and download results from processing sessions
              </CardDescription>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">{batchResults.length} sessions</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search by session ID or file name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              variant="ghost"
              onClick={() => setSearchTerm("")}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-12">
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
              <p className="text-muted-foreground text-sm">No batch results found</p>
              <p className="text-muted-foreground text-xs mt-1">Process some files to see results here</p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((batch) => (
            <Card key={batch.id} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-card-foreground">{batch.sessionId}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {batch.timestamp.toLocaleString()} • {formatDuration(batch.processingTime)} processing time
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportSessionJSON(batch.id)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export JSON
                    </Button>
                    <Button
                      onClick={() => setSelectedBatch(selectedBatch === batch.id ? null : batch.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {selectedBatch === batch.id ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-3 bg-muted rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{batch.completedFiles}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-700">{batch.failedFiles}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-700">{batch.totalPasses}</div>
                    <div className="text-xs text-muted-foreground">Total Passes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-700">{batch.averageRiskReduction.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Avg Risk Reduction</div>
                  </div>
                  <div className="flex items-center justify-center md:justify-end">
                    <Button
                      onClick={() => downloadBatchFiles(batch.id)}
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                    >
                      Download All
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedBatch === batch.id && (
                  <div className="space-y-4">
                    {/* Session Settings */}
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="text-foreground font-medium text-sm mb-2">Session Settings</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Aggressiveness:</span>
                          <span className="text-foreground ml-2">{batch.sessionSettings.aggressiveness}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Target Risk:</span>
                          <span className="text-foreground ml-2">{batch.sessionSettings.targetRisk}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Schema Levels:</span>
                          <span className="text-foreground ml-2">
                            {Object.keys(batch.sessionSettings.schemaLevels).length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Output Files */}
                    <div className="space-y-2">
                      <h4 className="text-foreground font-medium text-sm">Output Files</h4>
                      <div className="space-y-2">
                        {batch.outputFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted rounded border border-border"
                          >
                            <div className="flex items-center space-x-3">
                              <Badge className={getStatusColor(file.status)}>{file.status}</Badge>
                              <div>
                                <div className="text-foreground text-sm font-medium">{file.originalName}</div>
                                <div className="text-muted-foreground text-xs">
                                  {file.passes} passes • {file.riskReduction.toFixed(1)}% risk reduction
                                  {file.driveId && " • Google Drive"}
                                </div>
                              </div>
                            </div>
                            {file.status === "completed" && (
                              <Button
                                size="sm"
                                onClick={() => downloadSingleFile(file.finalPath, file.originalName, file.driveId)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                Download
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
