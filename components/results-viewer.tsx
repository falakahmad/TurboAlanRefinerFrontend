"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import ProgressTracker from "@/components/progress-tracker"
// Temporarily commented out until fixed
// import AnalyticsDashboard from "@/components/analytics-dashboard"
import BatchResults from "@/components/batch-results"
import DiffViewer from "@/components/diff-viewer"
import { useProcessing } from "@/contexts/ProcessingContext"
import { refinerClient } from "@/lib/refiner-client"
import { formatFilePath } from "@/lib/path-utils"

interface ProcessedFile {
  id: string
  originalName: string
  passes: number
  status: "completed" | "processing" | "error"
  riskReduction: number
  outputFiles: Array<{
    passNumber: number
    fileName: string
    path: string
    driveId?: string
    textContent?: string
  }>
  processingTime: number
  finalMetrics: {
    changePercent: number
    riskScore: number
    qualityScore: number
  }
}

export default function ResultsViewer() {
  // Temporarily removed "analytics" from activeView until fixed
  const [activeView, setActiveView] = useState<"results" | "batch" | "diff">("results")
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFileForDiff, setSelectedFileForDiff] = useState<ProcessedFile | null>(null)
  const { processingEvents } = useProcessing()

  // Combined data loading from both events and API
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true)
        
        // Transform processing events into processed files
        const transformEventsToFiles = () => {
          const fileMap = new Map<string, ProcessedFile>()
          
          processingEvents.forEach(event => {
            if (!event.fileId || !event.fileName) return
            
            const existing = fileMap.get(event.fileId) || {
              id: event.fileId,
              originalName: event.fileName,
              passes: 0,
              status: "processing" as const,
              riskReduction: 0,
              outputFiles: [],
              processingTime: 0,
              finalMetrics: {
                changePercent: 0,
                riskScore: 0,
                qualityScore: 0,
              },
            }

            switch (event.type) {
              case "pass_start":
                existing.passes = Math.max(existing.passes, event.pass || 0)
                break
              case "pass_complete":
                if (event.pass && (event.outputPath || (event as any).metrics?.localPath || (event as any).textContent)) {
                  // CRITICAL FIX: Check for duplicate pass before adding
                  const existingOutput = existing.outputFiles.find(o => o.passNumber === event.pass)
                  if (!existingOutput) {
                    // CRITICAL FIX: Preserve original file extension instead of hardcoding .txt
                    const outputPath = event.outputPath || (event as any).metrics?.localPath || ''
                    const pathExt = outputPath.split('.').pop()?.toLowerCase()
                    const origExt = event.fileName?.split('.').pop()?.toLowerCase()
                    const fileExt = (pathExt && ['docx', 'doc', 'pdf', 'txt', 'md'].includes(pathExt)) 
                      ? `.${pathExt}` 
                      : (origExt && ['docx', 'doc', 'pdf', 'txt', 'md'].includes(origExt))
                        ? `.${origExt}`
                        : '.txt'
                    const baseFileName = event.fileName?.replace(/\.[^/.]+$/, '') || 'file'
                    
                    existing.outputFiles.push({
                      passNumber: event.pass,
                      fileName: `${baseFileName}_pass${event.pass}${fileExt}`,
                      path: outputPath,
                      textContent: (event as any).textContent
                    })
                  }
                }
                // Update metrics from pass completion
                if (event.metrics) {
                  existing.finalMetrics = {
                    changePercent: event.metrics.changePercent || existing.finalMetrics.changePercent,
                    riskScore: event.metrics.scannerRisk || existing.finalMetrics.riskScore,
                    qualityScore: event.metrics.tensionPercent || existing.finalMetrics.qualityScore,
                  }
                }
                break
              case "complete":
              case "stream_end":
                existing.status = "completed"
                existing.riskReduction = event.metrics?.scannerRisk ? 
                  (100 - event.metrics.scannerRisk) : 0
                existing.finalMetrics = {
                  changePercent: event.metrics?.changePercent || 0,
                  riskScore: event.metrics?.scannerRisk || 0,
                  qualityScore: event.metrics?.tensionPercent || 0,
                }
                break
              case "error":
                existing.status = "error"
                break
            }

            fileMap.set(event.fileId, existing)
          })

          return Array.from(fileMap.values())
        }

        // Get files from processing events
        const eventFiles = transformEventsToFiles()
        
        // Get completed jobs from API
        let apiFiles: ProcessedFile[] = []
        try {
          const jobs = await refinerClient.getJobs()
          apiFiles = jobs.jobs?.map((job: any) => ({
            id: job.id,
            originalName: job.fileName || "Unknown file",
            passes: job.passes || 0,
            status: job.status === "completed" ? "completed" : 
                   job.status === "failed" ? "error" : "processing",
            riskReduction: job.riskReduction || 0,
            outputFiles: job.outputFiles || [],
            processingTime: job.processingTime || 0,
            finalMetrics: {
              changePercent: job.changePercent || 0,
              riskScore: job.riskScore || 0,
              qualityScore: job.qualityScore || 0,
            },
          })) || []
        } catch (apiError) {
          
          // Continue with event files only
        }
        
        // Filter out incomplete/empty files from API
        const validApiFiles = apiFiles.filter(file => {
          // Only include files that have a proper name (not "Unknown file") and have some data
          return file.originalName && 
                 file.originalName !== "Unknown file" && 
                 (file.passes > 0 || file.status === "completed" || file.status === "error")
        })
        
        // Filter out incomplete/empty files from events
        const validEventFiles = eventFiles.filter(file => {
          return file.originalName && 
                 file.originalName !== "Unknown file" &&
                 (file.passes > 0 || file.status === "completed" || file.status === "error" || file.outputFiles.length > 0)
        })
        
        // Merge files, intelligently combining API and event data
        const mergedFiles = new Map<string, ProcessedFile>()
        
        // Add valid API files first
        validApiFiles.forEach(file => {
          mergedFiles.set(file.id, file)
        })
        
        // Merge (don't blindly override) with event files
        validEventFiles.forEach(eventFile => {
          const existing = mergedFiles.get(eventFile.id)
          if (existing) {
            // Merge: keep API data but update with event data where appropriate
            mergedFiles.set(eventFile.id, {
              ...existing,
              status: eventFile.status !== "processing" ? eventFile.status : existing.status,
              passes: Math.max(eventFile.passes, existing.passes),
              outputFiles: eventFile.outputFiles.length > 0 ? eventFile.outputFiles : existing.outputFiles,
              finalMetrics: {
                changePercent: eventFile.finalMetrics.changePercent || existing.finalMetrics.changePercent,
                riskScore: eventFile.finalMetrics.riskScore || existing.finalMetrics.riskScore,
                qualityScore: eventFile.finalMetrics.qualityScore || existing.finalMetrics.qualityScore,
              },
              riskReduction: eventFile.riskReduction || existing.riskReduction,
              processingTime: eventFile.processingTime || existing.processingTime,
            })
          } else {
            // New file from events
            mergedFiles.set(eventFile.id, eventFile)
          }
        })
        
        // Additional deduplication: remove files with same name but different IDs
        // Keep the one with more complete data
        const nameMap = new Map<string, ProcessedFile>()
        Array.from(mergedFiles.values()).forEach(file => {
          const existing = nameMap.get(file.originalName)
          if (!existing) {
            nameMap.set(file.originalName, file)
          } else {
            // Keep the one with more passes, output files, or completed status
            const currentScore = (file.passes * 10) + file.outputFiles.length + (file.status === "completed" ? 100 : 0)
            const existingScore = (existing.passes * 10) + existing.outputFiles.length + (existing.status === "completed" ? 100 : 0)
            if (currentScore > existingScore) {
              nameMap.set(file.originalName, file)
            }
          }
        })
        
        // Sanitize: de-duplicate outputFiles per file (proxy can double-deliver events)
        const sanitized = Array.from(nameMap.values()).map(file => {
          const seen = new Set<string>()
          const uniqueOutputs = [] as ProcessedFile["outputFiles"]
          for (const out of file.outputFiles) {
            const k = `${out.passNumber}|${out.path || out.fileName}`
            if (seen.has(k)) continue
            seen.add(k)
            uniqueOutputs.push(out)
          }
          uniqueOutputs.sort((a, b) => a.passNumber - b.passNumber)
          return { ...file, outputFiles: uniqueOutputs }
        })
        
        // Final filter: remove files that are truly empty/incomplete
        const finalFiles = sanitized.filter(file => {
          return file.originalName && 
                 file.originalName !== "Unknown file" &&
                 (file.passes > 0 || file.outputFiles.length > 0 || file.status === "completed" || file.status === "error")
        })
        
        setProcessedFiles(finalFiles)
      } catch (err) {
        
        setError("Failed to load job results")
      } finally {
        setLoading(false)
      }
    }

    loadAllData()
  }, [processingEvents])

  // Listen for processing completion events to refresh data
  useEffect(() => {
    const handleProcessingComplete = () => {
      console.log("🔔 ResultsViewer: Processing complete event received, will re-render via processingEvents dependency")
      // No need to do anything here - the processingEvents useEffect above will handle it
    }

    window.addEventListener("refiner-processing-complete", handleProcessingComplete)
    return () => window.removeEventListener("refiner-processing-complete", handleProcessingComplete)
  }, [])

  // Generate real progress data from processing events
  const generateProgressData = (fileId: string) => {
    const fileEvents = processingEvents.filter(event => event.fileId === fileId)
    const passMap = new Map<number, any>()
    
    fileEvents.forEach(event => {
      if (event.type === "stage_update" && event.pass) {
        if (!passMap.has(event.pass)) {
          passMap.set(event.pass, {
            passNumber: event.pass,
            stages: [],
      sparklineData: {
              changePercent: 0,
              tensionPercent: 0,
              normalizedLatency: 0,
              previousPassRisk: 0,
      },
          })
        }
        
        const passData = passMap.get(event.pass)
        const stageIndex = passData.stages.findIndex((s: any) => s.name === event.stage)
        
        if (stageIndex >= 0) {
          passData.stages[stageIndex] = {
            name: event.stage,
            status: event.status,
            duration: event.duration,
          }
        } else {
          passData.stages.push({
            name: event.stage,
            status: event.status,
            duration: event.duration,
          })
        }
      } else if (event.type === "pass_complete" && event.pass && event.metrics) {
        if (!passMap.has(event.pass)) {
          passMap.set(event.pass, {
            passNumber: event.pass,
            stages: [],
      sparklineData: {
              changePercent: 0,
              tensionPercent: 0,
              normalizedLatency: 0,
              previousPassRisk: 0,
            },
          })
        }
        
        const passData = passMap.get(event.pass)
        passData.sparklineData = {
          changePercent: event.metrics.changePercent || 0,
          tensionPercent: event.metrics.tensionPercent || 0,
          normalizedLatency: event.metrics.processingTime || 0,
          previousPassRisk: event.metrics.scannerRisk || 0,
        }
      }
    })
    
    return Array.from(passMap.values()).sort((a, b) => a.passNumber - b.passNumber)
  }

  const getStatusColor = (status: ProcessedFile["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const downloadFile = async (path: string, fileName: string, driveId?: string, textContent?: string) => {
    try {
      if (driveId) {
        // Download from Google Drive
        const result = await refinerClient.downloadDriveFile(driveId)
        if (result.downloadUrl) {
          window.open(result.downloadUrl, '_blank')
        } else {
          throw new Error('No download URL available')
        }
      } else if (textContent) {
        // Client-side download for text content (Vercel compatible)
        // CRITICAL FIX: textContent is always plain text, so use .txt extension
        // even if the original was .docx/.pdf - this avoids confusing users
        // who might expect a Word doc to open in Word
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // Use .txt extension since textContent is plain text
        const baseFileName = fileName?.replace(/\.[^/.]+$/, '') || 'download'
        a.download = `${baseFileName}.txt`
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }, 100)
      } else {
        // Download local file (via Next API route)
        // ... (rest of the existing logic)
        const response = await fetch(`/api/files/download?path=${encodeURIComponent(path)}`)
        if (response.ok) {
          // Get content type and filename from response headers
          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          const contentDisposition = response.headers.get('content-disposition') || ''
          
          // Extract filename from Content-Disposition header if available
          let downloadFileName = fileName || path.split('/').pop() || 'download'
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (filenameMatch && filenameMatch[1]) {
            // Remove quotes if present
            downloadFileName = filenameMatch[1].replace(/['"]/g, '')
            // Decode URI if it's encoded
            try {
              downloadFileName = decodeURIComponent(downloadFileName)
            } catch (e) {
              // If decoding fails, use as-is
            }
          }
          
          // Ensure file extension is preserved
          if (!downloadFileName.includes('.')) {
            const pathExt = path.split('.').pop()
            if (pathExt) {
              downloadFileName = `${downloadFileName}.${pathExt}`
            }
          }
          
          // Create blob with explicit type
          const blob = await response.blob()
          const typedBlob = new Blob([blob], { type: contentType })
          
          // Create download link with explicit download attribute
          const url = window.URL.createObjectURL(typedBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = downloadFileName
          a.style.display = 'none'
          // Force download attribute
          a.setAttribute('download', downloadFileName)
          document.body.appendChild(a)
          a.click()
          
          // Cleanup
          setTimeout(() => {
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
          }, 100)
        } else {
          const errorText = await response.text()
          // Check for Vercel ephemeral storage error
          if (response.status === 404 && (errorText.includes("FILE_NOT_FOUND") || errorText.includes("File not found"))) {
             throw new Error("File not found on server. This is expected on Vercel deployments due to ephemeral storage. Please use Google Drive output or copy the text from the Diff Viewer.")
          }
          throw new Error(`Download failed: ${response.statusText} - ${errorText}`)
        }
      }
    } catch (error) {
      console.error('Download error:', error)
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center space-x-2 p-1 bg-gray-100 rounded-lg">
        <Button
          variant={activeView === "results" ? "default" : "ghost"}
          onClick={() => setActiveView("results")}
          className={
            activeView === "results"
              ? "bg-yellow-400 text-black hover:bg-yellow-500 shadow-md"
              : "text-gray-700 hover:bg-white/80 hover:text-black"
          }
        >
          Results
        </Button>
        <Button
          variant={activeView === "batch" ? "default" : "ghost"}
          onClick={() => setActiveView("batch")}
          className={
            activeView === "batch"
              ? "bg-yellow-400 text-black hover:bg-yellow-500 shadow-md"
              : "text-gray-700 hover:bg-white/80 hover:text-black"
          }
        >
          Batch Results
        </Button>
        {/* Temporarily commented out Analytics tab until fixed */}
        {/* <Button
          variant={activeView === "analytics" ? "default" : "ghost"}
          onClick={() => setActiveView("analytics")}
          className={
            activeView === "analytics"
              ? "bg-yellow-400 text-black hover:bg-yellow-500 shadow-md"
              : "text-gray-700 hover:bg-white/80 hover:text-black"
          }
        >
            Analytics
          </Button> */}
        <Button
          variant={activeView === "diff" ? "default" : "ghost"}
          onClick={() => setActiveView("diff")}
          className={
            activeView === "diff"
              ? "bg-yellow-400 text-black hover:bg-yellow-500 shadow-md"
              : "text-gray-700 hover:bg-white/80 hover:text-black"
          }
        >
          Diff Viewer
        </Button>
      </div>

      {activeView === "results" ? (
        <div className="space-y-6">
          {/* Progress Tracker - Show for currently processing files */}
          {processedFiles.filter(f => f.status === "processing").map(file => (
            <ProgressTracker
              key={file.id}
              fileId={file.id}
              fileName={file.originalName}
              currentPass={file.passes}
              totalPasses={file.passes + 1}
              passData={generateProgressData(file.id)}
            />
          ))}

          {/* Loading State */}
          {loading && (
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">Loading results...</p>
                <p className="text-gray-500 text-sm mt-1">Fetching your processed files</p>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="bg-white border-red-200 shadow-lg">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">Error loading results</p>
                <p className="text-gray-500 text-sm mt-1">{error}</p>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="mt-4 bg-yellow-400 text-black hover:bg-yellow-500"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Processed Files */}
          {!loading && !error && processedFiles.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">No processed files yet</p>
                <p className="text-gray-500 text-sm mt-1">Start processing files to see results here</p>
              </CardContent>
            </Card>
          ) : !loading && !error && (
            <div className="space-y-4">
              {processedFiles.map((file) => (
                <Card key={file.id} className="bg-white border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-gray-900 flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          {file.originalName}
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                          {file.passes} passes • {file.processingTime.toFixed(1)}s processing time
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(file.status)}>{file.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Metrics Summary */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{file.riskReduction.toFixed(1)}%</div>
                        <div className="text-xs text-gray-600 font-medium">Risk Reduction</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {file.finalMetrics.changePercent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Content Changed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {file.finalMetrics.qualityScore.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Quality Score</div>
                      </div>
                    </div>

                    {/* Output Files */}
                    {file.outputFiles.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
                          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Generated Files
                        </h4>
                        <div className="space-y-2">
                          {file.outputFiles.map((output) => (
                            <div
                              key={`${output.passNumber}-${output.path || output.fileName}`}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <Badge variant="outline" className="text-gray-700 border-gray-300 bg-white">
                                  Pass {output.passNumber}
                                </Badge>
                                <span className="text-gray-900 text-sm font-medium">{output.fileName}</span>
                              </div>
                              <div className="flex space-x-2">
                                {(() => {
                                  const downloadable = Boolean(output.path) || Boolean(output.driveId)
                                  return (
                                    <Button
                                      size="sm"
                                      onClick={() => downloadable && downloadFile(output.path, output.fileName, output.driveId, output.textContent)}
                                      disabled={!downloadable && !output.textContent}
                                      className={`shadow-sm ${downloadable || output.textContent ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                      </svg>
                                      {downloadable ? 'Download' : 'Not downloadable'}
                                    </Button>
                                  )
                                })()}
                                {file.outputFiles.length > 1 && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedFileForDiff(file)
                                      setActiveView("diff")
                                    }}
                                    className="bg-blue-400 text-white hover:bg-blue-500 shadow-sm"
                                  >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    Compare
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : activeView === "batch" ? (
        <BatchResults />
      ) : activeView === "diff" ? (
        <div className="space-y-6">
          {selectedFileForDiff ? (
            <DiffViewer
              fileId={selectedFileForDiff.id}
              fileName={selectedFileForDiff.originalName}
              availablePasses={selectedFileForDiff.outputFiles.map(f => f.passNumber)}
            />
          ) : (
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium">Select a file to compare</p>
                <p className="text-gray-500 text-sm mt-1">Choose a file with multiple passes to view differences</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // Temporarily commented out AnalyticsDashboard until fixed
        // <AnalyticsDashboard />
        <div className="text-center py-12 text-gray-500">
          Analytics tab temporarily disabled
        </div>
      )}
    </div>
  )
}
