"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { refinerClient } from "@/lib/refiner-client"
import { useProcessing } from "@/contexts/ProcessingContext"

interface DiffChange {
  type: "insert" | "delete" | "replace"
  originalText: string
  newText: string
  position: { start: number; end: number }
}

interface DiffData {
  fileId: string
  fromPass: number
  toPass: number
  mode: "sentence" | "word"
  changes: DiffChange[]
  statistics: {
    totalChanges: number
    insertions: number
    deletions: number
    replacements: number
    wordsChanged: number
    charactersChanged: number
  }
}

interface DiffViewerProps {
  fileId?: string
  fileName?: string
  availablePasses?: number[]
}

interface ProcessedFile {
  fileId: string
  fileName: string
  passes: number[]
  lastUpdated: number
}

export default function DiffViewer({ fileId, fileName, availablePasses }: DiffViewerProps) {
  const { processingEvents } = useProcessing()
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [fromPass, setFromPass] = useState(1)
  const [toPass, setToPass] = useState(2)
  const [mode, setMode] = useState<"sentence" | "word">("sentence")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side")
  const [currentFileId, setCurrentFileId] = useState<string>(fileId || "")
  const [currentFileName, setCurrentFileName] = useState<string>(fileName || "")
  const [passes, setPasses] = useState<number[]>(availablePasses || [])
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<ProcessedFile | null>(null)

  const loadDiff = useCallback(async (fileId: string, from: number, to: number, diffMode: "sentence" | "word") => {
    if (from >= to || !fileId) {
      setError("Invalid pass selection")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const data = await refinerClient.getDiff(fileId, from, to, diffMode)
      setDiffData(data)
    } catch (error) {
      console.error("Failed to load diff:", error)
      setError(`Failed to load diff: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setDiffData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Track processed files from processing events
  const updateProcessedFiles = useCallback(() => {
    const fileMap = new Map<string, ProcessedFile>()
    
    // Process all events to build file information
    processingEvents.forEach(event => {
      if (event.type === 'pass_complete' && event.fileId && event.pass) {
        const fileId = event.fileId
        const fileName = event.fileName || `File ${fileId}`
        
        if (!fileMap.has(fileId)) {
          fileMap.set(fileId, {
            fileId,
            fileName,
            passes: [],
            lastUpdated: Date.now()
          })
        }
        
        const file = fileMap.get(fileId)!
        if (!file.passes.includes(event.pass)) {
          file.passes.push(event.pass)
          file.passes.sort((a, b) => a - b)
          file.lastUpdated = Date.now()
        }
      }
    })
    
    const files = Array.from(fileMap.values()).sort((a, b) => b.lastUpdated - a.lastUpdated)
    setProcessedFiles(files)
    
    // Auto-select the most recently processed file if none selected
    setSelectedFile(prevSelected => {
      if (prevSelected) return prevSelected // Keep existing selection
      if (files.length > 0) {
        const latestFile = files[0]
        setCurrentFileId(latestFile.fileId)
        setCurrentFileName(latestFile.fileName)
        setPasses(latestFile.passes)
        
        // Set default comparison (last two passes)
        if (latestFile.passes.length >= 2) {
          const sortedPasses = [...latestFile.passes].sort((a, b) => a - b)
          setFromPass(sortedPasses[sortedPasses.length - 2])
          setToPass(sortedPasses[sortedPasses.length - 1])
        }
        
        return latestFile
      }
      return null
    })
  }, [processingEvents])

  useEffect(() => {
    updateProcessedFiles()
  }, [updateProcessedFiles])

  useEffect(() => {
    // Restore last diff meta
    try {
      const saved = localStorage.getItem('refiner-diff-meta')
      if (!fileId && saved) {
        const parsed = JSON.parse(saved)
        if (parsed.fileId) setCurrentFileId(parsed.fileId)
        if (parsed.fileName) setCurrentFileName(parsed.fileName)
        if (Array.isArray(parsed.availablePasses)) setPasses(parsed.availablePasses)
        if (Array.isArray(parsed.availablePasses) && parsed.availablePasses.length >= 2) {
          const last = parsed.availablePasses[parsed.availablePasses.length - 1]
          const prev = parsed.availablePasses[parsed.availablePasses.length - 2]
          setFromPass(prev); setToPass(last)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Persist current diff meta
    try {
      if (currentFileId && passes.length) {
        localStorage.setItem('refiner-diff-meta', JSON.stringify({ fileId: currentFileId, fileName: currentFileName, availablePasses: passes }))
      }
    } catch {}
  }, [currentFileId, currentFileName, passes])

  // Load diff when parameters change
  useEffect(() => {
    if (currentFileId && passes.length >= 2 && fromPass < toPass) {
      loadDiff(currentFileId, fromPass, toPass, mode)
    }
  }, [fromPass, toPass, mode, currentFileId, passes, loadDiff])

  // Listen for processing completion events to refresh diff data
  useEffect(() => {
    const handleProcessingComplete = () => {
      
      // No need to do anything here - the processingEvents useEffect above will handle it
    }

    window.addEventListener("refiner-processing-complete", handleProcessingComplete)
    return () => window.removeEventListener("refiner-processing-complete", handleProcessingComplete)
  }, [])

  // Handle file selection
  const handleFileSelect = (file: ProcessedFile) => {
    setSelectedFile(file)
    setCurrentFileId(file.fileId)
    setCurrentFileName(file.fileName)
    setPasses(file.passes)
    
    // Set default comparison (last two passes)
    if (file.passes.length >= 2) {
      const sortedPasses = [...file.passes].sort((a, b) => a - b)
      setFromPass(sortedPasses[sortedPasses.length - 2])
      setToPass(sortedPasses[sortedPasses.length - 1])
    }
  }

  const getChangeColor = (type: DiffChange["type"]) => {
    switch (type) {
      case "insert":
        return "bg-green-100 text-green-800 border-l-2 border-green-300"
      case "delete":
        return "bg-red-100 text-red-800 border-l-2 border-red-300"
      case "replace":
        return "bg-blue-100 text-blue-800 border-l-2 border-blue-300"
      default:
        return "bg-muted"
    }
  }

  const renderSideBySide = () => {
    if (!diffData) return null

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-foreground font-medium text-sm">Pass {fromPass}</h4>
          <div className="bg-card rounded-lg p-4 max-h-96 overflow-y-auto border border-border">
            {diffData.changes.map((change, index) => (
              <div key={index} className="mb-2">
                {change.type !== "insert" && (
                  <div className={`p-2 rounded ${getChangeColor(change.type)} mb-1`}>
                    <span className="text-xs opacity-70">{change.type === "delete" ? "- " : "~ "}</span>
                    {change.originalText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-foreground font-medium text-sm">Pass {toPass}</h4>
          <div className="bg-card rounded-lg p-4 max-h-96 overflow-y-auto border border-border">
            {diffData.changes.map((change, index) => (
              <div key={index} className="mb-2">
                {change.type !== "delete" && (
                  <div className={`p-2 rounded ${getChangeColor(change.type)} mb-1`}>
                    <span className="text-xs opacity-70">{change.type === "insert" ? "+ " : "~ "}</span>
                    {change.newText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderUnified = () => {
    if (!diffData) return null

    return (
      <div className="bg-card rounded-lg p-4 max-h-96 overflow-y-auto border border-border">
        {diffData.changes.map((change, index) => (
          <div key={index} className="mb-2">
            {change.type === "delete" && (
              <div className={`p-2 rounded ${getChangeColor("delete")} mb-1`}>
                <span className="text-xs opacity-70">- </span>
                {change.originalText}
              </div>
            )}
            {change.type === "insert" && (
              <div className={`p-2 rounded ${getChangeColor("insert")} mb-1`}>
                <span className="text-xs opacity-70">+ </span>
                {change.newText}
              </div>
            )}
            {change.type === "replace" && (
              <>
                <div className={`p-2 rounded ${getChangeColor("delete")} mb-1`}>
                  <span className="text-xs opacity-70">- </span>
                  {change.originalText}
                </div>
                <div className={`p-2 rounded ${getChangeColor("insert")} mb-1`}>
                  <span className="text-xs opacity-70">+ </span>
                  {change.newText}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Diff Viewer</CardTitle>
            <CardDescription className="text-muted-foreground">
              {currentFileName || "Select a processed file to view differences"}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "side-by-side" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("side-by-side")}
              className={
                viewMode === "side-by-side"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
              }
            >
              Side-by-Side
            </Button>
            <Button
              variant={viewMode === "unified" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("unified")}
              className={
                viewMode === "unified"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
              }
            >
              Unified
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Selection */}
        {processedFiles.length > 0 && (
          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">Select File:</label>
            <Select
              value={selectedFile?.fileId || ""}
              onValueChange={(fileId) => {
                const file = processedFiles.find(f => f.fileId === fileId)
                if (file) handleFileSelect(file)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a processed file" />
              </SelectTrigger>
              <SelectContent>
                {processedFiles.map((file) => (
                  <SelectItem key={file.fileId} value={file.fileId}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{file.fileName}</span>
                      <Badge variant="secondary" className="ml-2">
                        {file.passes.length} passes
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Pass Selection Controls */}
        {passes.length >= 2 && (
          <div className="flex items-center space-x-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
              <label className="text-muted-foreground text-sm font-medium">From Pass:</label>
              <Select
                value={fromPass.toString()}
                onValueChange={(value) => setFromPass(Number.parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {passes
                    .filter((pass) => pass < toPass)
                    .map((pass) => (
                      <SelectItem key={pass} value={pass.toString()}>
                  Pass {pass}
                      </SelectItem>
              ))}
                </SelectContent>
              </Select>
          </div>

          <div className="flex items-center space-x-2">
              <label className="text-muted-foreground text-sm font-medium">To Pass:</label>
              <Select
                value={toPass.toString()}
                onValueChange={(value) => setToPass(Number.parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
              {passes
                .filter((pass) => pass > fromPass)
                .map((pass) => (
                      <SelectItem key={pass} value={pass.toString()}>
                    Pass {pass}
                      </SelectItem>
                ))}
                </SelectContent>
              </Select>
          </div>

          <div className="flex items-center space-x-2">
              <label className="text-muted-foreground text-sm font-medium">Mode:</label>
            <Button
              variant={mode === "sentence" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("sentence")}
              className={
                mode === "sentence"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
              }
            >
              Sentence
            </Button>
            <Button
              variant={mode === "word" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("word")}
              className={
                mode === "word"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
              }
            >
              Word
            </Button>
          </div>

          <Button
              onClick={() => loadDiff(currentFileId, fromPass, toPass, mode)}
              disabled={isLoading || !currentFileId || fromPass >= toPass}
            size="sm"
            className="bg-muted text-foreground hover:bg-muted/80 h-7 px-2 text-xs"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        )}

        {/* Statistics */}
        {diffData && (
          <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {diffData.statistics.totalChanges} changes
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              +{diffData.statistics.insertions}
            </Badge>
            <Badge className="bg-red-100 text-red-800 border-red-200">-{diffData.statistics.deletions}</Badge>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
              ~{diffData.statistics.replacements}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {diffData.statistics.wordsChanged} words • {diffData.statistics.charactersChanged} chars
            </span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Diff Content */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Loading diff...</p>
          </div>
        ) : processedFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-foreground mb-2">No Processed Files</h3>
              <p className="text-muted-foreground text-sm">
                Upload and process files to see differences between passes
              </p>
            </div>
          </div>
        ) : passes.length < 2 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-foreground mb-2">Insufficient Passes</h3>
              <p className="text-muted-foreground text-sm">
                This file needs at least 2 passes to compare differences
              </p>
            </div>
          </div>
        ) : diffData ? (
          viewMode === "side-by-side" ? (
            renderSideBySide()
          ) : (
            renderUnified()
          )
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">Select passes to compare</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
