"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useProcessing } from "@/contexts/ProcessingContext"
import { refinerClient } from "@/lib/refiner-client"

export interface ProcessedFile {
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
  }>
  processingTime: number
  finalMetrics: {
    changePercent: number
    riskScore: number
    qualityScore: number
  }
  lastUpdated?: number
}

/**
 * Centralized hook for managing processed files from both events and API
 * Provides synchronized data across ResultsViewer, BatchResults, and DiffViewer
 */
export function useResultStore() {
  const { processingEvents } = useProcessing()
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transform processing events into processed files
  const transformEventsToFiles = useCallback(() => {
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
        lastUpdated: Date.now(),
      }

      switch (event.type) {
        case "pass_start":
          existing.passes = Math.max(existing.passes, event.pass || 0)
          existing.status = "processing"
          break
        case "pass_complete":
          if (event.pass && event.outputPath) {
            const existingOutput = existing.outputFiles.find(o => o.passNumber === event.pass)
            if (!existingOutput) {
              existing.outputFiles.push({
                passNumber: event.pass,
                fileName: `${event.fileName}_pass${event.pass}.txt`,
                path: event.outputPath,
                driveId: (event as any).driveId,
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
          existing.lastUpdated = Date.now()
          break
        case "complete":
          existing.status = "completed"
          existing.riskReduction = event.metrics?.scannerRisk ? 
            (100 - event.metrics.scannerRisk) : existing.riskReduction
          existing.finalMetrics = {
            changePercent: event.metrics?.changePercent || existing.finalMetrics.changePercent,
            riskScore: event.metrics?.scannerRisk || existing.finalMetrics.riskScore,
            qualityScore: event.metrics?.tensionPercent || existing.finalMetrics.qualityScore,
          }
          existing.lastUpdated = Date.now()
          break
        case "error":
          existing.status = "error"
          existing.lastUpdated = Date.now()
          break
      }

      fileMap.set(event.fileId, existing)
    })

    return Array.from(fileMap.values())
  }, [processingEvents])

  // Load data from both events and API
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get files from processing events
      const eventFiles = transformEventsToFiles()
      
      // Get completed jobs from API
      let apiFiles: ProcessedFile[] = []
      try {
        const jobs = await refinerClient.getJobs()
        apiFiles = (jobs.jobs || []).map((job: any) => ({
          id: job.id || job.fileId || `job_${job.id}`,
          originalName: job.fileName || "Unknown file",
          passes: job.passes || 0,
          status: job.status === "completed" ? "completed" : 
                 job.status === "failed" ? "error" : "processing",
          riskReduction: job.riskReduction || 
                        (job.metrics?.scannerRisk ? (100 - job.metrics.scannerRisk) : 0),
          outputFiles: Array.isArray(job.outputFiles) 
            ? job.outputFiles.map((o: any) => ({
                passNumber: o.passNumber || o.pass || 0,
                fileName: o.fileName || `${job.fileName}_pass${o.passNumber || o.pass || 0}.txt`,
                path: o.path || o.localPath || o.outputPath || "",
                driveId: o.driveId,
              }))
            : [],
          processingTime: job.processingTime || 0,
          finalMetrics: {
            changePercent: job.changePercent || job.metrics?.changePercent || 0,
            riskScore: job.riskScore || job.metrics?.scannerRisk || 0,
            qualityScore: job.qualityScore || job.metrics?.tensionPercent || 0,
          },
          lastUpdated: new Date(job.updatedAt || job.timestamp || Date.now()).getTime(),
        }))
      } catch (apiError) {
        console.error("Failed to load completed jobs:", apiError)
        // Continue with event files only
      }
      
      // Merge files, prioritizing events over API for the same ID (events are more recent)
      const mergedFiles = new Map<string, ProcessedFile>()
      
      // Add API files first
      apiFiles.forEach(file => {
        mergedFiles.set(file.id, file)
      })
      
      // Override with event files (more recent data)
      eventFiles.forEach(file => {
        const existing = mergedFiles.get(file.id)
        if (existing) {
          // Merge output files, avoiding duplicates
          const outputFileMap = new Map<number, ProcessedFile["outputFiles"][0]>()
          existing.outputFiles.forEach(o => outputFileMap.set(o.passNumber, o))
          file.outputFiles.forEach(o => outputFileMap.set(o.passNumber, o))
          
          mergedFiles.set(file.id, {
            ...file,
            outputFiles: Array.from(outputFileMap.values()).sort((a, b) => a.passNumber - b.passNumber),
            // Use latest metrics
            finalMetrics: file.finalMetrics.changePercent > 0 ? file.finalMetrics : existing.finalMetrics,
            lastUpdated: Math.max(existing.lastUpdated || 0, file.lastUpdated || 0),
          })
        } else {
          mergedFiles.set(file.id, file)
        }
      })
      
      setProcessedFiles(Array.from(mergedFiles.values()).sort((a, b) => 
        (b.lastUpdated || 0) - (a.lastUpdated || 0)
      ))
    } catch (err) {
      console.error("Failed to load data:", err)
      setError("Failed to load job results")
    } finally {
      setLoading(false)
    }
  }, [transformEventsToFiles])

  // Initial load
  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Listen for processing completion events to refresh data
  useEffect(() => {
    const handleProcessingComplete = () => {
      loadAllData()
    }

    window.addEventListener("refiner-processing-complete", handleProcessingComplete)
    return () => window.removeEventListener("refiner-processing-complete", handleProcessingComplete)
  }, [loadAllData])

  // Generate progress data from processing events for a specific file
  const generateProgressData = useCallback((fileId: string) => {
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
  }, [processingEvents])

  // Memoized file lookup
  const getFileById = useCallback((fileId: string) => {
    return processedFiles.find(f => f.id === fileId) || null
  }, [processedFiles])

  return {
    processedFiles,
    loading,
    error,
    generateProgressData,
    getFileById,
    refresh: loadAllData,
  }
}

